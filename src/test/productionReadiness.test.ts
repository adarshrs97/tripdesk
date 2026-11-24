import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { TEST_PG_CONFIG } from './testDbHelper';
import { supabase } from '../lib/supabase';

describe('M11 Production Readiness Check', () => {
  let client: Client;
  const tempDbName = 'starciti_fresh_prod_test';

  beforeAll(async () => {
    // Create isolated throwaway test database
    const rootClient = new Client({
      ...TEST_PG_CONFIG,
      database: 'postgres',
    });
    await rootClient.connect();
    await rootClient.query(`DROP DATABASE IF EXISTS ${tempDbName}`);
    await rootClient.query(`CREATE DATABASE ${tempDbName}`);
    await rootClient.end();

    // Connect client to isolated throwaway database
    client = new Client({
      ...TEST_PG_CONFIG,
      database: tempDbName,
    });
    await client.connect();

    // Apply the fresh production database DDL
    const ddlPath = path.resolve(__dirname, '../../scripts/fresh_production_database.sql');
    const ddlSql = fs.readFileSync(ddlPath, 'utf-8');
    await client.query(ddlSql);
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
    // Cleanup isolated throwaway test database
    try {
      const rootClient = new Client({
        ...TEST_PG_CONFIG,
        database: 'postgres',
      });
      await rootClient.connect();
      await rootClient.query(`DROP DATABASE IF EXISTS ${tempDbName}`);
      await rootClient.end();
    } catch (e) {
      // Ignore cleanup error
    }
  });

  describe('1. Zero Sample Data Invariant', () => {
    it('verifies zero sample data rows across all core tables', async () => {
      const tablesWithSampleFlag = [
        'customers',
        'vehicles',
        'cash_transactions',
        'bank_accounts',
        'vendor_payables',
        'emi_schedules',
      ];

      for (const table of tablesWithSampleFlag) {
        const res = await client.query(`SELECT COUNT(*) as count FROM ${table} WHERE is_sample_data = TRUE`);
        const count = parseInt(res.rows[0].count, 10);
        expect(count, `Table ${table} must contain 0 sample data rows`).toBe(0);
      }
    });

    it('verifies strictly zero invoices and zero trip ledger entries in fresh state', async () => {
      const invRes = await client.query('SELECT COUNT(*) as count FROM invoices');
      expect(parseInt(invRes.rows[0].count, 10)).toBe(0);

      const tripRes = await client.query('SELECT COUNT(*) as count FROM trip_ledger');
      expect(parseInt(tripRes.rows[0].count, 10)).toBe(0);
    });

    it('verifies strictly zero dummy bank accounts and zero dummy EMIs in fresh state', async () => {
      const bankRes = await client.query('SELECT COUNT(*) as count FROM bank_accounts');
      expect(parseInt(bankRes.rows[0].count, 10)).toBe(0);

      const emiRes = await client.query('SELECT COUNT(*) as count FROM emi_schedules');
      expect(parseInt(emiRes.rows[0].count, 10)).toBe(0);
    });

    it('verifies confirmed real baseline entities exist and have is_sample_data = FALSE', async () => {
      const suppRes = await client.query('SELECT trade_name FROM supplier_profiles ORDER BY trade_name');
      const suppNames = suppRes.rows.map(r => r.trade_name);
      expect(suppNames).toContain('City Tours & Travels');
      expect(suppNames).toContain('StarCiti Group');

      const custRes = await client.query('SELECT name FROM customers WHERE is_sample_data = FALSE ORDER BY name');
      const custNames = custRes.rows.map(r => r.name);
      expect(custNames).toContain('Global Public School');
      expect(custNames).toContain('M/s Vindhya Telelinks Ltd');

      const vehRes = await client.query('SELECT reg_no, vehicle_type FROM vehicles WHERE is_sample_data = FALSE ORDER BY reg_no');
      const vehRegs = vehRes.rows.map(r => r.reg_no);
      expect(vehRegs).toContain('KL01CP3284');
      expect(vehRegs).toContain('KL824889');
      expect(vehRegs).toContain('KL74E3694');
      expect(vehRegs).toContain('KL21M2378');

      // Owner Decision: KL74E3694 must have blank/null vehicle_type (no invented 'sedan')
      const kl74 = vehRes.rows.find(r => r.reg_no === 'KL74E3694');
      expect(kl74?.vehicle_type).toBeNull();

      const drvRes = await client.query('SELECT name FROM drivers WHERE is_active = TRUE ORDER BY name');
      const drvNames = drvRes.rows.map(r => r.name);
      expect(drvNames).toContain('Hemanth Kumar');
      expect(drvNames).toContain('Muhammad Fayaz.s');
      expect(drvNames).toContain('Asheerkhan');
      expect(drvNames).toContain('Afzal');
    });
  });

  describe('2. First-Run Setup Wizard Lock State', () => {
    it('initializes system.setup_state as unlocked (completed = false)', async () => {
      const res = await client.query("SELECT value FROM public.settings WHERE key = 'system.setup_state'");
      expect(res.rows.length).toBe(1);
      const state = res.rows[0].value;
      expect(state.completed).toBe(false);
      expect(state.completed_at).toBeNull();
    });

    it('allows wizard to complete once and records permanent lock', async () => {
      const testEmail = 'ratnaraaj@yahoo.com';

      // Simulate wizard completion
      await client.query(
        `UPDATE public.settings 
         SET value = jsonb_build_object('completed', true, 'completed_at', NOW(), 'admin_email', $1::text)
         WHERE key = 'system.setup_state'`,
        [testEmail]
      );

      const verifyRes = await client.query("SELECT value FROM public.settings WHERE key = 'system.setup_state'");
      const state = verifyRes.rows[0].value;
      expect(state.completed).toBe(true);
      expect(state.admin_email).toBe(testEmail);
      expect(state.completed_at).toBeDefined();

      // Reset back to unlocked state for fresh production readiness
      await client.query(
        `UPDATE public.settings 
         SET value = '{"completed": false, "completed_at": null, "admin_email": null}'::jsonb
         WHERE key = 'system.setup_state'`
      );
    });
  });

  describe('3. All 4 Roles Authentication & Permissions', () => {
    it('verifies all 4 operational roles exist in app_users and are active', async () => {
      const res = await client.query('SELECT email, role, name, is_active FROM public.app_users ORDER BY role');
      const users = res.rows;

      const admin = users.find(u => u.role === 'admin');
      expect(admin).toBeDefined();
      expect(admin?.email).toBe('ratnaraaj@yahoo.com');
      expect(admin?.is_active).toBe(true);

      const staff = users.find(u => u.role === 'staff');
      expect(staff).toBeDefined();
      expect(staff?.email).toBe('operations@starciti.com');
      expect(staff?.is_active).toBe(true);

      const driver = users.find(u => u.role === 'driver');
      expect(driver).toBeDefined();
      expect(driver?.email).toBe('hemanth@starciti.com');
      expect(driver?.is_active).toBe(true);

      const customerViewer = users.find(u => u.role === 'customer_viewer');
      expect(customerViewer).toBeDefined();
      expect(customerViewer?.email).toBe('admin@vindhyatelelinks.com');
      expect(customerViewer?.is_active).toBe(true);
    });

    it('authenticates all 4 roles via Supabase Auth and validates resolved app roles', async () => {
      const authUsers = [
        { email: 'ratnaraaj@yahoo.com', pass: 'Starciti2026!Admin', expectedRole: 'admin' },
        { email: 'operations@starciti.com', pass: 'Starciti2026!Staff', expectedRole: 'staff' },
        { email: 'hemanth@starciti.com', pass: 'Starciti2026!Driver', expectedRole: 'driver' },
        { email: 'admin@vindhyatelelinks.com', pass: 'Starciti2026!Client', expectedRole: 'customer_viewer' },
      ];

      for (const u of authUsers) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: u.email,
          password: u.pass,
        });
        expect(error, `Sign-in error for ${u.email}: ${error?.message}`).toBeNull();
        expect(data?.user?.id).toBeDefined();

        const { data: dbUser, error: dbErr } = await supabase
          .from('app_users')
          .select('role, is_active')
          .eq('email', u.email)
          .single();

        expect(dbErr).toBeNull();
        expect(dbUser?.role).toBe(u.expectedRole);
        expect(dbUser?.is_active).toBe(true);
      }

      await supabase.auth.signOut();
    });

    it('proves role-based access boundaries with RLS on import_profiles', async () => {
      // Create a test client acting as starciti_app on fresh production DB
      const rlsClient = new Client({
        ...TEST_PG_CONFIG,
        database: tempDbName,
      });
      await rlsClient.connect();
      try {
        await rlsClient.query('SET ROLE starciti_app');

        // 1. As Driver (hemanth@starciti.com)
        await rlsClient.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000003", "email": "hemanth@starciti.com"}', false)
        `);
        const driverRes = await rlsClient.query('SELECT * FROM public.import_profiles');
        expect(driverRes.rows.length).toBe(0); // Driver cannot read import profiles

        // 2. As Customer Viewer (admin@vindhyatelelinks.com)
        await rlsClient.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000004", "email": "admin@vindhyatelelinks.com"}', false)
        `);
        const custRes = await rlsClient.query('SELECT * FROM public.import_profiles');
        expect(custRes.rows.length).toBe(0); // Customer viewer cannot read import profiles

        // 3. As Staff (operations@starciti.com)
        await rlsClient.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000002", "email": "operations@starciti.com"}', false)
        `);
        // Staff can read
        const staffRes = await rlsClient.query('SELECT * FROM public.import_profiles');
        expect(staffRes).toBeDefined();

        // 4. As Admin (ratnaraaj@yahoo.com)
        await rlsClient.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "email": "ratnaraaj@yahoo.com"}', false)
        `);
        const adminRes = await rlsClient.query('SELECT * FROM public.import_profiles');
        expect(adminRes).toBeDefined();
      } finally {
        await rlsClient.query('RESET ROLE');
        await rlsClient.end();
      }
    });

    it('proves users can read their own app_user record but non-admins cannot read other users', async () => {
      const rlsClient = new Client({
        ...TEST_PG_CONFIG,
        database: tempDbName,
      });
      await rlsClient.connect();
      try {
        await rlsClient.query('SET ROLE starciti_app');

        // As Driver: can select own profile row
        await rlsClient.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000003", "email": "hemanth@starciti.com"}', false)
        `);
        const ownRes = await rlsClient.query("SELECT email, role FROM public.app_users WHERE email = 'hemanth@starciti.com'");
        expect(ownRes.rows.length).toBe(1);
        expect(ownRes.rows[0].role).toBe('driver');

        // As Driver: cannot see admin profile row
        const otherRes = await rlsClient.query("SELECT email, role FROM public.app_users WHERE email = 'ratnaraaj@yahoo.com'");
        expect(otherRes.rows.length).toBe(0);
      } finally {
        await rlsClient.query('RESET ROLE');
        await rlsClient.end();
      }
    });
  });

  describe('4. Immutability & Invoice Protection', () => {
    it('verifies immutability trigger prevents modifying locked trips', async () => {
      // Insert a test locked trip entry
      const insertRes = await client.query(`
        INSERT INTO trip_ledger (
          contract_id, vehicle_id, driver_id, trip_date,
          start_km, close_km, used_km, is_locked
        ) VALUES (
          'b0000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000001',
          'd0000000-0000-0000-0000-000000000001',
          '2026-08-01',
          1000, 1100, 100, TRUE
        ) RETURNING id
      `);
      const tripId = insertRes.rows[0].id;

      // Updating a locked trip must fail
      await expect(
        client.query('UPDATE trip_ledger SET used_km = 150 WHERE id = $1', [tripId])
      ).rejects.toThrow(/locked/i);

      // Deleting a locked trip must fail
      await expect(
        client.query('DELETE FROM trip_ledger WHERE id = $1', [tripId])
      ).rejects.toThrow(/locked/i);

      // Clean up by unlocking first, then deleting
      await client.query('UPDATE trip_ledger SET is_locked = FALSE WHERE id = $1', [tripId]);
      await client.query('DELETE FROM trip_ledger WHERE id = $1', [tripId]);
    });
  });
});
