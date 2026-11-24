import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { ServerPaymentService } from '../services/serverPaymentService';
import { ServerInvoiceService } from '../services/serverInvoiceService';
import { PaymentService } from '../services/paymentService';
import { calculateMonthlyFixedInvoice } from '../engine';
import { EXACT_SEED_VTL_AUG_2026 } from '../services/ledgerService';

import { createTestClient, assertTestDatabaseGuard, TEST_PG_CONFIG } from './testDbHelper';

describe('Milestone 6: Payments, Receivables, TDS, Credit/Debit Notes & Admin Controls', () => {
  const pgConfig = { ...TEST_PG_CONFIG, database: 'test' };
  let testInvoiceId: string;
  const vtlCustomerId = 'c0000000-0000-0000-0000-000000000001';
  const cityToursSupplierId = 'a0000000-0000-0000-0000-000000000002';
  const vtlContractId = 'b0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    // 1. Issue a locked test invoice for VTL August 2026 if not already present
    const client = await createTestClient();
    await assertTestDatabaseGuard(client);

    ServerPaymentService.pgConfig = {
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

    try {
      await client.query("UPDATE trip_ledger SET is_locked = FALSE, invoice_id = NULL WHERE contract_id = $1", [vtlContractId]);
      await client.query("DELETE FROM credit_debit_notes WHERE supplier_id = $1", [cityToursSupplierId]);
      await client.query("UPDATE note_series SET current_number = 1000 WHERE supplier_id = $1", [cityToursSupplierId]);

      // Calculate golden billing
      const calc = calculateMonthlyFixedInvoice(
        '2026-08-01',
        '2026-08-31',
        EXACT_SEED_VTL_AUG_2026,
        {
          fixedAmount: 65000,
          includedKm: 3000,
          includedHoursPerDay: 12,
          extraKmRate: 16,
          extraHourRate: 150,
          nightBataRate: 200,
          outstationBataRate: 200,
          contractWorkingDays: 30,
          roundingMode: 'down',
        }
      );

      expect(calc.totalAmount).toBe(68662);

      const issueRes = await ServerInvoiceService.issueInvoice({
        supplierId: cityToursSupplierId,
        customerId: vtlCustomerId,
        contractId: vtlContractId,
        periodFrom: '2026-08-01',
        periodTo: '2026-08-31',
        totalAmount: 68662,
        snapshotJson: {
          contractId: vtlContractId,
          templateId: 'format2_fixed_vtl_2026',
          templateVersion: 1,
          customer: { name: 'M/s Vindhya Telelinks Limited' },
          supplier: { tradeName: 'M/S City Tours & Travels' },
          items: [],
          totalAmount: 68662,
        } as any,
        templateId: 'format2_fixed_vtl_2026',
        templateVersion: 1,
        issuedBy: 'Admin (M. Ratnaraj)',
        adminOverrideReason: 'Testing M6 payments & receivables',
      });

      testInvoiceId = issueRes.invoiceId;
    } finally {
      await client.end();
    }
  });

  afterAll(async () => {
    // Clean up payments, notes, and unlock test entries
    const client = new Client(pgConfig);
    await client.connect();
    try {
      await client.query("UPDATE trip_ledger SET is_locked = FALSE, invoice_id = NULL WHERE contract_id = $1", [vtlContractId]);
      if (testInvoiceId) {
        await client.query('DELETE FROM payments WHERE invoice_id = $1', [testInvoiceId]);
        await client.query('DELETE FROM credit_debit_notes WHERE original_invoice_id = $1', [testInvoiceId]);
        await client.query('DELETE FROM payment_reminders WHERE invoice_id = $1', [testInvoiceId]);
        await client.query("UPDATE invoices SET status = 'draft', locked_at = NULL WHERE id = $1", [testInvoiceId]);
        await client.query('DELETE FROM invoices WHERE id = $1', [testInvoiceId]);
      }
    } finally {
      await client.end();
    }
  });

  describe('1. Golden Test: VTL ₹68,662 with 2% TDS on Taxable Value', () => {
    it('accurately records net bank receipt (₹67,288.76) + 2% TDS (₹1,373.24) = ₹68,662 and auto-settles invoice to paid', async () => {
      const grossAmount = 68662.0;
      const tdsRate = 2.0;
      const expectedTds = Math.round(grossAmount * (tdsRate / 100) * 100) / 100; // 1373.24
      const expectedNetReceipt = Math.round((grossAmount - expectedTds) * 100) / 100; // 67288.76

      expect(expectedTds).toBe(1373.24);
      expect(expectedNetReceipt).toBe(67288.76);
      expect(expectedTds + expectedNetReceipt).toBe(grossAmount);

      // Record golden payment
      const payment = await ServerPaymentService.recordPayment({
        invoiceId: testInvoiceId,
        customerId: vtlCustomerId,
        paymentDate: '2026-09-10',
        amountReceived: expectedNetReceipt,
        tdsDeducted: expectedTds,
        tdsRate: 2.0,
        mode: 'bank_transfer',
        referenceNo: 'HDFC20260910009821',
        notes: 'VTL Cochin Corporate monthly settlement with 2% Sec 194C TDS certificate',
        createdBy: 'M. Ratnaraj',
      });

      expect(payment.id).toBeDefined();
      expect(payment.amountReceived).toBe(67288.76);
      expect(payment.tdsDeducted).toBe(1373.24);
      expect(payment.excessAmount).toBe(0);

      // Verify invoice status auto-transitioned to 'paid' in PostgreSQL
      const client = new Client(pgConfig);
      await client.connect();
      try {
        const invRes = await client.query('SELECT status FROM invoices WHERE id = $1', [testInvoiceId]);
        expect(invRes.rows[0].status).toBe('paid');
      } finally {
        await client.end();
      }
    });
  });

  describe('2. Part Payments & Overpayment Handling', () => {
    let partInvoiceId: string;

    beforeAll(async () => {
      const client = new Client(pgConfig);
      await client.connect();
      try {
        // Create a temporary invoice of ₹50,000 for part-payment testing
        const uniqueInvNo = `TEST-PART-${Date.now()}`;
        const res = await client.query(
          `INSERT INTO invoices (
             invoice_number, supplier_id, customer_id, contract_id,
             period_from, period_to, issue_date, due_date, total_amount, status
           ) VALUES ($1, $2, $3, $4, '2026-08-01', '2026-08-31', '2026-08-31', '2026-09-15', 50000.00, 'issued')
           RETURNING id`,
          [uniqueInvNo, cityToursSupplierId, vtlCustomerId, vtlContractId]
        );
        partInvoiceId = res.rows[0].id;
      } finally {
        await client.end();
      }
    });

    afterAll(async () => {
      const client = new Client(pgConfig);
      await client.connect();
      try {
        if (partInvoiceId) {
          await client.query('DELETE FROM payments WHERE invoice_id = $1', [partInvoiceId]);
          await client.query("UPDATE invoices SET status = 'draft', locked_at = NULL WHERE id = $1", [partInvoiceId]);
          await client.query('DELETE FROM invoices WHERE id = $1', [partInvoiceId]);
        }
      } finally {
        await client.end();
      }
    });

    it('transitions status to part_paid when partial amount is credited', async () => {
      // Payment 1: ₹20,000
      await ServerPaymentService.recordPayment({
        invoiceId: partInvoiceId,
        customerId: vtlCustomerId,
        paymentDate: '2026-09-05',
        amountReceived: 20000,
        mode: 'upi',
        referenceNo: 'UPI99281726',
        createdBy: 'office_staff',
      });

      const client = new Client(pgConfig);
      await client.connect();
      try {
        const invRes = await client.query('SELECT status FROM invoices WHERE id = $1', [partInvoiceId]);
        expect(invRes.rows[0].status).toBe('part_paid');
      } finally {
        await client.end();
      }
    });

    it('transitions status to paid and records excess when overpaid', async () => {
      // Payment 2: Remaining was ₹30,000, but customer pays ₹35,000
      const p2 = await ServerPaymentService.recordPayment({
        invoiceId: partInvoiceId,
        customerId: vtlCustomerId,
        paymentDate: '2026-09-12',
        amountReceived: 35000,
        mode: 'bank_transfer',
        referenceNo: 'NEFT00392817',
        createdBy: 'office_staff',
      });

      expect(p2.excessAmount).toBe(5000); // ₹5,000 unallocated excess

      const client = new Client(pgConfig);
      await client.connect();
      try {
        const invRes = await client.query('SELECT status FROM invoices WHERE id = $1', [partInvoiceId]);
        expect(invRes.rows[0].status).toBe('paid');
      } finally {
        await client.end();
      }
    });
  });

  describe('3. Receivables Ageing & Customer Statement Verification', () => {
    it('computes correct receivables ageing breakdown and customer statement running balance', async () => {
      const ageing = await ServerPaymentService.getReceivablesAgeing('2026-10-01');

      expect(ageing).toBeDefined();
      expect(ageing.ageing).toHaveProperty('current');
      expect(ageing.ageing).toHaveProperty('days1to30');
      expect(ageing.ageing).toHaveProperty('days31to60');
      expect(ageing.ageing).toHaveProperty('days61to90');
      expect(ageing.ageing).toHaveProperty('days90plus');
      expect(ageing.ageing).toHaveProperty('totalOutstanding');

      // Verify customer statement
      const statement = await ServerPaymentService.getCustomerStatement(vtlCustomerId);
      expect(statement.customer.id).toBe(vtlCustomerId);
      expect(statement.rows.length).toBeGreaterThanOrEqual(1);

      // Verify running balance integrity
      let running = 0;
      for (const row of statement.rows) {
        running += row.debit - row.credit;
        expect(row.runningBalance).toBe(running);
      }
    });
  });

  describe('4. Credit & Debit Notes Atomic Gap-Free Issuance', () => {
    it('issues an atomic Credit Note linked to invoice with sequence CN-1001 and locked immutability', async () => {
      const note = await ServerPaymentService.issueCreditDebitNote({
        originalInvoiceId: testInvoiceId,
        noteType: 'credit',
        amount: 500.0,
        reason: 'Special holiday toll allowance refund approved by Ratnaraj',
        createdBy: 'Admin (M. Ratnaraj)',
      });

      expect(note.id).toBeDefined();
      expect(note.noteNumber).toBe('CN-1001');
      expect(note.noteType).toBe('credit');
      expect(note.amount).toBe(500.0);
      expect(note.status).toBe('locked');

      // Fetch all notes for invoice
      const allNotes = await ServerPaymentService.getNotesForInvoice(testInvoiceId);
      expect(allNotes.some((n) => n.noteNumber === 'CN-1001')).toBe(true);
    });

    it('issues an atomic Debit Note linked to invoice with sequence DN-1001', async () => {
      const note = await ServerPaymentService.issueCreditDebitNote({
        originalInvoiceId: testInvoiceId,
        noteType: 'debit',
        amount: 250.0,
        reason: 'Additional airport parking entry fee reimbursement',
        createdBy: 'Admin (M. Ratnaraj)',
      });

      expect(note.id).toBeDefined();
      expect(note.noteNumber).toBe('DN-1001');
      expect(note.noteType).toBe('debit');
      expect(note.amount).toBe(250.0);
    });
  });

  describe('5. WhatsApp Reminder Message Templates & Audit Logging', () => {
    it('generates accurate WhatsApp reminder template text and wa.me deep-link', () => {
      const reminder = PaymentService.generateWhatsAppReminder({
        invoiceNumber: '108191',
        customerName: 'M/s Vindhya Telelinks Limited',
        customerPhone: '+91 9846012345',
        supplierName: 'M/S City Tours & Travels',
        amount: 68662,
        dueDate: '30/09/2026',
        reminderType: 'due_minus_3',
      });

      expect(reminder.messageText).toContain('Vindhya Telelinks');
      expect(reminder.messageText).toContain('108191');
      expect(reminder.messageText).toContain('68,662');
      expect(reminder.waLink).toContain('https://wa.me/919846012345?text=');
    });

    it('logs payment reminder into PostgreSQL payment_reminders table', async () => {
      const logged = await ServerPaymentService.logPaymentReminder({
        invoiceId: testInvoiceId,
        reminderType: 'due_minus_3',
        recipientPhone: '+91 9846012345',
        messageText: 'Reminder test message',
        createdBy: 'office_staff',
      });

      expect(logged.id).toBeDefined();
      expect(logged.status).toBe('sent');
      expect(logged.channel).toBe('whatsapp');
    });
  });

  describe('6. Admin Series Configuration & Invoice Cancellation', () => {
    it('allows admin to set next sequence number with mandatory justification and audit logging', async () => {
      const client = new Client(pgConfig);
      await client.connect();

      try {
        const seriesRes = await client.query(
          "SELECT id, current_number FROM invoice_series WHERE supplier_id = $1",
          [cityToursSupplierId]
        );
        const seriesId = seriesRes.rows[0].id;

        // Set next number to 109000
        const result = await ServerPaymentService.setInvoiceSeriesNumber(
          seriesId,
          109000,
          'Owner synchronized manual paper book sequence for FY26-27',
          'M. Ratnaraj'
        );

        expect(result.newNextNumber).toBe(109000);

        // Verify updated in table (current_number becomes 109000 - 1 = 108999)
        const checkRes = await client.query("SELECT current_number FROM invoice_series WHERE id = $1", [seriesId]);
        expect(checkRes.rows[0].current_number).toBe(108999);

        // Verify audit log entry
        const auditRes = await client.query(
          "SELECT * FROM audit_logs WHERE record_id = $1 AND action = 'SET_SERIES_NEXT_NUMBER' ORDER BY changed_at DESC LIMIT 1",
          [seriesId]
        );
        expect(auditRes.rows.length).toBe(1);
        expect(auditRes.rows[0].changed_by).toBe('M. Ratnaraj');
      } finally {
        await client.end();
      }
    });

    it('cancels an invoice, preserves invoice number as cancelled, and unlocks associated ledger rows', async () => {
      const client = new Client(pgConfig);
      await client.connect();

      let cancelTestInvoiceId: string;
      try {
        // Issue an invoice to cancel
        const issueRes = await ServerInvoiceService.issueInvoice({
          supplierId: cityToursSupplierId,
          customerId: vtlCustomerId,
          contractId: vtlContractId,
          periodFrom: '2026-08-01',
          periodTo: '2026-08-31',
          totalAmount: 68662,
          snapshotJson: {} as any,
          templateId: 'format2_fixed_vtl_2026',
          templateVersion: 1,
          issuedBy: 'Admin',
          adminOverrideReason: 'Cancellation test',
        });
        cancelTestInvoiceId = issueRes.invoiceId;

        // Cancel the invoice
        const cancelResult = await ServerPaymentService.cancelInvoice(
          cancelTestInvoiceId,
          'Contract terms re-negotiation in progress; cancelling to re-bill',
          'M. Ratnaraj'
        );

        expect(cancelResult.status).toBe('cancelled');

        // Verify invoice row status is cancelled (number is NOT deleted)
        const invCheck = await client.query("SELECT invoice_number, status FROM invoices WHERE id = $1", [cancelTestInvoiceId]);
        expect(invCheck.rows[0].status).toBe('cancelled');
        expect(invCheck.rows[0].invoice_number).toBe(cancelResult.invoiceNumber);

        // Verify linked trip ledger entries were released/unlocked
        const tripsCheck = await client.query(
          "SELECT COUNT(*) FROM trip_ledger WHERE invoice_id = $1 AND is_locked = TRUE",
          [cancelTestInvoiceId]
        );
        expect(parseInt(tripsCheck.rows[0].count, 10)).toBe(0);

        // Cleanup
        await client.query("UPDATE invoices SET status = 'draft', locked_at = NULL WHERE id = $1", [cancelTestInvoiceId]);
        await client.query("DELETE FROM invoices WHERE id = $1", [cancelTestInvoiceId]);
      } finally {
        await client.end();
      }
    });
  });

  describe('7. Row Level Security (RLS) on Payments & Notes', () => {
    it('blocks driver from reading payment records', async () => {
      const client = new Client(pgConfig);
      await client.connect();

      try {
        await client.query('SET ROLE starciti_app');
        // Authenticated Driver JWT (Hemanth Kumar)
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', true);");

        const res = await client.query("SELECT * FROM payments");
        expect(res.rows.length).toBe(0); // Driver is completely blocked from reading payment records
      } finally {
        await client.end();
      }
    });

    it('blocks staff from deleting payment records (append-only integrity)', async () => {
      const client = new Client(pgConfig);
      await client.connect();

      try {
        await client.query('SET ROLE starciti_app');
        // Authenticated Staff JWT
        await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', true);");

        // Attempting to delete payment should affect 0 rows or be denied
        const deleteRes = await client.query("DELETE FROM payments WHERE invoice_id = $1", [testInvoiceId]);
        expect(deleteRes.rowCount).toBe(0);
      } finally {
        await client.end();
      }
    });
  });
});
