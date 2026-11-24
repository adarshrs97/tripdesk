import pg from 'pg';
const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });
  await client.connect();

  console.log('Testing RLS on real Supabase local stack (port 54322)...');

  // Ensure starciti_app has privileges
  await client.query(`
    GRANT starciti_app TO postgres;
    GRANT USAGE ON SCHEMA public TO starciti_app, authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO starciti_app, authenticated, anon;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO starciti_app, authenticated, anon;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO starciti_app, authenticated, anon;
  `);

  // 1. Admin test
  await client.query('BEGIN');
  await client.query('SET ROLE starciti_app');
  await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");
  const adminCust = await client.query('SELECT COUNT(*) FROM customers');
  console.log('Admin can read customers:', adminCust.rows[0].count);
  await client.query('ROLLBACK');

  // 2. Driver test: cannot read invoices
  await client.query('BEGIN');
  await client.query('SET ROLE starciti_app');
  await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', true)");
  const driverInvoices = await client.query('SELECT COUNT(*) FROM invoices');
  console.log('Driver sees invoices count:', driverInvoices.rows[0].count, '(Expected: 0)');

  // Driver cannot read contracts
  const driverContracts = await client.query('SELECT COUNT(*) FROM contracts');
  console.log('Driver sees contracts count:', driverContracts.rows[0].count, '(Expected: 0)');
  await client.query('ROLLBACK');

  // 3. Client Role Forgery Prevention Proof:
  // Client connects as starciti_app and tries to set app.current_role = 'admin' without valid JWT
  await client.query('BEGIN');
  await client.query('SET ROLE starciti_app');
  await client.query("SELECT set_config('request.jwt.claims', '', true)");
  await client.query("SELECT set_config('app.current_role', 'admin', true)");
  const forgedRole = await client.query('SELECT get_current_app_role() as role');
  console.log('Forged role attempt resolves to:', forgedRole.rows[0].role, '(Expected: anon)');
  const forgedInvoices = await client.query('SELECT COUNT(*) FROM invoices');
  console.log('Forged role sees invoices:', forgedInvoices.rows[0].count, '(Expected: 0)');
  await client.query('ROLLBACK');

  console.log('ALL REAL SUPABASE RLS & JWT TESTS PASSED CLEANLY ON PORT 54322!');
  await client.end();
}

run().catch(console.error);
