const { Client } = require('pg');
const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function listUsers() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT id, nickname, email, role FROM public.users');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
listUsers();
