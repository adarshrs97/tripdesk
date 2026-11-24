const fs = require('fs');
const { Client } = require('pg');

const sql = fs.readFileSync('supabase/migrations/20261123080000_starciti_force_rls_and_invoice_immutability.sql', 'utf8');

const targets = [
  { host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'test' },
  { host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'starciti' },
  { host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'test' },
  { host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'postgres' },
];

(async () => {
  for (const t of targets) {
    try {
      const c = new Client(t);
      await c.connect();
      await c.query(sql);
      console.log('Applied migration 20261123080000 to', t.port, t.database);
      await c.end();
    } catch (e) {
      console.log('Error/Skipping for', t.port, t.database, e.message);
    }
  }
})();
