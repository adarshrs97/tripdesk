import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

async function syncMigrations(port, dbName) {
  console.log(`Syncing migrations to port ${port}, db ${dbName}...`);
  const client = new Client({ host: '127.0.0.1', port, user: 'postgres', password: 'postgres', database: dbName });
  await client.connect();

  const migrationsDir = path.resolve('supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await client.query(sql);
      console.log(`  [OK] Applied ${file}`);
    } catch (err) {
      // Check if already exists or ignore benign errors
      if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
        console.log(`  [SKIP] ${file}: ${err.message.split('\n')[0]}`);
      } else {
        console.error(`  [ERR] ${file}:`, err.message);
      }
    }
  }

  await client.end();
}

async function main() {
  // Sync to port 54322 test database
  try {
    await syncMigrations(54322, 'test');
  } catch (e) {
    console.error('Port 54322 sync error:', e.message);
  }

  // Sync to port 5439 test database
  try {
    await syncMigrations(5439, 'test');
  } catch (e) {
    console.error('Port 5439 sync error:', e.message);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
