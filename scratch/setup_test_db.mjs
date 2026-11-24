import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

async function setup() {
  console.log('--- Setting up isolated TEST databases ---');

  // 1. Port 5439 test database
  try {
    const client5439 = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'postgres' });
    await client5439.connect();
    await client5439.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'starciti' AND pid <> pg_backend_pid()");
    await client5439.query("DROP DATABASE IF EXISTS test");
    await client5439.query("CREATE DATABASE test TEMPLATE starciti");
    console.log('Port 5439: Successfully created database "test" cloned from starciti.');
    await client5439.end();
  } catch (err) {
    console.error('Port 5439 test db error:', err.message);
  }

  // 2. Port 54322 (Supabase local stack) test database
  try {
    const client54322 = new Client({ host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'postgres' });
    await client54322.connect();
    await client54322.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid()");
    await client54322.query("DROP DATABASE IF EXISTS test");
    try {
      await client54322.query("CREATE DATABASE test TEMPLATE postgres");
      console.log('Port 54322: Successfully created database "test" cloned from postgres.');
    } catch (e) {
      console.log('Port 54322 template clone skipped (active supabase daemons). Creating clean "test" db...');
      await client54322.query("CREATE DATABASE test");
    }
    await client54322.end();
  } catch (err) {
    console.error('Port 54322 test db error:', err.message);
  }
}

setup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
