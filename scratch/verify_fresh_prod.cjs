const fs = require('fs');
const { Client } = require('pg');

(async () => {
  const rootClient = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'postgres' });
  await rootClient.connect();
  await rootClient.query('DROP DATABASE IF EXISTS test_fresh_prod_verify');
  await rootClient.query('CREATE DATABASE test_fresh_prod_verify');
  await rootClient.end();

  console.log('Created fresh database test_fresh_prod_verify');

  const client = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'test_fresh_prod_verify' });
  await client.connect();

  const sql = fs.readFileSync('scripts/fresh_production_database.sql', 'utf8');
  await client.query(sql);
  console.log('Successfully executed fresh_production_database.sql!');

  // Verify counts
  const tables = [
    'supplier_profiles', 'customers', 'vehicles', 'drivers', 'contracts', 'rate_cards',
    'tax_profiles', 'invoice_series', 'invoices', 'trip_ledger', 'bank_accounts',
    'emi_schedules', 'vendor_payables', 'cash_transactions', 'fuel_entries', 'maintenance_logs', 'internal_flags'
  ];

  for (const t of tables) {
    const res = await client.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`${t.padEnd(25)} count: ${res.rows[0].count}`);
  }

  await client.end();

  // Drop after verification
  const cleanClient = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'postgres' });
  await cleanClient.connect();
  await cleanClient.query('DROP DATABASE test_fresh_prod_verify');
  await cleanClient.end();
  console.log('Cleaned up test_fresh_prod_verify');
})();
