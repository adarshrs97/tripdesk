const { Client } = require('pg');

async function clean() {
  const c = new Client({
    host: '127.0.0.1',
    port: 5439,
    user: 'postgres',
    password: 'postgres',
    database: 'test',
  });
  await c.connect();
  try {
    // Authenticate as Admin via JWT
    await c.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', false)");
    const res = await c.query("SELECT id, is_locked, invoice_id FROM trip_ledger WHERE remarks LIKE 'BENCH%' LIMIT 5");
    console.log('Sample bench rows:', res.rows);
    const del = await c.query("DELETE FROM trip_ledger WHERE remarks LIKE 'BENCH%'");
    console.log('Deleted rows:', del.rowCount);
  } catch (err) {
    console.error('Delete error:', err);
  }
  const count = await c.query('SELECT COUNT(*) FROM trip_ledger');
  console.log('Remaining trip_ledger rows:', count.rows[0].count);
  await c.end();
}

clean().catch(console.error);
