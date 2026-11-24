import * as fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function applyMigration(port, dbName) {
  const sql = fs.readFileSync('supabase/migrations/20261123010000_starciti_fuel_expenses_schema.sql', 'utf8');
  const client = new Client({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/${dbName}`,
  });
  await client.connect();
  console.log(`Applying fuel migration to port ${port} (${dbName})...`);
  await client.query(sql);
  console.log(`Success on port ${port}!`);
  await client.end();
}

async function main() {
  await applyMigration(5439, 'starciti');
  await applyMigration(54322, 'postgres');
}

main().catch(console.error);
