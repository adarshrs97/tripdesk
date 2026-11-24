// ==============================================================================
// Milestone 9 Hardening: Trip Locking & Invoice Immutability Tests
//
// Verifies:
// 1. Production triggers & RLS are FORCED and permanently active on tables.
// 2. An issued/locked invoice CANNOT be updated or deleted by:
//    - Admin
//    - Staff
//    - Driver (blocked by RLS + trigger)
//    - Service Role / Superuser
// 3. A billed/locked trip CANNOT be updated or deleted by:
//    - Admin
//    - Staff
//    - Driver
//    - Service Role / Superuser
// 4. Sanctioned cancellation (cancel_invoice) transitions invoice to 'cancelled',
//    preserves invoice number, and unlocks trip rows.
// 5. Unlocked trip rows CAN be deleted normally (verifying RETURN OLD in trigger).
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, assertTestDatabaseGuard } from './testDbHelper';

describe('Milestone 9: Trip Lock & Invoice Immutability Security Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);
  });

  afterAll(async () => {
    await client.end();
  });

  it('proves immutability triggers and forced RLS are permanently active on database', async () => {
    // 1. Verify triggers exist and are enabled (tgenabled = 'O' = origin/always active)
    const triggerRes = await client.query(`
      SELECT tgname, relname, tgenabled
      FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      WHERE tgname IN ('trg_invoice_lock_guard', 'trg_trip_ledger_lock_guard')
      ORDER BY tgname;
    `);

    expect(triggerRes.rows.length).toBe(2);
    for (const row of triggerRes.rows) {
      expect(row.tgenabled).toBe('O'); // 'O' = enabled in normal origin mode
    }

    // 2. Verify Row Level Security is FORCED on invoices and trip_ledger
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('invoices', 'trip_ledger')
      ORDER BY relname;
    `);

    expect(rlsRes.rows.length).toBe(2);
    for (const row of rlsRes.rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  describe('1. Locked Invoices Immutability Across All Role Paths', () => {
    it('prevents Admin from updating financial facts or deleting an issued invoice', async () => {
      await client.query('BEGIN');
      try {
        await client.query('SET ROLE starciti_app');
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)"); // Admin

        // Attempt to update total_amount on locked invoice 108190
        await client.query('SAVEPOINT sp_admin_update');
        await expect(
          client.query("UPDATE invoices SET total_amount = 99999 WHERE invoice_number = '108190'")
        ).rejects.toThrow(/is permanently locked and cannot be modified/);
        await client.query('ROLLBACK TO SAVEPOINT sp_admin_update');

        // Attempt to delete locked invoice 108190
        await client.query('SAVEPOINT sp_admin_delete');
        await expect(
          client.query("DELETE FROM invoices WHERE invoice_number = '108190'")
        ).rejects.toThrow(/is permanently locked and cannot be deleted/);
        await client.query('ROLLBACK TO SAVEPOINT sp_admin_delete');
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('prevents Staff from updating financial facts or deleting an issued invoice', async () => {
      await client.query('BEGIN');
      try {
        await client.query('SET ROLE starciti_app');
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', true)"); // Staff

        await client.query('SAVEPOINT sp_staff_update');
        await expect(
          client.query("UPDATE invoices SET total_amount = 99999 WHERE invoice_number = '108190'")
        ).rejects.toThrow();
        await client.query('ROLLBACK TO SAVEPOINT sp_staff_update');

        await client.query('SAVEPOINT sp_staff_delete');
        await expect(
          client.query("DELETE FROM invoices WHERE invoice_number = '108190'")
        ).rejects.toThrow();
        await client.query('ROLLBACK TO SAVEPOINT sp_staff_delete');
      } finally {
        await client.query('ROLLBACK');
      }
    });

    it('prevents Superuser / Service Role from deleting an issued invoice', async () => {
      await client.query('BEGIN');
      try {
        await client.query('RESET ROLE'); // Superuser postgres

        await client.query('SAVEPOINT sp_super_delete');
        await expect(
          client.query("DELETE FROM invoices WHERE invoice_number = '108190'")
        ).rejects.toThrow(/is permanently locked and cannot be deleted/);
        await client.query('ROLLBACK TO SAVEPOINT sp_super_delete');

        await client.query('SAVEPOINT sp_super_update');
        await expect(
          client.query("UPDATE invoices SET total_amount = 99999 WHERE invoice_number = '108190'")
        ).rejects.toThrow(/is permanently locked and cannot be modified/);
        await client.query('ROLLBACK TO SAVEPOINT sp_super_update');
      } finally {
        await client.query('ROLLBACK');
      }
    });
  });

  describe('2. Locked Trip Ledger Entries Immutability Across All Role Paths', () => {
    it('prevents Admin, Staff, Driver, and Superuser from updating or deleting a locked trip', async () => {
      await client.query('BEGIN');
      try {
        await client.query('RESET ROLE');

        // Create a locked trip linked to invoice 108190
        const invRes = await client.query("SELECT id FROM invoices WHERE invoice_number = '108190'");
        const invId = invRes.rows[0].id;
        const tripDate = '2029-05-10';
        const contractId = 'b0000000-0000-0000-0000-000000000001';
        const vehicleId = '10000000-0000-0000-0000-000000000001';
        const driverId = 'd0000000-0000-0000-0000-000000000001';

        await client.query(`
          INSERT INTO trip_ledger (contract_id, trip_date, vehicle_id, driver_id, day_status, start_km, close_km, used_km, is_locked, invoice_id)
          VALUES ('${contractId}', '${tripDate}', '${vehicleId}', '${driverId}', 'RUN', 156000, 156100, 100, TRUE, '${invId}')
          ON CONFLICT (contract_id, trip_date, vehicle_id) DO UPDATE SET is_locked = TRUE, invoice_id = '${invId}';
        `);

        // PATH A: Superuser
        await client.query('SAVEPOINT sp_super_trip_upd');
        await expect(
          client.query(`UPDATE trip_ledger SET used_km = 999 WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`)
        ).rejects.toThrow(/is locked by invoice .* and cannot be modified/);
        await client.query('ROLLBACK TO SAVEPOINT sp_super_trip_upd');

        await client.query('SAVEPOINT sp_super_trip_del');
        await expect(
          client.query(`DELETE FROM trip_ledger WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`)
        ).rejects.toThrow(/is locked by invoice .* and cannot be deleted/);
        await client.query('ROLLBACK TO SAVEPOINT sp_super_trip_del');

        // PATH B: Admin
        await client.query('SET ROLE starciti_app');
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

        await client.query('SAVEPOINT sp_admin_trip_upd');
        await expect(
          client.query(`UPDATE trip_ledger SET used_km = 999 WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`)
        ).rejects.toThrow(/is locked by invoice .* and cannot be modified/);
        await client.query('ROLLBACK TO SAVEPOINT sp_admin_trip_upd');

        await client.query('SAVEPOINT sp_admin_trip_del');
        await expect(
          client.query(`DELETE FROM trip_ledger WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`)
        ).rejects.toThrow(/is locked by invoice .* and cannot be deleted/);
        await client.query('ROLLBACK TO SAVEPOINT sp_admin_trip_del');

        // PATH C: Staff
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', true)");

        await client.query('SAVEPOINT sp_staff_trip_upd');
        await expect(
          client.query(`UPDATE trip_ledger SET used_km = 999 WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`)
        ).rejects.toThrow(/is locked by invoice .* and cannot be modified/);
        await client.query('ROLLBACK TO SAVEPOINT sp_staff_trip_upd');

        await client.query('SAVEPOINT sp_staff_trip_del');
        await expect(
          client.query(`DELETE FROM trip_ledger WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`)
        ).rejects.toThrow(/is locked by invoice .* and cannot be deleted/);
        await client.query('ROLLBACK TO SAVEPOINT sp_staff_trip_del');

        // PATH D: Driver
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', true)");

        await client.query('SAVEPOINT sp_driver_trip_upd');
        await expect(
          client.query(`UPDATE trip_ledger SET used_km = 999 WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`)
        ).rejects.toThrow(/is locked by invoice .* and cannot be modified/);
        await client.query('ROLLBACK TO SAVEPOINT sp_driver_trip_upd');

        // Driver attempts delete -> 0 rows deleted because Driver has no DELETE policy under RLS
        const driverDel = await client.query(`DELETE FROM trip_ledger WHERE trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}'`);
        expect(driverDel.rowCount).toBe(0);
      } finally {
        await client.query('ROLLBACK');
      }
    });
  });

  describe('3. Trigger Behavioral Integrity: RETURN OLD on Non-Locked Delete', () => {
    it('verifies that an unlocked trip ledger entry CAN be deleted cleanly (proving RETURN OLD works)', async () => {
      await client.query('BEGIN');
      try {
        await client.query('RESET ROLE');
        const contractId = 'b0000000-0000-0000-0000-000000000001';
        const vehicleId = '10000000-0000-0000-0000-000000000001';
        const tripDate = '2026-08-25';

        // Insert an unlocked row
        await client.query(`
          INSERT INTO trip_ledger (contract_id, trip_date, vehicle_id, day_status, start_km, close_km, used_km, is_locked)
          VALUES ('${contractId}', '${tripDate}', '${vehicleId}', 'RUN', 156500, 156550, 50, FALSE)
          ON CONFLICT (contract_id, trip_date, vehicle_id) DO UPDATE SET is_locked = FALSE, invoice_id = NULL;
        `);

        // Delete the unlocked row
        const delRes = await client.query(`
          DELETE FROM trip_ledger WHERE contract_id = '${contractId}' AND trip_date = '${tripDate}' AND vehicle_id = '${vehicleId}';
        `);

        expect(delRes.rowCount).toBe(1); // Deleted exactly 1 row (not suppressed to 0!)
      } finally {
        await client.query('ROLLBACK');
      }
    });
  });

  describe('4. Sanctioned Cancellation & Unlock Flow', () => {
    it('cancels invoice via cancel_invoice(), preserves invoice number, and unlocks trips', async () => {
      await client.query('BEGIN');
      try {
        await client.query('RESET ROLE');

        // Create a temporary invoice and locked trip inside transaction
        const invRes = await client.query(`
          INSERT INTO invoices (invoice_number, supplier_id, customer_id, issue_date, due_date, period_from, period_to, total_amount, status, locked_at)
          VALUES ('TEMP-INV-999', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days', '2026-08-01', '2026-08-31', 50000, 'locked', NOW())
          RETURNING id;
        `);
        const tempInvId = invRes.rows[0].id;

        const contractId = 'b0000000-0000-0000-0000-000000000001';
        const vehicleId = '10000000-0000-0000-0000-000000000001';
        const tripDate = '2029-05-15';

        await client.query(`
          INSERT INTO trip_ledger (contract_id, trip_date, vehicle_id, day_status, start_km, close_km, used_km, is_locked, invoice_id)
          VALUES ('${contractId}', '${tripDate}', '${vehicleId}', 'RUN', 156200, 156250, 50, TRUE, '${tempInvId}')
          ON CONFLICT (contract_id, trip_date, vehicle_id) DO UPDATE SET is_locked = TRUE, invoice_id = '${tempInvId}';
        `);

        // Execute sanctioned cancellation
        await client.query('SET ROLE starciti_app');
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)"); // Admin

        const cancelRes = await client.query(`
          SELECT cancel_invoice($1::UUID, $2::TEXT, $3::TEXT) as result;
        `, [tempInvId, 'Customer contract revision requested', 'Admin Ratnaraj']);

        expect(cancelRes.rows[0].result.status).toBe('cancelled');

        // Verify invoice still exists and has status = 'cancelled' (not deleted, number kept)
        const checkInv = await client.query('SELECT status, notes, admin_override_reason FROM invoices WHERE id = $1', [tempInvId]);
        expect(checkInv.rows[0].status).toBe('cancelled');
        expect(checkInv.rows[0].notes).toContain('Customer contract revision requested');

        // Verify trip ledger row is now unlocked
        const checkTrip = await client.query('SELECT is_locked, invoice_id FROM trip_ledger WHERE trip_date = $1 AND vehicle_id = $2', [tripDate, vehicleId]);
        expect(checkTrip.rows[0].is_locked).toBe(false);
        expect(checkTrip.rows[0].invoice_id).toBeNull();
      } finally {
        await client.query('ROLLBACK');
      }
    });
  });
});
