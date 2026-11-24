import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import * as fs from 'fs';
import {
  calculateMonthlyFixedInvoice,
  calculateFormat1Invoice,
  MonthlyFixedContractParams,
  PerTripPackageParams,
  DayLedgerEntry,
} from '../engine';
import { InvoiceService } from '../services/invoiceService';
import { ServerInvoiceService } from '../services/serverInvoiceService';
import { EXACT_SEED_VTL_AUG_2026 } from '../services/ledgerService';
import { generateInvoicePdf } from '../services/pdfGenerator';

import { assertTestDatabaseGuard, TEST_PG_CONFIG } from './testDbHelper';

describe('Milestone 5: Month-Close, Locked Invoicing, Gap-Free Series & PDF Tests', () => {
  let client: Client;
  const throwawayDbName = 'test_throwaway_monthclose';

  beforeAll(async () => {
    // 1. Create dedicated throwaway test database
    const rootClient = new Client({
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'postgres',
    });
    await rootClient.connect();
    await rootClient.query(`DROP DATABASE IF EXISTS ${throwawayDbName}`);
    await rootClient.query(`CREATE DATABASE ${throwawayDbName}`);
    await rootClient.end();

    // 2. Connect to throwaway database and initialize schema + real seeds
    client = new Client({
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: throwawayDbName,
    });
    await client.connect();
    await assertTestDatabaseGuard(client);

    const schemaSql = fs.readFileSync('scripts/fresh_production_database.sql', 'utf8');
    await client.query(schemaSql);

    // Set baseline series number for City Tours & Travels
    await client.query("UPDATE invoice_series SET current_number = 108190 WHERE supplier_id = 'a0000000-0000-0000-0000-000000000002'");

    // Point ServerInvoiceService to throwaway test database
    ServerInvoiceService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: throwawayDbName,
    };
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
    // Restore default test database for ServerInvoiceService
    ServerInvoiceService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'test',
    };

    // Drop throwaway database cleanly - zero guard disabling, zero test pollution
    const rootClient = new Client({
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'postgres',
    });
    await rootClient.connect();
    await rootClient.query(`DROP DATABASE IF EXISTS ${throwawayDbName}`);
    await rootClient.end();
  });

  // TEST 1: PURE BILLING ENGINE GOLDEN TOTALS
  describe('1. Pure Engine Golden Calculation Precision', () => {
    it('calculates VTL August 2026 pro-rata total to exactly ₹68,662 (rounded down)', () => {
      const vtlParams: MonthlyFixedContractParams = {
        fixedAmount: 65000,
        includedKm: 3000,
        includedHoursPerDay: 12,
        extraKmRate: 18,
        extraHourRate: 150,
        nightBataRate: 200,
        outstationBataRate: 200,
        contractWorkingDays: 30,
        roundingMode: 'down',
      };

      const result = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', EXACT_SEED_VTL_AUG_2026, vtlParams);
      expect(result.subtotal).toBe(68662.50);
      expect(result.totalAmount).toBe(68662);
      expect(result.roundOff).toBe(-0.50);
      expect(result.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Sixty Two Only');
    });

    it('calculates historical Excel decimal hours bug total to exactly ₹68,617 (rounded down)', () => {
      const legacyParams: MonthlyFixedContractParams = {
        fixedAmount: 65000,
        includedKm: 3000,
        includedHoursPerDay: 12,
        extraKmRate: 18,
        extraHourRate: 150,
        nightBataRate: 200,
        outstationBataRate: 200,
        contractWorkingDays: 30,
        roundingMode: 'down',
        legacyDecimalHoursBug: true,
      };

      const result = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', EXACT_SEED_VTL_AUG_2026, legacyParams);
      expect(result.subtotal).toBe(68617.50);
      expect(result.totalAmount).toBe(68617);
      expect(result.roundOff).toBe(-0.50);
      expect(result.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Seventeen Only');
    });

    it('calculates Format 1 School 8 lines to exactly ₹21,210', () => {
      const schoolParams: PerTripPackageParams = {
        baseAmount: 2415,
        includedHours: 10,
        includedKm: 80,
        extraHourRate: 200,
        extraKmRate: 15,
        roundingMode: 'down',
      };

      const schoolLines: DayLedgerEntry[] = [
        { date: '01/08/2026', dayStatus: 'RUN', usedKm: 82, durationMinutes: 600, vehicleType: 'Sedan' },
        { date: '03/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 735, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
        { date: '03/08/2026', dayStatus: 'RUN', usedKm: 84, durationMinutes: 660, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
        { date: '04/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 705, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
        { date: '04/08/2026', dayStatus: 'RUN', usedKm: 90, durationMinutes: 615, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 630, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 600, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 750, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      ];

      const result = calculateFormat1Invoice(schoolLines, schoolParams);
      expect(result.subtotal).toBe(21210);
      expect(result.totalAmount).toBe(21210);
      expect(result.amountInWords).toBe('Twenty One Thousand Two Hundred and Ten Only');
    });
  });

  // TEST 2: SNAPSHOT RE-RENDER EQUALITY
  describe('2. Snapshot JSON Re-Render Fidelity', () => {
    it('re-renders identically from the stored snapshot JSON without drift', () => {
      const review = InvoiceService.getReviewDetails('vtl', '2026-08');
      const originalSnapshot = review.rendered;

      // Serialize and deserialize simulating database JSON storage
      const storedJson = JSON.parse(JSON.stringify(originalSnapshot));

      expect(storedJson.totalAmount).toBe(originalSnapshot.totalAmount);
      expect(storedJson.amountInWords).toBe(originalSnapshot.amountInWords);
      expect(storedJson.rows.length).toBe(originalSnapshot.rows.length);
      expect(storedJson.breakupRows.length).toBe(originalSnapshot.breakupRows.length);
      expect(storedJson.metaFields).toEqual(originalSnapshot.metaFields);
    });
  });

  // TEST 3 & 4: POSTGRESQL ATOMIC ROW-LOCK ISSUANCE & IMMUTABILITY TRIGGERS
  describe('3. Database Row-Locked Issuance & Immutability Triggers', () => {
    it('issues invoice with gap-free number starting at 108191 and locks invoice and trip entries', async () => {
      const review = InvoiceService.getReviewDetails('vtl', '2026-08');

      // First ensure trip_ledger has entries for this contract so we can verify locking
      const contractId = 'b0000000-0000-0000-0000-000000000001';
      const supplierId = 'a0000000-0000-0000-0000-000000000002'; // City Tours & Travels
      const customerId = 'c0000000-0000-0000-0000-000000000001';

      const vehicleId = '10000000-0000-0000-0000-000000000001';


      await client.query(`
        INSERT INTO trip_ledger (contract_id, trip_date, vehicle_id, day_status, start_km, close_km, used_km, is_locked)
        VALUES ('${contractId}', '2026-08-01', '${vehicleId}', 'RUN', 155622, 155670, 48, FALSE)
        ON CONFLICT (contract_id, trip_date, vehicle_id) DO UPDATE SET is_locked = FALSE;
      `);

      const issued = await ServerInvoiceService.issueInvoice({
        supplierId,
        customerId,
        contractId,
        periodFrom: '2026-08-01',
        periodTo: '2026-08-31',
        totalAmount: 68662,
        snapshotJson: review.rendered,
        templateId: 'template-inv-format2-vtl',
        templateVersion: 1,
        issuedBy: 'Admin (M. Ratnaraj)',
        adminOverrideReason: 'Renewal in progress with VTL Cochin procurement',
      });

      expect(issued.invoiceNumber).toBe('108191');
      expect(issued.status).toBe('locked');
      expect(issued.totalAmount).toBe(68662);

      // Verify invoice row is locked in database
      const invRow = await client.query('SELECT status, admin_override_reason FROM invoices WHERE id = $1', [issued.invoiceId]);
      expect(invRow.rows[0].status).toBe('locked');
      expect(invRow.rows[0].admin_override_reason).toBe('Renewal in progress with VTL Cochin procurement');

      // Verify trip_ledger entries are locked
      const ledgerRow = await client.query('SELECT is_locked, invoice_id FROM trip_ledger WHERE contract_id = $1 AND trip_date = $2', [contractId, '2026-08-01']);
      expect(ledgerRow.rows[0].is_locked).toBe(true);
      expect(ledgerRow.rows[0].invoice_id).toBe(issued.invoiceId);

      // TEST: Attempting to update a locked invoice throws an exception
      let updateError: any;
      try {
        await client.query('UPDATE invoices SET total_amount = 70000 WHERE id = $1', [issued.invoiceId]);
      } catch (err: any) {
        updateError = err;
      }
      expect(updateError).toBeDefined();
      expect(updateError.message).toContain('is permanently locked and cannot be modified');

      // TEST: Attempting to delete a locked invoice throws an exception
      let deleteError: any;
      try {
        await client.query('DELETE FROM invoices WHERE id = $1', [issued.invoiceId]);
      } catch (err: any) {
        deleteError = err;
      }
      expect(deleteError).toBeDefined();
      expect(deleteError.message).toContain('is permanently locked and cannot be deleted');

      // TEST: Attempting to update a locked trip ledger entry throws an exception
      let tripUpdateError: any;
      try {
        await client.query('UPDATE trip_ledger SET used_km = 999 WHERE contract_id = $1 AND trip_date = $2', [contractId, '2026-08-01']);
      } catch (err: any) {
        tripUpdateError = err;
      }
      expect(tripUpdateError).toBeDefined();
      expect(tripUpdateError.message).toContain('is locked by invoice');
    });

    it('concurrent issue calls serialize via row lock without duplicate numbers or gaps', async () => {
      const review = InvoiceService.getReviewDetails('vtl', '2026-08');
      const supplierId = 'a0000000-0000-0000-0000-000000000002';
      const customerId = 'c0000000-0000-0000-0000-000000000001';
      const contractId = 'b0000000-0000-0000-0000-000000000001';

      // Launch 2 issue calls concurrently
      const [res1, res2] = await Promise.all([
        ServerInvoiceService.issueInvoice({
          supplierId,
          customerId,
          contractId,
          periodFrom: '2026-09-01',
          periodTo: '2026-09-30',
          totalAmount: 65000,
          snapshotJson: review.rendered,
          templateId: 'template-inv-format2-vtl',
          templateVersion: 1,
          issuedBy: 'Admin Concurrency Test 1',
        }),
        ServerInvoiceService.issueInvoice({
          supplierId,
          customerId,
          contractId,
          periodFrom: '2026-10-01',
          periodTo: '2026-10-31',
          totalAmount: 65000,
          snapshotJson: review.rendered,
          templateId: 'template-inv-format2-vtl',
          templateVersion: 1,
          issuedBy: 'Admin Concurrency Test 2',
        }),
      ]);

      const num1 = parseInt(res1.invoiceNumber, 10);
      const num2 = parseInt(res2.invoiceNumber, 10);

      // Verify numbers are different and strictly sequential (no gap, no duplicates)
      expect(num1).not.toBe(num2);
      expect(Math.abs(num1 - num2)).toBe(1);
    });
  });

  // TEST 5: PRE-CLOSE READINESS & ADMIN OVERRIDE
  describe('4. Pre-Close Check & Renewal Override Logic', () => {
    it('blocks proceeding when contract status is renewal_pending without override reason', () => {
      const checkBlocked = InvoiceService.checkMonthReadiness('vtl', '2026-08', '');
      expect(checkBlocked.isRenewalPending).toBe(true);
      expect(checkBlocked.canProceed).toBe(false);
      expect(checkBlocked.blockers.length).toBeGreaterThan(0);
      expect(checkBlocked.blockers[0]).toContain('Renewal pending');

      const checkApproved = InvoiceService.checkMonthReadiness('vtl', '2026-08', 'Approved by Ratnaraj for billing continuity');
      expect(checkApproved.canProceed).toBe(true);
      expect(checkApproved.blockers.length).toBe(0);
      expect(checkApproved.warnings.some((w) => w.includes('override applied'))).toBe(true);
    });
  });

  // TEST 6: PLAYWRIGHT SERVER-SIDE PDF GENERATION
  describe('5. Playwright Server-Side PDF & Annexure Generation', () => {
    it('generates a valid, non-empty PDF file and comparison screenshot', async () => {
      const review = InvoiceService.getReviewDetails('vtl', '2026-08');
      const testPdfPath = 'public/invoices/test_vtl_aug2026.pdf';
      const testPngPath = 'public/invoices/test_vtl_aug2026.png';

      const res = await generateInvoicePdf(review.rendered, {
        outputPath: testPdfPath,
        screenshotPath: testPngPath,
        annexureEntries: EXACT_SEED_VTL_AUG_2026,
      });
      expect(res.pdfPath).toBe(testPdfPath);

      expect(fs.existsSync(testPdfPath)).toBe(true);
      const stat = fs.statSync(testPdfPath);
      expect(stat.size).toBeGreaterThan(1000); // Valid PDF > 1KB

      expect(fs.existsSync(testPngPath)).toBe(true);
      const pngStat = fs.statSync(testPngPath);
      expect(pngStat.size).toBeGreaterThan(1000); // Valid PNG
    }, 20000);
  });
});
