const { Client } = require('pg');

const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function fixPin() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Consertando comprimento do PIN para 6 caracteres...');
    await client.connect();

    // 1. Re-gerar pins para todos os quizzes com EXATAMENTE 6 caracteres
    await client.query(`
      UPDATE quizzes SET pin = substring(upper(id::text), 1, 6);
    `);

    console.log('✅ Todos os PINs foram ajustados para 6 caracteres!');
  } catch (err) {
    console.error('❌ Erro no ajuste do PIN:', err);
  } finally {
    await client.end();
  }
}

fixPin();
