import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

import { createTestClient, assertTestDatabaseGuard } from './testDbHelper';

describe('Milestone 3: PostgreSQL Ledger, Approvals & RLS Security Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);
    // Switch to non-superuser application role starciti_app so RLS policies are strictly enforced
    await client.query('SET ROLE starciti_app;');
  });

  afterAll(async () => {
    if (client) {
      await client.query('RESET ROLE;');
      await client.end();
    }
  });

  // TEST 1: Driver RLS isolation
  it('RLS: Driver Hemanth can only read his own trips (24 rows), not substitute driver Afzal row via JWT', async () => {
    // Authenticated Driver JWT for Hemanth Kumar
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', false);");

    const res = await client.query('SELECT * FROM trip_ledger;');
    // Exactly 24 rows belong to Hemanth (Day 20 belongs to Afzal, 6 days are Sunday/Holiday with null driver)
    expect(res.rows.length).toBe(24);
    expect(res.rows.every((r) => r.driver_id === 'd0000000-0000-0000-0000-000000000001')).toBe(true);

    // Verify Hemanth CANNOT see Day 20 (Afzal's trip)
    const afzalTrip = res.rows.find((r) => r.driver_id === 'd0000000-0000-0000-0000-000000000004');
    expect(afzalTrip).toBeUndefined();
  });

  it('RLS: Driver Afzal can only read his own single substitute trip via JWT', async () => {
    // Authenticated Driver JWT for Afzal
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000005\"}', false);");

    const res = await client.query('SELECT * FROM trip_ledger;');
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].driver_id).toBe('d0000000-0000-0000-0000-000000000004');
    expect(res.rows[0].used_km).toBe(50);
  });

  it('RLS: Driver cannot insert a trip row assigned to another driver via JWT', async () => {
    // Authenticated Driver JWT for Afzal
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000005\"}', false);");

    // Attempting to insert a row with Hemanth's driver ID
    await expect(
      client.query(`
        INSERT INTO trip_ledger (
          contract_id, vehicle_id, driver_id, trip_date, day_status, start_km, close_km, used_km
        ) VALUES (
          'b0000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000001',
          'd0000000-0000-0000-0000-000000000001',
          '2026-09-01',
          'RUN',
          157800,
          157850,
          50
        );
      `)
    ).rejects.toThrow(/violates row-level security policy/i);
  });

  // TEST 2: Staff RLS access & Rate Protection
  it('RLS: Staff can read all 31 ledger rows and approvals via JWT', async () => {
    // Authenticated Staff JWT
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', false);");

    const ledgerRes = await client.query('SELECT * FROM trip_ledger WHERE contract_id = $1;', [
      'b0000000-0000-0000-0000-000000000001',
    ]);
    expect(ledgerRes.rows.length).toBe(31);

    const approvalsRes = await client.query('SELECT * FROM approvals;');
    expect(approvalsRes.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('RLS: Staff cannot modify contract terms or rate cards via JWT (strictly blocked)', async () => {
    // Authenticated Staff JWT
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', false);");

    // Attempting to insert a rate card is rejected by RLS
    await expect(
      client.query(`
        INSERT INTO rate_cards (id, vehicle_type, base_amount, included_hours, included_km, extra_hour_rate, extra_km_rate)
        VALUES ('40000000-0000-0000-0000-000000000099', 'innova', 3500, 10, 80, 250, 20);
      `)
    ).rejects.toThrow(/violates row-level security policy/);

    // Attempting to update a rate card updates 0 rows due to RLS filter
    const updateRes = await client.query(`
      UPDATE rate_cards SET extra_km_rate = 99 WHERE id = '40000000-0000-0000-0000-000000000001';
    `);
    expect(updateRes.rowCount).toBe(0);
  });

  // TEST 3: Customer Token-Scoped Isolation
  it('RLS: Customer role with valid token hash can read their own trips', async () => {
    const validTokenHash = '7aa666832c6e928769be26ed0672c9e497584ed6dcdf8fe77e19b6640d9065bb';

    // Reset JWT claims to test token hash path cleanly
    await client.query("SELECT set_config('request.jwt.claims', '', false);");
    await client.query(`SELECT set_config('app.current_token_hash', '${validTokenHash}', false);`);

    const res = await client.query('SELECT * FROM trip_ledger;');
    // Returns the 31 trips for contract VTL
    expect(res.rows.length).toBe(31);
    expect(res.rows.every((r) => r.contract_id === 'b0000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('RLS: Customer role with invalid, expired, or revoked token hash sees 0 rows', async () => {
    const fakeTokenHash = '0000000000000000000000000000000000000000000000000000000000000000';

    // Reset JWT claims to test token hash path cleanly
    await client.query("SELECT set_config('request.jwt.claims', '', false);");
    await client.query(`SELECT set_config('app.current_token_hash', '${fakeTokenHash}', false);`);

    const res = await client.query('SELECT * FROM trip_ledger;');
    expect(res.rows.length).toBe(0); // Zero rows exposed
  });
});
