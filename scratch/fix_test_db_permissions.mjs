import pg from 'pg';
const { Client } = pg;

async function check() {
  const client = new Client({ host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'test' });
  await client.connect();

  // 1. Ensure storage buckets exist
  await client.query(`
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('odometer-photos', 'odometer-photos', false)
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('Bucket odometer-photos ensured.');

  // 2. Ensure starciti_app has permissions on all tables
  await client.query(`
    GRANT USAGE ON SCHEMA public TO starciti_app, authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO starciti_app, authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO starciti_app, authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO starciti_app, authenticated;
  `);
  console.log('Permissions granted to starciti_app.');

  await client.end();
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
