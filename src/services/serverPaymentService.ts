import { Client } from 'pg';
import { Payment, PaymentMode, ReceivablesAgeingBucket, CustomerAgeingSummary, CustomerStatementRow, CreditDebitNote } from '../types';

export interface RecordPaymentParams {
  invoiceId: string;
  customerId: string;
  paymentDate: string;
  amountReceived: number;
  tdsDeducted?: number;
  tdsRate?: number;
  mode: PaymentMode;
  referenceNo?: string;
  notes?: string;
  createdBy?: string;
}

export interface IssueNoteParams {
  originalInvoiceId: string;
  noteType: 'credit' | 'debit';
  amount: number;
  reason: string;
  snapshotJson?: any;
  templateId?: string;
  createdBy?: string;
}

export class ServerPaymentService {
  public static pgConfig = {
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.TEST_DB_PORT || '54322', 10),
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    database: process.env.TEST_DB_NAME || 'test',
  };

  /**
   * Records a payment against an invoice, computing TDS, checking for overpayment,
   * inserting into PostgreSQL, and auto-refreshing invoice status.
   */
  public static async recordPayment(params: RecordPaymentParams): Promise<Payment> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

      // 1. Fetch current invoice details
      const invRes = await client.query(
        `SELECT id, invoice_number, total_amount, status, customer_id
         FROM invoices
         WHERE id = $1`,
        [params.invoiceId]
      );

      if (invRes.rows.length === 0) {
        throw new Error(`Invoice ${params.invoiceId} not found.`);
      }

      const inv = invRes.rows[0];
      if (inv.status === 'cancelled') {
        throw new Error(`Cannot record payment against cancelled invoice ${inv.invoice_number}.`);
      }

      // 2. Fetch already credited amount (payments + TDS + credit notes - debit notes)
      const existingPaymentsRes = await client.query(
        `SELECT COALESCE(SUM(amount_received), 0) AS paid_sum,
                COALESCE(SUM(tds_deducted), 0) AS tds_sum
         FROM payments
         WHERE invoice_id = $1`,
        [params.invoiceId]
      );
      const existingPaid = parseFloat(existingPaymentsRes.rows[0].paid_sum);
      const existingTds = parseFloat(existingPaymentsRes.rows[0].tds_sum);

      const notesRes = await client.query(
        `SELECT note_type, COALESCE(SUM(amount), 0) AS note_sum
         FROM credit_debit_notes
         WHERE original_invoice_id = $1 AND status != 'cancelled'
         GROUP BY note_type`,
        [params.invoiceId]
      );
      let existingCn = 0;
      let existingDn = 0;
      for (const row of notesRes.rows) {
        if (row.note_type === 'credit') existingCn = parseFloat(row.note_sum);
        if (row.note_type === 'debit') existingDn = parseFloat(row.note_sum);
      }

      const totalInvoiceAmount = parseFloat(inv.total_amount);
      const previouslyCredited = (existingPaid + existingTds + existingCn) - existingDn;
      const currentOutstanding = Math.max(0, totalInvoiceAmount - previouslyCredited);

      const tdsDeducted = params.tdsDeducted ?? 0;
      const tdsRate = params.tdsRate ?? (params.amountReceived > 0 && tdsDeducted > 0 ? (tdsDeducted / (params.amountReceived + tdsDeducted)) * 100 : 0);
      const incomingCredit = params.amountReceived + tdsDeducted;

      // Calculate excess if overpayment
      const excessAmount = incomingCredit > currentOutstanding ? incomingCredit - currentOutstanding : 0;

      // 3. Insert payment record
      const insertRes = await client.query(
        `INSERT INTO payments (
           invoice_id,
           customer_id,
           payment_date,
           amount_received,
           tds_deducted,
           tds_rate,
           mode,
           reference_no,
           notes,
           excess_amount,
           created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          params.invoiceId,
          params.customerId || inv.customer_id,
          params.paymentDate,
          params.amountReceived,
          tdsDeducted,
          tdsRate,
          params.mode,
          params.referenceNo || null,
          params.notes || null,
          excessAmount,
          params.createdBy || 'office_staff',
        ]
      );

      // Audit log entry
      await client.query(
        `INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'payments',
          insertRes.rows[0].id,
          'RECORD_PAYMENT',
          '{}',
          JSON.stringify({
            invoiceId: params.invoiceId,
            invoiceNumber: inv.invoice_number,
            amountReceived: params.amountReceived,
            tdsDeducted,
            mode: params.mode,
            excessAmount,
          }),
          params.createdBy || 'office_staff',
        ]
      );

      await client.query('COMMIT');

      const r = insertRes.rows[0];
      return {
        id: r.id,
        invoiceId: r.invoice_id,
        customerId: r.customer_id,
        paymentDate: r.payment_date,
        amountReceived: parseFloat(r.amount_received),
        tdsDeducted: parseFloat(r.tds_deducted),
        tdsRate: parseFloat(r.tds_rate),
        mode: r.mode,
        referenceNo: r.reference_no,
        notes: r.notes,
        excessAmount: parseFloat(r.excess_amount),
        createdAt: r.created_at,
        createdBy: r.created_by,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      await client.end();
    }
  }

  /**
   * Retrieves payments for an invoice
   */
  public static async getPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      const res = await client.query(
        `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date ASC, created_at ASC`,
        [invoiceId]
      );

      return res.rows.map((r) => ({
        id: r.id,
        invoiceId: r.invoice_id,
        customerId: r.customer_id,
        paymentDate: r.payment_date,
        amountReceived: parseFloat(r.amount_received),
        tdsDeducted: parseFloat(r.tds_deducted),
        tdsRate: parseFloat(r.tds_rate),
        mode: r.mode,
        referenceNo: r.reference_no,
        notes: r.notes,
        excessAmount: parseFloat(r.excess_amount),
        createdAt: r.created_at,
        createdBy: r.created_by,
      }));
    } finally {
      await client.end();
    }
  }

  /**
   * Issues atomic Credit or Debit Note linked to a locked invoice
   */
  public static async issueCreditDebitNote(params: IssueNoteParams): Promise<CreditDebitNote> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

      const res = await client.query(
        `SELECT issue_credit_debit_note_atomic($1, $2, $3, $4, $5, $6, $7) AS note_result`,
        [
          params.originalInvoiceId,
          params.noteType,
          params.amount,
          params.reason,
          JSON.stringify(params.snapshotJson || {}),
          params.templateId || 'format_credit_debit_v1',
          params.createdBy || 'admin',
        ]
      );

      const noteResult = res.rows[0].note_result;

      // Fetch the full note row before commit so JWT claims remain active
      const fullNoteRes = await client.query(
        `SELECT * FROM credit_debit_notes WHERE id = $1`,
        [noteResult.note_id]
      );
      const row = fullNoteRes.rows[0];

      await client.query('COMMIT');

      return {
        id: row.id,
        noteType: row.note_type,
        noteNumber: row.note_number,
        originalInvoiceId: row.original_invoice_id,
        supplierId: row.supplier_id,
        customerId: row.customer_id,
        noteDate: row.note_date,
        amount: parseFloat(row.amount),
        reason: row.reason,
        snapshotJson: row.snapshot_json,
        templateId: row.template_id,
        status: row.status,
        createdAt: row.created_at,
        createdBy: row.created_by,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      await client.end();
    }
  }

  /**
   * Retrieves credit/debit notes for an invoice
   */
  public static async getNotesForInvoice(invoiceId: string): Promise<CreditDebitNote[]> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      const res = await client.query(
        `SELECT * FROM credit_debit_notes WHERE original_invoice_id = $1 ORDER BY note_date ASC, created_at ASC`,
        [invoiceId]
      );

      return res.rows.map((r) => ({
        id: r.id,
        noteType: r.note_type,
        noteNumber: r.note_number,
        originalInvoiceId: r.original_invoice_id,
        supplierId: r.supplier_id,
        customerId: r.customer_id,
        noteDate: r.note_date,
        amount: parseFloat(r.amount),
        reason: r.reason,
        snapshotJson: r.snapshot_json,
        templateId: r.template_id,
        status: r.status,
        createdAt: r.created_at,
        createdBy: r.created_by,
      }));
    } finally {
      await client.end();
    }
  }

  /**
   * Computes complete Receivables Ageing across all active invoices as of a specific date
   */
  public static async getReceivablesAgeing(asOfDate?: string): Promise<{
    totalOutstanding: number;
    ageing: ReceivablesAgeingBucket;
    customerSummaries: CustomerAgeingSummary[];
    invoices: any[];
  }> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    const targetDate = asOfDate ? new Date(asOfDate) : new Date();

    try {
      // 1. Fetch non-cancelled invoices with customer info
      const invoicesRes = await client.query(
        `SELECT i.id, i.invoice_number, i.customer_id, i.total_amount, i.issue_date, i.due_date, i.status,
                c.name AS customer_name, c.phone AS customer_phone
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.status != 'cancelled'
         ORDER BY i.issue_date ASC`
      );

      // 2. Fetch all payments
      const paymentsRes = await client.query(
        `SELECT invoice_id,
                COALESCE(SUM(amount_received), 0) AS total_paid,
                COALESCE(SUM(tds_deducted), 0) AS total_tds
         FROM payments
         GROUP BY invoice_id`
      );
      const paymentsMap = new Map<string, { paid: number; tds: number }>();
      for (const r of paymentsRes.rows) {
        paymentsMap.set(r.invoice_id, {
          paid: parseFloat(r.total_paid),
          tds: parseFloat(r.total_tds),
        });
      }

      // 3. Fetch all notes
      const notesRes = await client.query(
        `SELECT original_invoice_id, note_type, COALESCE(SUM(amount), 0) AS total_amount
         FROM credit_debit_notes
         WHERE status != 'cancelled'
         GROUP BY original_invoice_id, note_type`
      );
      const notesMap = new Map<string, { cn: number; dn: number }>();
      for (const r of notesRes.rows) {
        const cur = notesMap.get(r.original_invoice_id) || { cn: 0, dn: 0 };
        if (r.note_type === 'credit') cur.cn = parseFloat(r.total_amount);
        if (r.note_type === 'debit') cur.dn = parseFloat(r.total_amount);
        notesMap.set(r.original_invoice_id, cur);
      }

      const bucket: ReceivablesAgeingBucket = {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        totalOutstanding: 0,
      };

      const customerMap = new Map<string, CustomerAgeingSummary>();
      const enrichedInvoices: any[] = [];

      for (const inv of invoicesRes.rows) {
        const totalAmount = parseFloat(inv.total_amount);
        const pInfo = paymentsMap.get(inv.id) || { paid: 0, tds: 0 };
        const nInfo = notesMap.get(inv.id) || { cn: 0, dn: 0 };

        const credited = (pInfo.paid + pInfo.tds + nInfo.cn) - nInfo.dn;
        const outstanding = Math.max(0, totalAmount - credited);

        const dueDate = new Date(inv.due_date);
        const diffMs = targetDate.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let ageingCategory: 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'days90plus';
        if (daysOverdue <= 0) {
          ageingCategory = 'current';
        } else if (daysOverdue <= 30) {
          ageingCategory = 'days1to30';
        } else if (daysOverdue <= 60) {
          ageingCategory = 'days31to60';
        } else if (daysOverdue <= 90) {
          ageingCategory = 'days61to90';
        } else {
          ageingCategory = 'days90plus';
        }

        if (outstanding > 0) {
          bucket[ageingCategory] += outstanding;
          bucket.totalOutstanding += outstanding;
        }

        // Aggregate customer level
        let cSummary = customerMap.get(inv.customer_id);
        if (!cSummary) {
          cSummary = {
            customerId: inv.customer_id,
            customerName: inv.customer_name,
            customerPhone: inv.customer_phone,
            totalBilled: 0,
            totalPaid: 0,
            totalTds: 0,
            netCreditNotes: 0,
            outstandingBalance: 0,
            oldestOverdueDate: null,
            unpaidInvoiceCount: 0,
            ageing: {
              current: 0,
              days1to30: 0,
              days31to60: 0,
              days61to90: 0,
              days90plus: 0,
              totalOutstanding: 0,
            },
          };
          customerMap.set(inv.customer_id, cSummary);
        }

        cSummary.totalBilled += totalAmount;
        cSummary.totalPaid += pInfo.paid;
        cSummary.totalTds += pInfo.tds;
        cSummary.netCreditNotes += (nInfo.cn - nInfo.dn);
        cSummary.outstandingBalance += outstanding;

        if (outstanding > 0) {
          cSummary.unpaidInvoiceCount += 1;
          cSummary.ageing[ageingCategory] += outstanding;
          cSummary.ageing.totalOutstanding += outstanding;

          if (daysOverdue > 0) {
            if (!cSummary.oldestOverdueDate || new Date(inv.due_date) < new Date(cSummary.oldestOverdueDate)) {
              cSummary.oldestOverdueDate = inv.due_date;
            }
          }
        }

        enrichedInvoices.push({
          ...inv,
          totalAmount,
          totalPaid: pInfo.paid,
          totalTds: pInfo.tds,
          creditNotes: nInfo.cn,
          debitNotes: nInfo.dn,
          outstandingBalance: outstanding,
          daysOverdue: Math.max(0, daysOverdue),
          ageingCategory,
        });
      }

      return {
        totalOutstanding: bucket.totalOutstanding,
        ageing: bucket,
        customerSummaries: Array.from(customerMap.values()),
        invoices: enrichedInvoices,
      };
    } finally {
      await client.end();
    }
  }

  /**
   * Generates a complete chronological ledger statement for a customer
   */
  public static async getCustomerStatement(
    customerId: string,
    _fromDate?: string,
    _toDate?: string
  ): Promise<{
    customer: any;
    openingBalance: number;
    rows: CustomerStatementRow[];
    closingBalance: number;
    ageing: ReceivablesAgeingBucket;
  }> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      // Fetch customer
      const custRes = await client.query(`SELECT * FROM customers WHERE id = $1`, [customerId]);
      if (custRes.rows.length === 0) {
        throw new Error(`Customer ${customerId} not found.`);
      }
      const customer = custRes.rows[0];

      // Fetch customer invoices
      const invRes = await client.query(
        `SELECT id, invoice_number, issue_date, total_amount, status
         FROM invoices
         WHERE customer_id = $1 AND status != 'cancelled'
         ORDER BY issue_date ASC`,
        [customerId]
      );

      // Fetch customer payments
      const payRes = await client.query(
        `SELECT p.*, i.invoice_number
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE p.customer_id = $1
         ORDER BY p.payment_date ASC`,
        [customerId]
      );

      // Fetch notes
      const notesRes = await client.query(
        `SELECT n.*, i.invoice_number
         FROM credit_debit_notes n
         JOIN invoices i ON n.original_invoice_id = i.id
         WHERE n.customer_id = $1 AND n.status != 'cancelled'
         ORDER BY n.note_date ASC`,
        [customerId]
      );

      // Interleave events in chronological order
      const rawEvents: {
        date: string;
        type: 'invoice' | 'payment' | 'credit_note' | 'debit_note';
        referenceNo: string;
        description: string;
        debit: number;
        credit: number;
      }[] = [];

      for (const inv of invRes.rows) {
        rawEvents.push({
          date: inv.issue_date,
          type: 'invoice',
          referenceNo: inv.invoice_number,
          description: `Invoice #${inv.invoice_number} Billed`,
          debit: parseFloat(inv.total_amount),
          credit: 0,
        });
      }

      for (const pay of payRes.rows) {
        const received = parseFloat(pay.amount_received);
        const tds = parseFloat(pay.tds_deducted);

        if (received > 0) {
          rawEvents.push({
            date: pay.payment_date,
            type: 'payment',
            referenceNo: pay.reference_no || `REC-${pay.id.substring(0, 8)}`,
            description: `Payment received (${pay.mode.toUpperCase()}) for Inv #${pay.invoice_number}`,
            debit: 0,
            credit: received,
          });
        }

        if (tds > 0) {
          rawEvents.push({
            date: pay.payment_date,
            type: 'payment',
            referenceNo: `TDS-${pay.id.substring(0, 8)}`,
            description: `TDS Deducted (${pay.tds_rate}%) on Inv #${pay.invoice_number}`,
            debit: 0,
            credit: tds,
          });
        }
      }

      for (const note of notesRes.rows) {
        const amt = parseFloat(note.amount);
        if (note.note_type === 'credit') {
          rawEvents.push({
            date: note.note_date,
            type: 'credit_note',
            referenceNo: note.note_number,
            description: `Credit Note (${note.reason}) against Inv #${note.invoice_number}`,
            debit: 0,
            credit: amt,
          });
        } else {
          rawEvents.push({
            date: note.note_date,
            type: 'debit_note',
            referenceNo: note.note_number,
            description: `Debit Note (${note.reason}) against Inv #${note.invoice_number}`,
            debit: amt,
            credit: 0,
          });
        }
      }

      // Sort chronologically
      rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Compute running balance
      let runningBalance = 0;
      const rows: CustomerStatementRow[] = [];

      for (const ev of rawEvents) {
        runningBalance += ev.debit - ev.credit;
        rows.push({
          ...ev,
          runningBalance,
        });
      }

      // Receivables ageing for this customer
      const ageingRes = await ServerPaymentService.getReceivablesAgeing();
      const customerAgeing = ageingRes.customerSummaries.find((c) => c.customerId === customerId)?.ageing || {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        totalOutstanding: 0,
      };

      return {
        customer,
        openingBalance: 0,
        rows,
        closingBalance: runningBalance,
        ageing: customerAgeing,
      };
    } finally {
      await client.end();
    }
  }

  /**
   * Cancels an invoice with mandatory justification reason, keeping the invoice number
   * marked cancelled (never reused) and unlocking associated trip ledger entries.
   */
  public static async cancelInvoice(
    invoiceId: string,
    reason: string,
    adminUser: string = 'admin'
  ): Promise<{ invoiceId: string; invoiceNumber: string; status: 'cancelled'; reason: string }> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

      const res = await client.query(`SELECT cancel_invoice($1, $2, $3) AS cancel_result`, [
        invoiceId,
        reason,
        adminUser,
      ]);

      await client.query('COMMIT');
      const cr = res.rows[0].cancel_result;
      return {
        invoiceId: cr.invoice_id,
        invoiceNumber: cr.invoice_number,
        status: cr.status,
        reason: cr.reason,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      await client.end();
    }
  }

  /**
   * Admin "set next number" per series with mandatory justification and audit logging
   */
  public static async setInvoiceSeriesNumber(
    seriesId: string,
    nextNumber: number,
    reason: string,
    adminUser: string = 'admin'
  ): Promise<{ seriesId: string; oldNumber: number; newNextNumber: number; reason: string }> {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000001\"}', true)");

      const res = await client.query(
        `SELECT admin_set_invoice_series_number($1, $2, $3, $4) AS set_result`,
        [seriesId, nextNumber, reason, adminUser]
      );

      await client.query('COMMIT');
      const sr = res.rows[0].set_result;
      return {
        seriesId: sr.series_id,
        oldNumber: sr.old_number,
        newNextNumber: sr.new_next_number,
        reason: sr.reason,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      await client.end();
    }
  }

  /**
   * Logs a sent payment reminder into PostgreSQL
   */
  public static async logPaymentReminder(params: {
    invoiceId: string;
    reminderType: 'due_minus_3' | 'due_date' | 'overdue_7' | 'overdue_14' | 'custom';
    recipientPhone: string;
    messageText: string;
    createdBy?: string;
  }) {
    const client = new Client(ServerPaymentService.pgConfig);
    await client.connect();

    try {
      const res = await client.query(
        `INSERT INTO payment_reminders (invoice_id, reminder_type, recipient_phone, message_text, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          params.invoiceId,
          params.reminderType,
          params.recipientPhone,
          params.messageText,
          params.createdBy || 'office_staff',
        ]
      );
      return res.rows[0];
    } finally {
      await client.end();
    }
  }
}
