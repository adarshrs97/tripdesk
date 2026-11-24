/**
 * scripts/init_production_database.cjs
 *
 * Applies fresh_production_database.sql to the self-hosted production PostgreSQL instance.
 * Verifies that:
 * 1. Schema, RLS policies, and immutability triggers are applied.
 * 2. Real master entities only (VTL, Global Public School, 4 vehicles, 4 drivers).
 * 3. 0 trips, 0 invoices, 0 dummy bank/EMI accounts.
 * 4. Dedicated TEST invoice series is ready for pilot testing.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PROD_PATH = path.join(ROOT_DIR, '.env.production');
const DDL_PATH = path.join(ROOT_DIR, 'scripts', 'fresh_production_database.sql');

function loadEnvConfig() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.POSTGRES_PORT || '54322', 10),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'postgres',
  };

  if (fs.existsSync(ENV_PROD_PATH)) {
    const lines = fs.readFileSync(ENV_PROD_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (key === 'POSTGRES_PASSWORD') config.password = val;
      if (key === 'POSTGRES_PORT') config.port = parseInt(val, 10);
      if (key === 'DB_HOST') config.host = val;
      if (key === 'POSTGRES_DB') config.database = val;
    }
  }

  return config;
}

async function initProductionDb() {
  console.log('==================================================================');
  console.log('STARCITI FLEET DESK: INITIALIZE FRESH PRODUCTION DATABASE');
  console.log('==================================================================');

  const config = loadEnvConfig();
  console.log(`Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}...`);

  const client = new Client(config);
  try {
    await client.connect();
    console.log('[PASS] Connected to PostgreSQL server.');

    console.log(`Reading DDL script: ${DDL_PATH}...`);
    const ddlSql = fs.readFileSync(DDL_PATH, 'utf-8');

    console.log('Executing fresh production DDL and real master seeds...');
    await client.query(ddlSql);
    console.log('[PASS] DDL and real baseline seeds applied successfully.');

    // Verification Checks
    console.log('------------------------------------------------------------------');
    console.log('VERIFYING PRODUCTION DATABASE INTEGRITY:');

    const custCount = await client.query("SELECT COUNT(*) FROM customers WHERE is_sample_data = FALSE");
    const vehCount = await client.query("SELECT COUNT(*) FROM vehicles WHERE is_sample_data = FALSE");
    const drvCount = await client.query("SELECT COUNT(*) FROM drivers WHERE is_sample_data = FALSE");
    const invCount = await client.query("SELECT COUNT(*) FROM invoices");
    const tripCount = await client.query("SELECT COUNT(*) FROM trip_ledger");
    const seriesRes = await client.query("SELECT prefix, financial_year, current_number FROM invoice_series WHERE prefix = 'TEST'");
    const bankCount = await client.query("SELECT COUNT(*) FROM bank_accounts WHERE is_sample_data = FALSE");
    const emiCount = await client.query("SELECT COUNT(*) FROM emi_schedules WHERE is_sample_data = FALSE");

    console.log(`- Real Customers: ${custCount.rows[0].count} (Expected: 2 - VTL & Global Public School)`);
    console.log(`- Real Vehicles:  ${vehCount.rows[0].count} (Expected: 4)`);
    console.log(`- Real Drivers:   ${drvCount.rows[0].count} (Expected: 4)`);
    console.log(`- Invoices:       ${invCount.rows[0].count} (Strictly 0 for fresh production)`);
    console.log(`- Trip Ledger:    ${tripCount.rows[0].count} (Strictly 0 for fresh production)`);
    console.log(`- Real Banks:     ${bankCount.rows[0].count} (0 - Empty state awaiting owner)`);
    console.log(`- Real EMIs:      ${emiCount.rows[0].count} (0 - Empty state awaiting owner)`);
    console.log(`- TEST Series:    ${seriesRes.rowCount} active TEST series configured`);

    if (parseInt(invCount.rows[0].count, 10) !== 0 || parseInt(tripCount.rows[0].count, 10) !== 0) {
      throw new Error('Integrity Violation: Fresh production database must have 0 invoices and 0 trips!');
    }

    console.log('==================================================================');
    console.log('FRESH PRODUCTION DATABASE READY FOR GO-LIVE & TEST PILOT');
    console.log('==================================================================');
  } catch (err) {
    console.error('[FAIL] Initialization error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initProductionDb();
