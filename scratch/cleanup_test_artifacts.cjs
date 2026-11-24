const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5439,
    user: 'postgres',
    password: 'postgres',
    database: 'test',
  });

  await client.connect();

  // Find any test invoices for ad-hoc customers
  const invs = await client.query(`
    SELECT id, customer_id 
    FROM invoices 
    WHERE customer_id NOT IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
  `);

  const fkRes = await client.query(`
    SELECT conname, conrelid::regclass as referencing_table
    FROM pg_constraint
    WHERE confrelid = 'invoices'::regclass
  `);
  console.log('FKs referencing invoices:', fkRes.rows);

  for (const row of invs.rows) {
    console.log(`Processing invoice ${row.id}...`);
    await client.query("UPDATE invoices SET status = 'draft', locked_at = NULL WHERE id = $1", [row.id]);
    await client.query("DELETE FROM payments WHERE invoice_id = $1", [row.id]);
    await client.query("DELETE FROM credit_debit_notes WHERE original_invoice_id = $1", [row.id]);
    await client.query("DELETE FROM payment_reminders WHERE invoice_id = $1", [row.id]);
    const delRes = await client.query("DELETE FROM invoices WHERE id = $1", [row.id]);
    console.log(`Deleted invoice ${row.id}, affected rows: ${delRes.rowCount}`);
    const delCust = await client.query("DELETE FROM customers WHERE id = $1", [row.customer_id]);
    console.log(`Deleted customer ${row.customer_id}, affected rows: ${delCust.rowCount}`);
  }

  // Also check if any standalone customer remains
  await client.query(`
    DELETE FROM customers 
    WHERE id NOT IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
  `);

  const custCount = await client.query('SELECT COUNT(*) FROM customers');
  console.log(`Active customers in test DB: ${custCount.rows[0].count}`);

  await client.end();
}

run().catch(console.error);
