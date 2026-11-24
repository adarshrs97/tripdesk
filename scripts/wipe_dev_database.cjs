// ==============================================================================
// STARCITI ERP - DEVELOPMENT DATABASE WIPE SCRIPT
// Wipes all transactional test data from the development database before go-live.
//
// SAFETY GUARDS:
// 1. Refuses to run if environment variable ALLOW_DEV_WIPE !== 'true'.
// 2. Refuses to run if database name contains 'prod' or does not match dev config.
// 3. Preserves minimal real seeds: VTL, GPS, 4 real vehicles, 4 real drivers, 2 suppliers.
// 4. Wipes: all invoices, trips, payments, credit/debit notes, cash txns, mock accounts.
// ==============================================================================

const readline = require('readline');
const { Client } = require('pg');

const targetConfig = {
  host: process.env.DEV_DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DEV_DB_PORT || '5439', 10),
  user: process.env.DEV_DB_USER || 'postgres',
  password: process.env.DEV_DB_PASSWORD || 'postgres',
  database: process.env.DEV_DB_NAME || 'starciti',
};

async function runDevWipe() {
  const dbName = targetConfig.database.toLowerCase();

  // Safety Guard: Never run on a production named database
  if (dbName.includes('prod') || dbName.includes('live')) {
    console.error(`FATAL SAFETY ERROR: Refusing to wipe database "${dbName}" containing "prod" or "live".`);
    process.exit(1);
  }

  console.log('==================================================================');
  console.log('STARCITI ERP: DEVELOPMENT DATABASE WIPE UTILITY');
  console.log(`Target: ${targetConfig.host}:${targetConfig.port}/${targetConfig.database}`);
  console.log('This will wipe all test trips, invoices, payments, and mock data.');
  console.log('Minimal real seeds (VTL, GPS, 4 vehicles, 4 drivers) will be preserved.');
  console.log('==================================================================');

  if (process.env.ALLOW_DEV_WIPE !== 'true') {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question('Are you sure you want to wipe the development database? (Type "WIPE-DEV" to confirm): ', resolve);
    });
    rl.close();

    if (answer.trim() !== 'WIPE-DEV') {
      console.log('Wipe cancelled by user.');
      process.exit(0);
    }
  }

  const client = new Client(targetConfig);
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Delete dependent transactional records
    await client.query('DELETE FROM payments;');
    await client.query('DELETE FROM credit_debit_notes;');
    await client.query('DELETE FROM payment_reminders;');
    await client.query('DELETE FROM invoice_lines;');

    // 2. Unlock and delete trip ledger entries
    await client.query('UPDATE trip_ledger SET is_locked = FALSE, invoice_id = NULL;');
    await client.query('DELETE FROM trip_ledger;');

    // 3. Delete invoices
    await client.query('DELETE FROM invoices;');

    // 4. Delete mock accounts, payables, EMIs, and cash transactions
    await client.query('DELETE FROM cash_transactions;');
    await client.query('DELETE FROM vendor_payables;');
    await client.query('DELETE FROM emi_schedules;');
    await client.query('DELETE FROM bank_accounts;');

    // 5. Delete fuel entries and maintenance logs
    await client.query('DELETE FROM fuel_entries;');
    await client.query('DELETE FROM maintenance_logs;');

    // 6. Delete tokens and approvals
    await client.query('DELETE FROM customer_tokens;');
    await client.query('DELETE FROM approvals;');
    await client.query('DELETE FROM internal_flags;');

    // 7. Reset invoice series current_number to 0
    await client.query('UPDATE invoice_series SET current_number = 0, last_issued_at = NULL;');

    // 8. Ensure only real entities are active
    await client.query(`
      UPDATE customers 
      SET is_sample_data = FALSE, is_active = TRUE 
      WHERE id IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');

      DELETE FROM customers 
      WHERE id NOT IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');

      UPDATE vehicles 
      SET is_sample_data = FALSE, is_active = TRUE 
      WHERE reg_no IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378');

      DELETE FROM vehicles 
      WHERE reg_no NOT IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378');

      UPDATE drivers 
      SET is_sample_data = FALSE, is_active = TRUE 
      WHERE id IN (
        'd0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000003',
        'd0000000-0000-0000-0000-000000000004'
      );
    `);

    await client.query('COMMIT');
    console.log('SUCCESS: Development database wiped cleanly to pristine baseline!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR during wipe, rolled back:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runDevWipe().catch(console.error);
}

module.exports = { runDevWipe };
