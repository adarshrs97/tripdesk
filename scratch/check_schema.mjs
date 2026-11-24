import pg from 'pg';
const { Client } = pg;

async function check() {
  const c = new Client({ host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'test' });
  await c.connect();
  const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'app_users'");
  console.log('Columns in app_users on 54322/test:', res.rows.map(r => r.column_name));
  await c.end();
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
