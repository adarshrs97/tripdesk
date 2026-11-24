const { Client } = require('pg');

async function inspect() {
  const c = new Client({
    host: '127.0.0.1',
    port: 5439,
    user: 'postgres',
    password: 'postgres',
    database: 'test',
  });
  await c.connect();
  const res = await c.query('SELECT id, trip_date, remarks FROM trip_ledger LIMIT 5');
  console.log('Sample rows:', res.rows);
  const count = await c.query("SELECT COUNT(*) FROM trip_ledger WHERE remarks LIKE 'BENCH%'");
  console.log('Count BENCH rows:', count.rows[0].count);
  await c.end();
}

inspect().catch(console.error);
