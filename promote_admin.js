const { Client } = require('pg');
const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function promote() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    // Promover fontana.jur@gmail.com e qualquer usuário chamado 'Fontana' para admin
    const res = await client.query("UPDATE public.users SET role = 'admin' WHERE email = 'fontana.jur@gmail.com' OR nickname = 'Fontana'");
    console.log(`✅ Usuários promovidos: ${res.rowCount}`);
    
    // Verificar se agora existe pelo menos um admin
    const check = await client.query("SELECT nickname, role FROM public.users WHERE role = 'admin'");
    console.log('Admins atuais:', JSON.stringify(check.rows, null, 2));
  } catch (err) {
    console.error('❌ Erro na promoção:', err);
  } finally {
    await client.end();
  }
}
promote();
