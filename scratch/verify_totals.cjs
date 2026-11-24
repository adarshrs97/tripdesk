const { Client } = require('pg');

async function totals() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:5439/starciti' });
  await client.connect();
  const res = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE day_status IN ('RUN', 'SUBSTITUTE')) as run_days,
      SUM(used_km) as total_km,
      SUM(CASE WHEN duration_minutes > 720 THEN duration_minutes - 720 ELSE 0 END) as extra_minutes,
      COUNT(*) FILTER (WHERE night_bata = true) as night_bata_count,
      COUNT(*) FILTER (WHERE outstation_bata = true) as outstation_bata_count,
      SUM(permit_amount) as total_permit
    FROM trip_ledger;
  `);
  console.log('Postgres Trip Ledger Aggregates:', res.rows[0]);
  await client.end();
}

totals().catch(console.error);
