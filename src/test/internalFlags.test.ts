import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';
import {
  InternalFlag,
  filterActiveFlags,
  hasAvoidFlag,
  hasCautionFlag,
  evaluateDispatchSuitability,
  sanitizeCustomerPayload,
} from '../engine/flags';
import { ServerFlagsService } from '../services/serverFlagsService';
import { ServerInvoiceService } from '../services/serverInvoiceService';
import { ServerPaymentService } from '../services/serverPaymentService';
import { PaymentService } from '../services/paymentService';
import { InvoiceService } from '../services/invoiceService';
import { generateInvoicePdf, generateInvoiceHtml } from '../services/pdfGenerator';
import { createTestClient, assertTestDatabaseGuard, TEST_PG_CONFIG } from './testDbHelper';

describe('Milestone 7c: Internal Notes & Flags (Severity, Resurfacing, Zero-Leakage & RLS)', () => {
  let client: Client;

  // Real test user IDs from app_users
  const adminUserId = 'c0000000-0000-0000-0000-000000000001'; // Ratnaraj (admin)
  const staffUserId = 'c0000000-0000-0000-0000-000000000002'; // Staff
  const hemanthDriverUserId = 'c0000000-0000-0000-0000-000000000003'; // Driver Hemanth
  const customerUserId = 'c0000000-0000-0000-0000-000000000004'; // Customer Viewer

  // Real seeded entity IDs
  const hemanthDriverId = 'd0000000-0000-0000-0000-000000000001';
  const kl01VehicleId = '10000000-0000-0000-0000-000000000001';
  const vtlCustomerId = 'c0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);

    ServerFlagsService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'test',
    };

    ServerInvoiceService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'test',
    };

    ServerPaymentService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'test',
    };

    await client.query(`
      GRANT ALL PRIVILEGES ON TABLE internal_flags TO starciti_app;
    `);
  });

  afterAll(async () => {
    // Clean up temporary flags created during tests
    await client.query("DELETE FROM internal_flags WHERE title LIKE 'TEST_%'");
    await client.end();
  });

  // 1. PURE ENGINE TESTS
  describe('1. Pure Flag Engine & Dispatch Suitability', () => {
    const sampleFlags: InternalFlag[] = [
      {
        id: 'f-1',
        entityType: 'driver',
        entityId: 'd-001',
        severity: 'note',
        title: 'VIP airport specialist',
        description: 'Punctual, fluent in English.',
        isActive: true,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
      {
        id: 'f-2',
        entityType: 'driver',
        entityId: 'd-002',
        severity: 'avoid',
        title: 'Suspended from school duty',
        description: 'Customer complaint regarding rash driving; barred from school routes.',
        isActive: true,
        createdAt: '2026-08-05T00:00:00Z',
        updatedAt: '2026-08-05T00:00:00Z',
      },
      {
        id: 'f-3',
        entityType: 'vehicle',
        entityId: 'v-001',
        severity: 'caution',
        title: 'Rear AC airflow weak',
        description: 'Check before allocating to corporate full-capacity trips.',
        isActive: true,
        createdAt: '2026-08-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z',
      },
      {
        id: 'f-4',
        entityType: 'vehicle',
        entityId: 'v-002',
        severity: 'avoid',
        title: 'Major gearbox shudder',
        description: 'Do not dispatch until fitness inspection completed at workshop.',
        isActive: false, // Resolved flag
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-15T00:00:00Z',
      },
    ];

    it('correctly filters active flags for an entity and ignores resolved flags', () => {
      const activeForD1 = filterActiveFlags(sampleFlags, 'driver', 'd-001');
      expect(activeForD1.length).toBe(1);
      expect(activeForD1[0].severity).toBe('note');

      // v-002 has an 'avoid' flag, but isActive is false -> should not be returned
      const activeForV2 = filterActiveFlags(sampleFlags, 'vehicle', 'v-002');
      expect(activeForV2.length).toBe(0);
    });

    it('detects avoid and caution flags correctly', () => {
      const activeD2Flags = filterActiveFlags(sampleFlags, 'driver', 'd-002');
      expect(hasAvoidFlag(activeD2Flags)).toBe(true);
      expect(hasCautionFlag(activeD2Flags)).toBe(false);

      const activeV1Flags = filterActiveFlags(sampleFlags, 'vehicle', 'v-001');
      expect(hasAvoidFlag(activeV1Flags)).toBe(false);
      expect(hasCautionFlag(activeV1Flags)).toBe(true);
    });

    it('evaluates dispatch suitability: flags "avoid" as requiring admin override with written reason (not unconditional block)', () => {
      const driverFlags = filterActiveFlags(sampleFlags, 'driver', 'd-002'); // avoid
      const vehicleFlags = filterActiveFlags(sampleFlags, 'vehicle', 'v-001'); // caution

      // 1. Without admin override -> assignment is blocked and requires admin justification
      const blockedResult = evaluateDispatchSuitability(driverFlags, vehicleFlags);
      expect(blockedResult.isAllowed).toBe(false);
      expect(blockedResult.hasAvoid).toBe(true);
      expect(blockedResult.requiresAdminOverride).toBe(true);
      expect(blockedResult.isOverridden).toBe(false);
      expect(blockedResult.blockReasons[0]).toContain('DRIVER AVOID');
      expect(blockedResult.blockReasons[0]).toContain('rash driving');
      expect(blockedResult.blockReasons[1]).toContain('Administrator override with written justification is mandatory');

      // 2. With written admin override -> assignment is permitted and override notice is logged
      const overriddenResult = evaluateDispatchSuitability(driverFlags, vehicleFlags, {
        user: 'Ratnaraj (Admin)',
        reason: 'Emergency replacement driver authorized for day route under senior supervisor escort',
      });
      expect(overriddenResult.isAllowed).toBe(true);
      expect(overriddenResult.hasAvoid).toBe(true);
      expect(overriddenResult.requiresAdminOverride).toBe(false);
      expect(overriddenResult.isOverridden).toBe(true);
      expect(overriddenResult.overrideNotice).toContain('Overridden by Administrator (Ratnaraj (Admin))');
      expect(overriddenResult.overrideNotice).toContain('Emergency replacement driver authorized');
      expect(overriddenResult.warningMessages.length).toBe(1);
    });

    it('evaluates dispatch suitability: permits assignment with caution warnings when no avoid flags exist', () => {
      const driverFlags = filterActiveFlags(sampleFlags, 'driver', 'd-001'); // note
      const vehicleFlags = filterActiveFlags(sampleFlags, 'vehicle', 'v-001'); // caution

      const result = evaluateDispatchSuitability(driverFlags, vehicleFlags);
      expect(result.isAllowed).toBe(true);
      expect(result.hasAvoid).toBe(false);
      expect(result.hasCaution).toBe(true);
      expect(result.blockReasons.length).toBe(0);
      expect(result.warningMessages.length).toBe(1);
      expect(result.operationalNotes.length).toBe(1);
    });

    it('ZERO-LEAKAGE GUARANTEE: sanitizeCustomerPayload strips any internal operational flags', () => {
      const customerDocument = {
        invoiceNumber: '108191',
        customerName: 'M/s Vindhya Telelinks Limited',
        totalAmount: 68662,
        internal_flags: [
          { title: 'Factory gate pass required', severity: 'caution' },
        ],
        internalFlags: [
          { title: 'Payment reminder notes', severity: 'note' },
        ],
        items: [
          { description: 'Monthly Fixed AC Vehicle - Aug 2026', amount: 65000 },
        ],
      };

      const sanitized = sanitizeCustomerPayload(customerDocument);
      expect(sanitized.invoiceNumber).toBe('108191');
      expect((sanitized as any).internal_flags).toBeUndefined();
      expect((sanitized as any).internalFlags).toBeUndefined();
      expect(sanitized.items.length).toBe(1);
    });
  });

  // 2. DATABASE WORKFLOW & CRUD
  describe('2. Database Storage, Resolution Lifecycle & Resurfacing', () => {
    let createdFlagId: string;

    it('creates an internal operational flag linked to a vehicle with staff role', async () => {
      const flag = await ServerFlagsService.createFlag(staffUserId, {
        entityType: 'vehicle',
        entityId: kl01VehicleId,
        severity: 'caution',
        title: 'TEST_Rear AC Blower Weak',
        description: 'Rear third-row vents blow warm air during afternoon peak. Scheduled for workshop inspection.',
      });

      expect(flag.id).toBeDefined();
      expect(flag.severity).toBe('caution');
      expect(flag.isActive).toBe(true);
      createdFlagId = flag.id;

      // Verify in test database
      const dbRow = await client.query('SELECT * FROM internal_flags WHERE id = $1', [flag.id]);
      expect(dbRow.rows.length).toBe(1);
      expect(dbRow.rows[0].title).toBe('TEST_Rear AC Blower Weak');
      expect(dbRow.rows[0].entity_type).toBe('vehicle');
    });

    it('resurfaces active flags when querying entity (vehicle and driver)', async () => {
      const flags = await ServerFlagsService.getFlags(staffUserId, {
        entityType: 'vehicle',
        entityId: kl01VehicleId,
        isActive: true,
      });

      expect(flags.length).toBeGreaterThanOrEqual(1);
      const found = flags.find((f) => f.id === createdFlagId);
      expect(found).toBeDefined();
      expect(found?.severity).toBe('caution');
    });

    it('resolves an active flag and records resolution metadata', async () => {
      await client.query(`
        UPDATE internal_flags SET
          is_active = FALSE,
          resolved_by = 'Ratnaraj (Admin)',
          resolved_at = NOW(),
          resolution_notes = 'AC compressor gas recharged at Popular Maruti'
        WHERE id = $1
      `, [createdFlagId]);

      const res = await client.query('SELECT is_active, resolved_by, resolution_notes FROM internal_flags WHERE id = $1', [createdFlagId]);
      expect(res.rows[0].is_active).toBe(false);
      expect(res.rows[0].resolved_by).toBe('Ratnaraj (Admin)');
      expect(res.rows[0].resolution_notes).toContain('AC compressor gas recharged');
    });

    it('records administrator written override on avoid flag in PostgreSQL with audit log', async () => {
      // Create an 'avoid' flag
      const avoidFlag = await ServerFlagsService.createFlag(staffUserId, {
        entityType: 'driver',
        entityId: hemanthDriverId,
        severity: 'avoid',
        title: 'TEST_Medical fitness certificate renewal pending',
        description: 'Driver must undergo periodic eye exam before high-speed outstation night duty.',
      });

      // Admin logs a written override
      const overrideReason = 'Authorized for daytime local Technopark shuttle only. Eye exam scheduled for Saturday.';
      const overridden = await ServerFlagsService.overrideAvoidFlag(
        adminUserId,
        avoidFlag.id,
        overrideReason,
        'Ratnaraj (Admin)'
      );
      expect(overridden).toBe(true);

      // Verify in test database that override is persisted with audit fields
      const dbRow = await client.query('SELECT admin_override_reason, overridden_by, overridden_at FROM internal_flags WHERE id = $1', [avoidFlag.id]);
      expect(dbRow.rows[0].admin_override_reason).toBe(overrideReason);
      expect(dbRow.rows[0].overridden_by).toBe('Ratnaraj (Admin)');
      expect(dbRow.rows[0].overridden_at).not.toBeNull();
    });
  });

  // 3. ROW LEVEL SECURITY (RLS) ZERO-LEAKAGE VERIFICATION
  describe('3. Row Level Security (RLS) Zero-Leakage Tests', () => {
    it('RLS: Admin and Staff can select from internal_flags', async () => {
      // Test as Admin
      const adminFlags = await ServerFlagsService.getFlags(adminUserId);
      expect(adminFlags.length).toBeGreaterThan(0);

      // Test as Staff
      const staffFlags = await ServerFlagsService.getFlags(staffUserId);
      expect(staffFlags.length).toBeGreaterThan(0);
    });

    it('RLS: Driver JWT receives ZERO rows and cannot read internal flags', async () => {
      const driverFlags = await ServerFlagsService.getFlags(hemanthDriverUserId);
      expect(driverFlags.length).toBe(0);
    });

    it('RLS: Customer Viewer JWT receives ZERO rows and cannot read internal flags', async () => {
      const customerFlags = await ServerFlagsService.getFlags(customerUserId);
      expect(customerFlags.length).toBe(0);
    });

    it('RLS: Unauthenticated client receives ZERO rows and cannot read internal flags', async () => {
      const anonFlags = await ServerFlagsService.getFlags(null);
      expect(anonFlags.length).toBe(0);
    });

    it('RLS: Driver cannot insert internal flags (policy check failure)', async () => {
      let insertError: any;
      try {
        await ServerFlagsService.createFlag(hemanthDriverUserId, {
          entityType: 'driver',
          entityId: hemanthDriverId,
          severity: 'note',
          title: 'TEST_Driver self insert',
          description: 'Attempting to inject a flag as driver.',
        });
      } catch (err: any) {
        insertError = err;
      }
      expect(insertError).toBeDefined();
      expect(insertError.message).toContain('violates row-level security policy');
    });

    it('RLS: Staff cannot delete internal flags (admin only)', async () => {
      // Create a test flag as staff
      const testFlag = await ServerFlagsService.createFlag(staffUserId, {
        entityType: 'driver',
        entityId: hemanthDriverId,
        severity: 'note',
        title: 'TEST_Staff deletion target',
        description: 'Should not be deletable by staff.',
      });

      // Attempt to delete as staff -> 0 rows deleted due to RLS USING (get_current_app_role() = 'admin')
      const staffDeleted = await ServerFlagsService.deleteFlag(staffUserId, testFlag.id);
      expect(staffDeleted).toBe(false);

      // Verify flag still exists
      const checkRes = await client.query('SELECT id FROM internal_flags WHERE id = $1', [testFlag.id]);
      expect(checkRes.rows.length).toBe(1);

      // Delete as Admin succeeds
      const adminDeleted = await ServerFlagsService.deleteFlag(adminUserId, testFlag.id);
      expect(adminDeleted).toBe(true);
    });

    it('enforces soft-delete only: deleted flags set deleted_at and are excluded from active selects while preserving audit trail', async () => {
      // 1. Create a flag
      const flag = await ServerFlagsService.createFlag(adminUserId, {
        entityType: 'customer',
        entityId: vtlCustomerId,
        severity: 'note',
        title: 'TEST_Retention and soft delete target',
        description: 'Verify row is never physically purged.',
      });

      // 2. Soft delete it as admin
      const deleted = await ServerFlagsService.deleteFlag(adminUserId, flag.id);
      expect(deleted).toBe(true);

      // 3. Normal query filters it out
      const activeFlags = await ServerFlagsService.getFlags(adminUserId, { entityId: vtlCustomerId });
      const found = activeFlags.find((f) => f.id === flag.id);
      expect(found).toBeUndefined();

      // 4. Raw DB query proves the row physically remains with audit timestamp
      const dbRow = await client.query('SELECT deleted_at, deleted_by, is_active FROM internal_flags WHERE id = $1', [flag.id]);
      expect(dbRow.rows.length).toBe(1);
      expect(dbRow.rows[0].deleted_at).not.toBeNull();
      expect(dbRow.rows[0].deleted_by).toBe('admin');
      expect(dbRow.rows[0].is_active).toBe(false);
    });
  });

  // 4. INVOICING & CUSTOMER INTEGRATION ZERO-LEAKAGE
  describe('4. Invoice Snapshots & Customer Integration Zero-Leakage', () => {
    it('proves issued invoice snapshotJson contains zero internal_flags data', async () => {
      const issued = await ServerInvoiceService.issueInvoice({
        supplierId: 'a0000000-0000-0000-0000-000000000002',
        customerId: vtlCustomerId,
        contractId: 'b0000000-0000-0000-0000-000000000001',
        periodFrom: '2026-08-01',
        periodTo: '2026-08-31',
        totalAmount: 68662,
        snapshotJson: {
          contractId: 'b0000000-0000-0000-0000-000000000001',
          templateId: 'format2_fixed_vtl_2026',
          customer: { name: 'M/s Vindhya Telelinks Limited' },
          supplier: { tradeName: 'M/S City Tours & Travels' },
          totalAmount: 68662,
          items: [],
        } as any,
        templateId: 'format2_fixed_vtl_2026',
        templateVersion: 1,
        issuedBy: 'Admin (M. Ratnaraj)',
        adminOverrideReason: 'Testing 7c zero leakage',
      });

      expect(issued.invoiceId).toBeDefined();

      // Retrieve invoice snapshot directly from database
      const invRow = await client.query('SELECT snapshot_json FROM invoices WHERE id = $1', [issued.invoiceId]);
      const snapshot = invRow.rows[0].snapshot_json;

      // Assert zero leakage of internal operational notes
      expect(snapshot.internal_flags).toBeUndefined();
      expect(snapshot.internalFlags).toBeUndefined();
      expect(JSON.stringify(snapshot)).not.toContain('suspicious');
      expect(JSON.stringify(snapshot)).not.toContain('caution');
      expect(JSON.stringify(snapshot)).not.toContain('avoid');

      // Cancel test invoice using official sanctioned procedure (preserves immutability)
      await ServerPaymentService.cancelInvoice(
        issued.invoiceId,
        'Internal flags test teardown cancellation',
        'Admin'
      );
    });

    it('renders invoice PDF text, snapshot_json, WhatsApp share text and approval portal for an entity that has caution/avoid flags and asserts none of the flag text/metadata appears', async () => {
      // 1. Create sensitive avoid and caution flags for VTL customer and assigned vehicle
      await ServerFlagsService.createFlag(staffUserId, {
        entityType: 'customer',
        entityId: vtlCustomerId,
        severity: 'avoid',
        title: 'CONFIDENTIAL_AVOID_LEGAL_DISPUTE_9921',
        description: 'Customer payment query under arbitration. Restricted dispatch: do not assign luxury fleet.',
      });

      await ServerFlagsService.createFlag(staffUserId, {
        entityType: 'vehicle',
        entityId: kl01VehicleId,
        severity: 'caution',
        title: 'CONFIDENTIAL_CAUTION_ODOMETER_SUSPICION_8812',
        description: 'Speedometer sensor cable replaced. Verify physical meter readings daily.',
      });

      try {
        // 2. Generate review & rendered invoice for VTL
        const review = InvoiceService.getReviewDetails('vtl', '2026-08');
        const rendered = review.rendered;

        // Channel A: snapshot_json
        const snapshotStr = JSON.stringify(rendered);
        expect(snapshotStr).not.toContain('CONFIDENTIAL_AVOID_LEGAL_DISPUTE_9921');
        expect(snapshotStr).not.toContain('CONFIDENTIAL_CAUTION_ODOMETER_SUSPICION_8812');
        expect(snapshotStr).not.toContain('arbitration');
        expect(snapshotStr).not.toContain('Speedometer sensor cable');

        // Channel B: Rendered Invoice HTML & Server-Side PDF
        const html = generateInvoiceHtml(rendered);
        expect(html).not.toContain('CONFIDENTIAL_AVOID_LEGAL_DISPUTE_9921');
        expect(html).not.toContain('CONFIDENTIAL_CAUTION_ODOMETER_SUSPICION_8812');
        expect(html).not.toContain('arbitration');

        const pdfPath = 'scratch/test_zero_leakage_invoice.pdf';
        await generateInvoicePdf(rendered, { outputPath: pdfPath });
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfParser = new PDFParse({ data: pdfBuffer });
        const pdfData = await pdfParser.getText();
        const pdfText = pdfData.text;

        expect(pdfText).not.toContain('CONFIDENTIAL_AVOID_LEGAL_DISPUTE_9921');
        expect(pdfText).not.toContain('CONFIDENTIAL_CAUTION_ODOMETER_SUSPICION_8812');
        expect(pdfText).not.toContain('arbitration');
        expect(pdfText).not.toContain('Speedometer sensor cable');
        expect(pdfText).not.toContain('avoid');
        expect(pdfText).not.toContain('caution');

        // Channel C: WhatsApp Share Text
        const waReminder = PaymentService.generateWhatsAppReminder({
          invoiceNumber: '108191',
          customerName: 'M/s Vindhya Telelinks Limited',
          customerPhone: '+91 9846012345',
          supplierName: 'M/S City Tours & Travels',
          amount: 68662,
          dueDate: '30/09/2026',
          reminderType: 'due_date',
        });
        expect(waReminder.messageText).not.toContain('CONFIDENTIAL_AVOID_LEGAL_DISPUTE_9921');
        expect(waReminder.messageText).not.toContain('arbitration');
        expect(waReminder.waLink).not.toContain('CONFIDENTIAL_AVOID_LEGAL_DISPUTE_9921');

        // Channel D: Customer Approval Portal Payload
        const customerLedgerSummary = InvoiceService.checkMonthReadiness('vtl', '2026-08', 'Normal monthly audit');
        const approvalPortalStr = JSON.stringify(customerLedgerSummary);
        expect(approvalPortalStr).not.toContain('CONFIDENTIAL_AVOID_LEGAL_DISPUTE_9921');
        expect(approvalPortalStr).not.toContain('CONFIDENTIAL_CAUTION_ODOMETER_SUSPICION_8812');
        expect(approvalPortalStr).not.toContain('arbitration');
      } finally {
        // Clean up sensitive test flags
        await client.query("DELETE FROM internal_flags WHERE title LIKE 'CONFIDENTIAL_%'");
      }
    });
  });
});
