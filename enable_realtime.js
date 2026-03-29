const { Client } = require('pg');

const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function enableRealtimeFull() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Configurando Realtime com REPLICA IDENTITY FULL...');
    await client.connect();

    await client.query(`
      BEGIN;
      -- Garante que o payload do Realtime venha completo
      ALTER TABLE quizzes REPLICA IDENTITY FULL;
      ALTER TABLE scores REPLICA IDENTITY FULL;
      
      -- Garante que as tabelas estejam na publicação
      -- Usamos um bloco anônimo para evitar erros se já estiverem lá
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quizzes') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE quizzes;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'scores') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE scores;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE users;
        END IF;
      END $$;
      
      COMMIT;
    `);

    console.log('✅ Configuração de Realtime FULL concluída!');
  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await client.end();
  }
}

enableRealtimeFull();
