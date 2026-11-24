// ==============================================================================
// Milestone 9: Performance Benchmarking on Large Datasets
// Seeds 1,000 trip rows inside an isolated transaction (MVCC) and benchmarks queries < 50ms.
// Zero data leakage or interference with concurrent test suites.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, assertTestDatabaseGuard } from './testDbHelper';

describe('Milestone 9: Performance Benchmark on Large Datasets', () => {
  let client: Client;

  const kl01VehicleId = '10000000-0000-0000-0000-000000000001';
  const driverId = 'd0000000-0000-0000-0000-000000000001';
  const contractId = 'b0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);
  });

  afterAll(async () => {
    await client.end();
  });

  it('Performance & Scale: Seeds 1,000 trips and executes indexed range queries under 50ms SLA', async () => {
    await client.query('BEGIN');

    try {
      // Seed 1,000 trip records across 1,000 consecutive days
      const tripValues: string[] = [];
      let curKm = 50000;
      const baseDate = new Date('2020-01-01');

      for (let i = 0; i < 1000; i++) {
        const d = new Date(baseDate.getTime() + i * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        const startKm = curKm;
        const kmRun = 30 + (i % 50);
        const closeKm = startKm + kmRun;
        curKm = closeKm;

        tripValues.push(`(
          gen_random_uuid(),
          '${contractId}',
          '${kl01VehicleId}',
          '${driverId}',
          '${dateStr}',
          'RUN',
          ${startKm},
          ${closeKm},
          ${kmRun},
          '08:00',
          '20:00',
          720,
          'BENCH_TEST_Trip #${i + 1}'
        )`);
      }

      // Batch insert into trip_ledger
      for (let b = 0; b < tripValues.length; b += 250) {
        const batch = tripValues.slice(b, b + 250);
        await client.query(`
          INSERT INTO trip_ledger (
            id, contract_id, vehicle_id, driver_id, trip_date,
            day_status, start_km, close_km, used_km, start_time,
            close_time, duration_minutes, remarks
          ) VALUES ${batch.join(',')}
        `);
      }

      // Benchmark 1: Vehicle trip log range query over 1,000 rows
      const t1Start = performance.now();
      const res1 = await client.query(
        `SELECT id, trip_date, start_km, close_km, used_km, day_status
         FROM trip_ledger
         WHERE vehicle_id = $1 AND trip_date >= $2 AND trip_date <= $3
         ORDER BY trip_date ASC, start_km ASC`,
        [kl01VehicleId, '2020-01-01', '2022-12-31']
      );
      const t1Elapsed = performance.now() - t1Start;
      expect(res1.rows.length).toBeGreaterThanOrEqual(1000);
      expect(t1Elapsed).toBeLessThan(50); // Under 50ms SLA

      // Benchmark 2: Driver monthly aggregation over date range
      const t2Start = performance.now();
      const res2 = await client.query(
        `SELECT trip_date, day_status, COUNT(*) as trip_count, SUM(used_km) as km_sum, SUM(duration_minutes) as min_sum
         FROM trip_ledger
         WHERE driver_id = $1 AND trip_date >= $2 AND trip_date <= $3
         GROUP BY trip_date, day_status
         ORDER BY trip_date ASC`,
        [driverId, '2020-01-01', '2020-01-31']
      );
      const t2Elapsed = performance.now() - t2Start;
      expect(res2.rows.length).toBeGreaterThanOrEqual(1);
      expect(t2Elapsed).toBeLessThan(50); // Under 50ms SLA

      // Benchmark 3: Window function gap detection across 1,000 trips
      const t3Start = performance.now();
      const res3 = await client.query(
        `WITH ordered_trips AS (
          SELECT id, trip_date, start_km, close_km,
                 LAG(close_km) OVER (PARTITION BY vehicle_id ORDER BY trip_date, start_km) AS prev_close_km
          FROM trip_ledger
          WHERE vehicle_id = $1
        )
        SELECT id, trip_date, start_km, prev_close_km, (start_km - prev_close_km) AS km_gap
        FROM ordered_trips
        WHERE prev_close_km IS NOT NULL AND (start_km - prev_close_km) > 15`,
        [kl01VehicleId]
      );
      const t3Elapsed = performance.now() - t3Start;
      expect(Array.isArray(res3.rows)).toBe(true);
      expect(t3Elapsed).toBeLessThan(50); // Under 50ms SLA

      // Benchmark 4: B-tree index utilization plan verification
      const res4 = await client.query(
        `EXPLAIN ANALYZE
         SELECT id FROM trip_ledger
         WHERE contract_id = $1 AND trip_date = $2`,
        [contractId, '2020-06-15']
      );
      const planText = res4.rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(planText).toMatch(/Index/i);
    } finally {
      // Rollback guarantees zero persistence, zero side effects
      await client.query('ROLLBACK');
    }
  });
});
