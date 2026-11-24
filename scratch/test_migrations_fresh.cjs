const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const rootClient = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'postgres' });
  await rootClient.connect();
  await rootClient.query('DROP DATABASE IF EXISTS test_migration_verify');
  await rootClient.query('CREATE DATABASE test_migration_verify');
  await rootClient.end();

  console.log('Created fresh test_migration_verify database');

  const client = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'test_migration_verify' });
  await client.connect();

  const migrationsDir = 'supabase/migrations';
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const f of files) {
    const fullPath = path.join(migrationsDir, f);
    const sql = fs.readFileSync(fullPath, 'utf8');
    try {
      await client.query(sql);
      console.log('Applied:', f);
    } catch (err) {
      console.error('FAILED migration:', f, err.message);
      break;
    }
  }

  await client.end();
})();
