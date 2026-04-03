const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function applyOrgs() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Conectando ao banco de dados Supabase para aplicar Organizations...');
    await client.connect();

    const sqlPath = path.join(__dirname, 'organizations_setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executando organizations_setup.sql...');
    await client.query(sql);

    console.log('✅ Organizações e políticas RLS configuradas com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao aplicar SQL:', err);
  } finally {
    await client.end();
  }
}

applyOrgs();
