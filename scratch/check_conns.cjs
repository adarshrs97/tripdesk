const { Client } = require('pg');
(async () => {
  const c = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'postgres' });
  await c.connect();
  const res = await c.query("SELECT pid, usename, datname, application_name, state, query FROM pg_stat_activity WHERE datname = 'test'");
  console.log(JSON.stringify(res.rows, null, 2));
  await c.end();
})();
