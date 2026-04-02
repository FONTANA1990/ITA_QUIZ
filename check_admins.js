const { Client } = require('pg');
const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function listAdmins() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query("SELECT id, nickname, email, role FROM public.users WHERE role = 'admin'");
    console.log('Admins:', JSON.stringify(res.rows, null, 2));

    const all = await client.query("SELECT id, nickname, email, role FROM public.users WHERE nickname ILIKE '%fontana%' OR email ILIKE '%fontana%'");
    console.log('Fontana users:', JSON.stringify(all.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
listAdmins();
