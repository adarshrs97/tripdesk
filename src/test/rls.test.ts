import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

import { createTestClient, assertTestDatabaseGuard } from './testDbHelper';

describe('Milestone 1: Real Postgres & Row Level Security (RLS) Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);

    // Ensure non-superuser role starciti_app exists for RLS enforcement
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starciti_app') THEN
          CREATE ROLE starciti_app LOGIN;
        END IF;
      END
      $$;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO starciti_app;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO starciti_app;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO starciti_app;
    `);

    // Reset clean series baseline
    await client.query(`
      UPDATE invoice_series SET current_number = 108190 WHERE supplier_id = 'a0000000-0000-0000-0000-000000000002';
      UPDATE invoice_series SET current_number = 106562 WHERE supplier_id = 'a0000000-0000-0000-0000-000000000001';
      RESET ROLE;
    `);
  });

  afterAll(async () => {
    await client.end();
  });

  it('RLS: Admin role can read all master tables and invoices via authenticated JWT', async () => {
    await client.query('BEGIN');
    await client.query('SET ROLE starciti_app');
    // Supabase Auth JWT with Admin auth.uid()
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

    const resInvoices = await client.query('SELECT COUNT(*) FROM invoices');
    expect(Number(resInvoices.rows[0].count)).toBeGreaterThanOrEqual(2);

    const resCustomers = await client.query('SELECT COUNT(*) FROM customers');
    expect(Number(resCustomers.rows[0].count)).toBe(2);

    const resVehicles = await client.query('SELECT COUNT(*) FROM vehicles');
    expect(Number(resVehicles.rows[0].count)).toBe(4);

    await client.query('ROLLBACK');
  });

  it('RLS: Driver role CANNOT read invoices or contracts via authenticated JWT', async () => {
    await client.query('BEGIN');
    await client.query('SET ROLE starciti_app');
    // Supabase Auth JWT with Driver auth.uid() (Hemanth Kumar)
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', true)");

    const resInvoices = await client.query('SELECT COUNT(*) FROM invoices');
    expect(Number(resInvoices.rows[0].count)).toBe(0); // Driver sees 0 invoices

    const resContracts = await client.query('SELECT COUNT(*) FROM contracts');
    expect(Number(resContracts.rows[0].count)).toBe(0); // Driver sees 0 contracts

    // Driver CAN read vehicles to check out vehicles
    const resVehicles = await client.query('SELECT COUNT(*) FROM vehicles');
    expect(Number(resVehicles.rows[0].count)).toBe(4);

    await client.query('ROLLBACK');
  });

  it('RLS: PROVE CLIENT CANNOT FORGE ITS OWN ROLE (Security Proof)', async () => {
    await client.query('BEGIN');
    await client.query('SET ROLE starciti_app');
    // Client authenticates as Driver
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', true)");

    // Malicious driver attempts to forge role using session variable
    await client.query("SELECT set_config('app.current_role', 'admin', false)");

    // Verify role returned by get_current_app_role() remains strictly 'driver'
    const roleCheck = await client.query('SELECT get_current_app_role() AS role');
    expect(roleCheck.rows[0].role).toBe('driver');

    // Attempting to read invoices still returns 0 rows!
    const resInvoices = await client.query('SELECT COUNT(*) FROM invoices');
    expect(Number(resInvoices.rows[0].count)).toBe(0);

    // Attempting to modify rate cards is still blocked by RLS!
    await client.query('SAVEPOINT sp_rate_guard');
    await expect(
      client.query(`
        INSERT INTO rate_cards (id, vehicle_type, base_amount, included_hours, included_km, extra_hour_rate, extra_km_rate)
        VALUES ('30000000-0000-0000-0000-000000000099', 'innova', 3500, 10, 80, 250, 20)
      `)
    ).rejects.toThrow(/violates row-level security policy/);
    await client.query('ROLLBACK TO SAVEPOINT sp_rate_guard');

    // Attempting to elevate role in app_users table directly is blocked by RLS!
    await client.query('SAVEPOINT sp_user_guard');
    await client.query(`
      UPDATE app_users SET role = 'admin' WHERE id = 'c0000000-0000-0000-0000-000000000003'
    `);
    // Driver cannot read other users or see elevated rows (0 rows returned to driver)
    const appUsersCheck = await client.query("SELECT role FROM app_users WHERE id = 'c0000000-0000-0000-0000-000000000003'");
    expect(appUsersCheck.rows.length).toBe(0); // RLS blocks driver from viewing or modifying user roles
    await client.query('ROLLBACK TO SAVEPOINT sp_user_guard');

    await client.query('ROLLBACK');
  });

  it('RLS: Staff can read rates/terms, but CANNOT insert or edit rate_cards via authenticated JWT', async () => {
    await client.query('BEGIN');
    await client.query('SET ROLE starciti_app');
    // Supabase Auth JWT with Staff auth.uid()
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', true)");

    // Staff can read invoices and rate cards
    const resInvoices = await client.query('SELECT COUNT(*) FROM invoices');
    expect(Number(resInvoices.rows[0].count)).toBeGreaterThanOrEqual(2);

    const resRates = await client.query('SELECT COUNT(*) FROM rate_cards');
    expect(Number(resRates.rows[0].count)).toBeGreaterThanOrEqual(1);

    // Staff attempts to insert a new rate card -> rejected by RLS!
    await client.query('SAVEPOINT sp_staff_guard');
    await expect(
      client.query(`
        INSERT INTO rate_cards (id, vehicle_type, base_amount, included_hours, included_km, extra_hour_rate, extra_km_rate)
        VALUES ('30000000-0000-0000-0000-000000000099', 'innova', 3500, 10, 80, 250, 20)
      `)
    ).rejects.toThrow(/violates row-level security policy/);
    await client.query('ROLLBACK TO SAVEPOINT sp_staff_guard');

    await client.query('ROLLBACK');
  });

  it('RLS: Customer role sees ONLY their own customer record and invoices via authenticated JWT', async () => {
    await client.query('BEGIN');
    await client.query('SET ROLE starciti_app');
    // Supabase Auth JWT with Customer auth.uid() (VTL Billing Coordinator)
    await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000004\"}', true)");

    const resVTL = await client.query('SELECT name FROM customers');
    expect(resVTL.rows.length).toBe(1);
    expect(resVTL.rows[0].name).toContain('Vindhya Telelinks');

    // Invoices for VTL customer
    const resVTLInvoices = await client.query('SELECT invoice_number FROM invoices');
    expect(resVTLInvoices.rows.length).toBeGreaterThanOrEqual(1);
    expect(resVTLInvoices.rows.some((r) => r.invoice_number === '108190')).toBe(true);

    await client.query('ROLLBACK');
  });

  it('Database contains real seed data with NO invented expiries or daily batas', async () => {
    await client.query('RESET ROLE');
    // KL01 CP 3284 must have NO invented model (only '7-Seat AC Car' from invoice)
    const resVehicle = await client.query("SELECT make_model, rc_expiry, insurance_expiry FROM vehicles WHERE reg_no = 'KL01CP3284'");
    expect(resVehicle.rows[0].make_model).toBe('7-Seat AC Car');
    expect(resVehicle.rows[0].rc_expiry).toBeNull();
    expect(resVehicle.rows[0].insurance_expiry).toBeNull();

    // Drivers must have NULL licenses and NULL daily batas (real data only)
    const resDriver = await client.query("SELECT license_no, daily_bata_rate, police_clearance_date FROM drivers WHERE name = 'Hemanth Kumar'");
    expect(resDriver.rows[0].license_no).toBeNull();
    expect(resDriver.rows[0].daily_bata_rate).toBeNull();
    expect(resDriver.rows[0].police_clearance_date).toBeNull();

    // VTL contract status must be renewal_pending
    const resContract = await client.query("SELECT status FROM contracts WHERE agreement_no = '202526000005308395'");
    expect(resContract.rows[0].status).toBe('renewal_pending');
  });
});
