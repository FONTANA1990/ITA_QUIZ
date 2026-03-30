-- 1. Criação de Tabelas (Apenas se não existirem)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'player',
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gatilho para sincronização automática com Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  is_active BOOLEAN DEFAULT false,
  current_question_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting', -- waiting, playing, finished
  pin TEXT UNIQUE, -- Código de 6 dígitos para acesso fácil
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_option TEXT,
  is_correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quiz_id)
);

-- Garantir colunas em bancos já existentes
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Gatilhos de Pontuação Automática
CREATE OR REPLACE FUNCTION update_score()
RETURNS TRIGGER AS $$
DECLARE
    v_quiz_id UUID;
BEGIN
    -- Busca o quiz_id ao qual a questão pertence
    SELECT quiz_id INTO v_quiz_id FROM public.questions WHERE id = NEW.question_id;

    IF NEW.is_correct = true THEN
        -- 1. Atualizar Score da Partida Atual
        INSERT INTO public.scores (user_id, quiz_id, total_points)
        VALUES (NEW.user_id, v_quiz_id, 100)
        ON CONFLICT (user_id, quiz_id)
        DO UPDATE SET total_points = public.scores.total_points + 100;

        -- 2. Atualizar Pontuação Global do Usuário
        UPDATE public.users 
        SET total_points = COALESCE(total_points, 0) + 100 
        WHERE id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_answer_insert ON answers;
CREATE TRIGGER on_answer_insert
AFTER INSERT ON answers
FOR EACH ROW
EXECUTE FUNCTION update_score();

-- Segurança (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Public Profiles Access" ON users;
CREATE POLICY "Public Profiles Access" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Insert User" ON users;
CREATE POLICY "Allow Insert User" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "View Quizzes" ON quizzes;
CREATE POLICY "View Quizzes" ON quizzes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Quizzes" ON quizzes;
CREATE POLICY "Admin Quizzes" ON quizzes FOR ALL USING (true);

DROP POLICY IF EXISTS "View Questions" ON questions;
CREATE POLICY "View Questions" ON questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Questions" ON questions;
CREATE POLICY "Admin Questions" ON questions FOR ALL USING (true);

DROP POLICY IF EXISTS "player can insert own answers" ON answers;
CREATE POLICY "player can insert own answers" ON answers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "View Answers" ON answers;
CREATE POLICY "View Answers" ON answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "block manual score update" ON scores;
CREATE POLICY "block manual score update" ON scores FOR UPDATE USING (false);

DROP POLICY IF EXISTS "View Scores" ON scores;
CREATE POLICY "View Scores" ON scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow players to join" ON scores;
CREATE POLICY "Allow players to join" ON scores FOR INSERT WITH CHECK (true);

-- 4. Gatilho para Gerar PIN Automático (Garante que nunca fique null)
CREATE OR REPLACE FUNCTION generate_quiz_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin IS NULL THEN
    NEW.pin := upper(substring(NEW.id::text, 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_pin ON quizzes;
CREATE TRIGGER tr_generate_pin
BEFORE INSERT ON quizzes
FOR EACH ROW EXECUTE FUNCTION generate_quiz_pin();

-- 5. Configuração de Realtime (Garante payload completo)
ALTER TABLE quizzes REPLICA IDENTITY FULL;
ALTER TABLE scores REPLICA IDENTITY FULL;

-- 6. Correção de dados existentes
UPDATE quizzes SET pin = upper(substring(id::text, 1, 6)) WHERE pin IS NULL;

-- 7. Garantia de Ordem das Perguntas
ALTER TABLE questions ADD COLUMN IF NOT EXISTS order_index INTEGER;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS timer_per_question INTEGER DEFAULT NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMP WITH TIME ZONE;

-- Índices de Performance para Exclusão em Cascata e Consultas Rápidas
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_quiz_id ON scores(quiz_id);
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);

-- Atualizar perguntas existentes com uma ordem padrão baseada na criação
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='order_index') THEN
        UPDATE questions SET order_index = sub.rn
        FROM (SELECT id, row_number() OVER (PARTITION BY quiz_id ORDER BY id) as rn FROM questions) AS sub
        WHERE questions.id = sub.id AND questions.order_index IS NULL;
    END IF;
END $$;

-- 8. Migração de Constraints Existentes (Garante ON DELETE CASCADE em bases antigas)
DO $$ 
BEGIN 
    -- 8.1 Questions -> Quizzes
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_quiz_id_fkey') THEN
        ALTER TABLE questions DROP CONSTRAINT questions_quiz_id_fkey;
    END IF;
    ALTER TABLE questions ADD CONSTRAINT questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

    -- 8.2 Answers -> Questions
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'answers_question_id_fkey') THEN
        ALTER TABLE answers DROP CONSTRAINT answers_question_id_fkey;
    END IF;
    ALTER TABLE answers ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

    -- 8.3 Scores -> Quizzes
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scores_quiz_id_fkey') THEN
        ALTER TABLE scores DROP CONSTRAINT scores_quiz_id_fkey;
    END IF;
    ALTER TABLE scores ADD CONSTRAINT scores_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;
END $$;
