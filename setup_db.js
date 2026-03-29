const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function setupDB() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Conectando ao banco de dados Supabase...');
    await client.connect();

    const sqlPath = path.join(__dirname, 'supabase_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Aplicando o schema SQL e triggers ao banco...');
    await client.query(sql);

    console.log('✅ Banco de dados configurado com sucesso! Todas as tabelas, RLS e Triggers foram criados.');
  } catch (err) {
    console.error('❌ Erro ao aplicar o schema:', err);
  } finally {
    await client.end();
  }
}

setupDB();
