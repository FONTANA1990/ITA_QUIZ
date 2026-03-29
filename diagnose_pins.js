const { Client } = require('pg');

const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function diagnose() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('--- Quizzes no Banco ---');
    const res = await client.query('SELECT id, title, pin FROM quizzes');
    console.table(res.rows);
    console.log('------------------------');

    // Tentar encontrar o PIN específico que deu erro
    const pinErr = '8B5FD6';
    const found = res.rows.find(r => r.pin === pinErr);
    if (found) {
        console.log(`✅ PIN ${pinErr} encontrado para o quiz: ${found.title}`);
    } else {
        console.log(`❌ PIN ${pinErr} NÃO encontrado no banco.`);
        // Procurar por semelhanças
        const partial = res.rows.find(r => r.id.toString().toUpperCase().startsWith(pinErr));
        if (partial) {
            console.log(`💡 Encontrado quiz com ID começando em ${pinErr}, mas PIN é: "${partial.pin}"`);
        }
    }

  } catch (err) {
    console.error('Erro no diagnóstico:', err);
  } finally {
    await client.end();
  }
}

diagnose();
