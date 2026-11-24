const { Client } = require('pg');

(async () => {
  const client = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'postgres', database: 'test_migration_verify' });
  await client.connect();

  const tables = ['supplier_profiles', 'customers', 'vehicles', 'drivers', 'contracts', 'invoices', 'trip_ledger', 'bank_accounts', 'emi_schedules', 'vendor_payables'];
  for (const t of tables) {
    const res = await client.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(t, 'count:', res.rows[0].count);
  }

  // Check sample vs real customers
  const custRes = await client.query('SELECT name, is_sample_data, is_active FROM customers');
  console.log('Customers:', custRes.rows);

  // Check sample vs real vehicles
  const vehRes = await client.query('SELECT reg_no, make_model, is_sample_data, is_active FROM vehicles');
  console.log('Vehicles:', vehRes.rows);

  // Check drivers
  const driverRes = await client.query('SELECT name, is_active FROM drivers');
  console.log('Drivers:', driverRes.rows);

  // Check invoices
  const invRes = await client.query('SELECT invoice_number, total_amount, status FROM invoices');
  console.log('Invoices:', invRes.rows);

  await client.end();
})();
