const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    await client.connect();
    console.log('Connected.');
    const sql = `
      CREATE OR REPLACE FUNCTION public.update_score()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          v_quiz_id UUID;
          v_points INTEGER;
      BEGIN
          -- Busca o quiz_id ao qual a questão pertence e a pontuação configurada
          SELECT quiz_id INTO v_quiz_id FROM public.questions WHERE id = NEW.question_id;

          SELECT COALESCE(points_per_question, 100) INTO v_points FROM public.quizzes WHERE id = v_quiz_id;

          IF NEW.is_correct = true THEN
              -- 1. Atualizar Score da Partida Atual com os pontos referentes à questão
              INSERT INTO public.scores (user_id, quiz_id, total_points)
              VALUES (NEW.user_id, v_quiz_id, v_points)
              ON CONFLICT (user_id, quiz_id)
              DO UPDATE SET total_points = public.scores.total_points + EXCLUDED.total_points;

              -- 2. Atualizar Pontuação Global do Usuário
              UPDATE public.users 
              SET total_points = COALESCE(total_points, 0) + v_points
              WHERE id = NEW.user_id;
          ELSE
              -- Registrar presença do aluno com 0 pontos para aparecer no seu histórico, 
              -- caso já tenha uma linha, não fazemos nada.
              INSERT INTO public.scores (user_id, quiz_id, total_points)
              VALUES (NEW.user_id, v_quiz_id, 0)
              ON CONFLICT (user_id, quiz_id) DO NOTHING;
          END IF;

          RETURN NEW;
      END;
      $$;
    `;
    await client.query(sql);
    console.log('Trigger function updated successfully!');
  } catch (error) {
    console.error('Error updating trigger:', error);
  } finally {
    await client.end();
  }
}

main();
