const { Client } = require('pg');
(async () => {
  const c = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'postgres' });
  await c.connect();
  const res = await c.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'test' AND pid <> pg_backend_pid()");
  console.log('Terminated:', res.rowCount);
  await c.end();
})();
