const { Client } = require('pg');

const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

async function inspect() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    console.log("--- POLICIES ON organization_members ---");
    const res1 = await client.query(`
      SELECT policyname, definition 
      FROM pg_policies 
      WHERE tablename = 'organization_members'
    `);
    console.table(res1.rows);

    console.log("\n--- POLICIES ON organizations ---");
    const res2 = await client.query(`
      SELECT policyname, definition 
      FROM pg_policies 
      WHERE tablename = 'organizations'
    `);
    console.table(res2.rows);

    console.log("\n--- FUNCTIONS ---");
    const res3 = await client.query(`
      SELECT routine_name, routine_definition, external_language
      FROM information_schema.routines 
      WHERE routine_name IN ('is_org_member', 'is_org_admin')
    `);
    console.table(res3.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

inspect();
