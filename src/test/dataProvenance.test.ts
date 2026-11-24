// ==============================================================================
// Milestone 9: Data Provenance & Sample Data Removal Test
// Verifies:
// 1. Real records from owner files are strictly preserved with is_sample_data = false:
//    - Customers: M/s Vindhya Telelinks Ltd & Global Public School
//    - Vehicles: KL01 CP 3284, KL82 4889, KL74 E 3694, KL21 M 2378
//    - Drivers: Hemanth, Muhammad Fayaz, Asheerkhan, Afzal
// 2. remove_all_sample_data() deletes ZERO of these real confirmed records.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, assertTestDatabaseGuard } from './testDbHelper';

describe('Milestone 9: Data Provenance & Real Data Protection', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);
  });

  afterAll(async () => {
    await client.end();
  });

  it('proves all 2 real customers have is_sample_data = FALSE and is_active = TRUE', async () => {
    const res = await client.query(`
      SELECT id, name, is_active, is_sample_data
      FROM customers
      WHERE id IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')
      ORDER BY id;
    `);

    expect(res.rows.length).toBe(2);
    expect(res.rows[0].name).toContain('Vindhya');
    expect(res.rows[0].is_sample_data).toBe(false);
    expect(res.rows[0].is_active).toBe(true);

    expect(res.rows[1].name).toBe('Global Public School');
    expect(res.rows[1].is_sample_data).toBe(false);
    expect(res.rows[1].is_active).toBe(true);
  });

  it('proves all 4 real fleet vehicles have is_sample_data = FALSE and is_active = TRUE', async () => {
    const res = await client.query(`
      SELECT reg_no, display_reg_no, make_model, is_active, is_sample_data
      FROM vehicles
      WHERE reg_no IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378')
      ORDER BY reg_no;
    `);

    expect(res.rows.length).toBe(4);
    for (const v of res.rows) {
      expect(v.is_sample_data).toBe(false);
      expect(v.is_active).toBe(true);
    }

    // Verify KL01CP3284 has exact invoice model
    const kl01 = res.rows.find((v) => v.reg_no === 'KL01CP3284');
    expect(kl01.make_model).toBe('7-Seat AC Car');
  });

  it('proves all 4 real drivers are active in database', async () => {
    const res = await client.query(`
      SELECT id, name, is_active
      FROM drivers
      WHERE id IN (
        'd0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000003',
        'd0000000-0000-0000-0000-000000000004'
      )
      ORDER BY id;
    `);

    expect(res.rows.length).toBe(4);
    expect(res.rows[0].name).toContain('Hemanth');
    expect(res.rows[1].name).toContain('Muhammad Fayaz');
    expect(res.rows[2].name).toContain('Asheerkhan');
    expect(res.rows[3].name).toContain('Afzal');

    for (const d of res.rows) {
      expect(d.is_active).toBe(true);
    }
  });

  it('proves remove_all_sample_data() deletes ZERO real entities while removing sample demo data', async () => {
    // Run inside an isolated transaction
    await client.query('BEGIN');
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

    try {
      // 1. Insert a dummy sample vehicle, dummy sample bank, dummy sample cash
      await client.query(`
        INSERT INTO vehicles (id, reg_no, display_reg_no, make_model, vehicle_type, seats, ownership, current_odometer, km_gap_threshold, is_active, is_sample_data)
        VALUES ('10000000-0000-0000-0000-000000000099', 'KL01BZ4111', 'KL-01-BZ-4111', 'Sample Crysta', 'sedan', 7, 'owned', 80000, 15, true, true);

        INSERT INTO cash_transactions (id, entry_date, transaction_type, category, amount, description, is_sample_data)
        VALUES ('c1000000-0000-0000-0000-000000000099', '2026-08-20', 'payment', 'office_expense', 500, 'Sample demo tea', true);
      `);

      // 2. Invoke remove_all_sample_data()
      const rpcRes = await client.query('SELECT remove_all_sample_data() as result;');
      const result = rpcRes.rows[0].result;
      expect(result.success).toBe(true);
      expect(result.deleted_cash_transactions).toBeGreaterThanOrEqual(1);
      expect(result.deactivated_sample_vehicles).toBeGreaterThanOrEqual(1);

      // 3. Assert ZERO real customers were deleted or deactivated
      const custRes = await client.query(`
        SELECT id, name, is_active FROM customers
        WHERE id IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');
      `);
      expect(custRes.rows.length).toBe(2);
      expect(custRes.rows.every((c) => c.is_active === true)).toBe(true);

      // 4. Assert ZERO real vehicles were deleted or deactivated
      const vehRes = await client.query(`
        SELECT reg_no, is_active FROM vehicles
        WHERE reg_no IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378');
      `);
      expect(vehRes.rows.length).toBe(4);
      expect(vehRes.rows.every((v) => v.is_active === true)).toBe(true);

      // 5. Assert ZERO real drivers were touched
      const driverRes = await client.query(`
        SELECT id, is_active FROM drivers
        WHERE id IN (
          'd0000000-0000-0000-0000-000000000001',
          'd0000000-0000-0000-0000-000000000002',
          'd0000000-0000-0000-0000-000000000003',
          'd0000000-0000-0000-0000-000000000004'
        );
      `);
      expect(driverRes.rows.length).toBe(4);
      expect(driverRes.rows.every((d) => d.is_active === true)).toBe(true);

      // 6. Assert sample dummy vehicle was deactivated
      const sampleVehRes = await client.query(`
        SELECT reg_no, is_active FROM vehicles WHERE reg_no = 'KL01BZ4111';
      `);
      expect(sampleVehRes.rows[0].is_active).toBe(false);
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
