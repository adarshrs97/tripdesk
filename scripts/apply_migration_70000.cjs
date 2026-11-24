const fs = require('fs');
const { Client } = require('pg');

const sql = fs.readFileSync('supabase/migrations/20261123070000_starciti_fix_real_data_provenance.sql', 'utf8');

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
      console.log('Applied real data provenance migration to', t.port, t.database);
      await c.end();
    } catch (e) {
      console.log('Skipping/Error for', t.port, t.database, e.message);
    }
  }
})();
