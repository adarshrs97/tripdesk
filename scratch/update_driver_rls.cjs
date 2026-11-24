const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5439/starciti' });
  await client.connect();

  await client.query('DROP POLICY IF EXISTS driver_trip_ledger_select ON trip_ledger;');
  await client.query('DROP POLICY IF EXISTS driver_trip_ledger_insert ON trip_ledger;');
  await client.query('DROP POLICY IF EXISTS driver_trip_ledger_update ON trip_ledger;');

  await client.query(`
    CREATE POLICY driver_trip_ledger_select ON trip_ledger
      FOR SELECT
      USING (
        current_setting('app.current_role', true) = 'driver'
        AND driver_id::text = current_setting('app.current_user_id', true)
      );
    CREATE POLICY driver_trip_ledger_insert ON trip_ledger
      FOR INSERT
      WITH CHECK (
        current_setting('app.current_role', true) = 'driver'
        AND driver_id::text = current_setting('app.current_user_id', true)
      );
    CREATE POLICY driver_trip_ledger_update ON trip_ledger
      FOR UPDATE
      USING (
        current_setting('app.current_role', true) = 'driver'
        AND driver_id::text = current_setting('app.current_user_id', true)
      );
  `);

  console.log('Successfully updated driver RLS policies to use text comparison!');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
