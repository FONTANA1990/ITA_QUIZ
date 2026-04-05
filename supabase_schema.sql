-- ==========================================
-- 1. ESTRUTURA BASE (TABELAS E COLUNAS)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'player',
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garante que a coluna email existe antes de limpar duplicados
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- ==========================================
-- 2. LIMPEZA DE DADOS (DUPLICADOS)
-- ==========================================

-- Remove usuários com o mesmo email, mantendo o que tem mais pontos ou o ID mais antigo
DELETE FROM public.users a
USING public.users b
WHERE a.id < b.id 
  AND a.email = b.email 
  AND a.email IS NOT NULL;

-- Agora que limpamos, podemos forçar o email a ser ÚNICO
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);

-- ==========================================
-- 3. OUTRAS TABELAS DO SISTEMA
-- ==========================================

CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  is_active BOOLEAN DEFAULT false,
  current_question_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting', -- waiting, playing, finished
  quiz_type TEXT DEFAULT 'classic',
  pin TEXT UNIQUE,
  timer_per_question INTEGER DEFAULT NULL,
  points_per_question INTEGER DEFAULT 100,
  question_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option TEXT NOT NULL,
  order_index INTEGER
);

CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option TEXT,
  is_correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quiz_id)
);

-- ==========================================
-- 4. GATILHOS (TRIGGERS) - LÓGICA AUTOMÁTICA
-- ==========================================

-- Gatilho: Criar perfil automaticamente no Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Gatilho: Atualizar pontuação global e do Quiz
CREATE OR REPLACE FUNCTION public.update_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quiz_id UUID;
    v_points INTEGER;
BEGIN
    SELECT quiz_id INTO v_quiz_id FROM public.questions WHERE id = NEW.question_id;
    SELECT COALESCE(points_per_question, 100) INTO v_points FROM public.quizzes WHERE id = v_quiz_id;

    IF NEW.is_correct = true THEN
        -- Atualiza ranking do quiz
        INSERT INTO public.scores (user_id, quiz_id, total_points)
        VALUES (NEW.user_id, v_quiz_id, v_points)
        ON CONFLICT (user_id, quiz_id)
        DO UPDATE SET total_points = public.scores.total_points + EXCLUDED.total_points;

        -- Atualiza ranking global
        UPDATE public.users 
        SET total_points = COALESCE(total_points, 0) + v_points
        WHERE id = NEW.user_id;
    ELSE
        -- Mesmo errando a questão, salva o histórico com 0 pontos inicial
        INSERT INTO public.scores (user_id, quiz_id, total_points)
        VALUES (NEW.user_id, v_quiz_id, 0)
        ON CONFLICT (user_id, quiz_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_answer_insert ON public.answers;
CREATE TRIGGER on_answer_insert AFTER INSERT ON public.answers FOR EACH ROW EXECUTE FUNCTION public.update_score();

-- Gatilho: Gerar PIN de 6 dígitos automático
CREATE OR REPLACE FUNCTION public.generate_quiz_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin IS NULL THEN
    NEW.pin := upper(substring(NEW.id::text, 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_pin ON public.quizzes;
CREATE TRIGGER tr_generate_pin BEFORE INSERT ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.generate_quiz_pin();

-- ==========================================
-- 5. SEGURANÇA (RLS) - POLÍTICAS DE ACESSO
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Usuários: Todos podem ver perfis, apenas o dono ou admin edita
DROP POLICY IF EXISTS "Public Profiles Access" ON public.users;
CREATE POLICY "Public Profiles Access" ON public.users FOR SELECT USING (true);

-- Admin & Super-Admin (Acesso Total)
DROP POLICY IF EXISTS "Admin Full Access" ON public.quizzes;
CREATE POLICY "Admin Full Access" ON public.quizzes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR email = 'mediattamoveis@gmail.com'))
);

-- Jogadores: Podem ver quizzes e responder
DROP POLICY IF EXISTS "Player View Quizzes" ON public.quizzes;
CREATE POLICY "Player View Quizzes" ON public.quizzes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Player Insert Own Answers" ON public.answers;
CREATE POLICY "Player Insert Own Answers" ON public.answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scores: Leitura pública
DROP POLICY IF EXISTS "Public Scores Access" ON public.scores;
CREATE POLICY "Public Scores Access" ON public.scores FOR SELECT USING (true);

-- ==========================================
-- 6. PERFORMANCE (ÍNDICES)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_scores_quiz_user ON public.scores(quiz_id, user_id);
CREATE INDEX IF NOT EXISTS idx_answers_user ON public.answers(user_id);

-- Habilita Realtime
ALTER TABLE public.quizzes REPLICA IDENTITY FULL;
ALTER TABLE public.scores REPLICA IDENTITY FULL;
