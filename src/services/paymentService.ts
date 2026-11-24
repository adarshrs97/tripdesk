import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Payment,
  PaymentMode,
  CreditDebitNote,
  PaymentReminder,
} from '../types';

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

// In-memory cache for client reactive state
let inMemoryPayments: Payment[] = [];
let inMemoryNotes: CreditDebitNote[] = [];
let inMemoryReminders: PaymentReminder[] = [];

export class PaymentService {
  /**
   * Helper to format WhatsApp message templates
   */
  public static generateWhatsAppReminder(params: {
    invoiceNumber: string;
    customerName: string;
    customerPhone: string;
    supplierName: string;
    amount: number;
    dueDate: string;
    daysOverdue?: number;
    reminderType: 'due_minus_3' | 'due_date' | 'overdue_7' | 'overdue_14' | 'custom';
  }): { messageText: string; waLink: string } {
    let messageText = '';
    const cleanPhone = params.customerPhone.replace(/[^0-9]/g, '');

    switch (params.reminderType) {
      case 'due_minus_3':
        messageText = `Dear ${params.customerName},\n\nThis is a friendly reminder that Invoice #${params.invoiceNumber} for ₹${params.amount.toLocaleString('en-IN')}/- from ${params.supplierName} is due in 3 days on ${params.dueDate}.\n\nThank you for your valued partnership.\n- Starciti Billing Desk`;
        break;
      case 'due_date':
        messageText = `Dear ${params.customerName},\n\nThis is to notify you that Invoice #${params.invoiceNumber} for ₹${params.amount.toLocaleString('en-IN')}/- from ${params.supplierName} is due today (${params.dueDate}).\n\nKindly release the payment via Bank Transfer or UPI at your earliest convenience.\n- Starciti Billing Desk`;
        break;
      case 'overdue_7':
        messageText = `Dear ${params.customerName},\n\nNotice: Invoice #${params.invoiceNumber} for ₹${params.amount.toLocaleString('en-IN')}/- was due on ${params.dueDate} and is now 7 days overdue.\n\nPlease let us know the expected date of settlement or share the UTR reference if already processed.\n- Starciti Accounts`;
        break;
      case 'overdue_14':
        messageText = `Dear ${params.customerName},\n\nUrgent Reminder: Invoice #${params.invoiceNumber} for ₹${params.amount.toLocaleString('en-IN')}/- is ${params.daysOverdue || 14} days overdue.\n\nPlease process the pending payment immediately to avoid suspension of fleet services. For queries, contact fleet accounts management at +91 6238603200.\n- Starciti Management`;
        break;
      case 'custom':
      default:
        messageText = `Dear ${params.customerName},\n\nRegarding pending Invoice #${params.invoiceNumber} for ₹${params.amount.toLocaleString('en-IN')}/- (Due: ${params.dueDate}). Kindly review and confirm payment status.\n- Starciti Billing Desk`;
        break;
    }

    const waLink = `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(messageText)}`;
    return { messageText, waLink };
  }

  /**
   * Record a payment
   */
  public static async recordPayment(params: RecordPaymentParams): Promise<Payment> {
    const tdsDeducted = params.tdsDeducted ?? 0;
    const tdsRate = params.tdsRate ?? (params.amountReceived > 0 && tdsDeducted > 0 ? (tdsDeducted / (params.amountReceived + tdsDeducted)) * 100 : 0);

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          invoice_id: params.invoiceId,
          customer_id: params.customerId,
          payment_date: params.paymentDate,
          amount_received: params.amountReceived,
          tds_deducted: tdsDeducted,
          tds_rate: tdsRate,
          mode: params.mode,
          reference_no: params.referenceNo || null,
          notes: params.notes || null,
          created_by: params.createdBy || 'office_staff',
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        invoiceId: data.invoice_id,
        customerId: data.customer_id,
        paymentDate: data.payment_date,
        amountReceived: parseFloat(data.amount_received),
        tdsDeducted: parseFloat(data.tds_deducted),
        tdsRate: parseFloat(data.tds_rate),
        mode: data.mode,
        referenceNo: data.reference_no,
        notes: data.notes,
        excessAmount: parseFloat(data.excess_amount || 0),
        createdAt: data.created_at,
        createdBy: data.created_by,
      };
    }

    // Local / In-memory fallback
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      invoiceId: params.invoiceId,
      customerId: params.customerId,
      paymentDate: params.paymentDate,
      amountReceived: params.amountReceived,
      tdsDeducted,
      tdsRate,
      mode: params.mode,
      referenceNo: params.referenceNo,
      notes: params.notes,
      excessAmount: 0,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy || 'office_staff',
    };
    inMemoryPayments.push(newPayment);
    return newPayment;
  }

  /**
   * Retrieves payments for an invoice
   */
  public static async getPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: true });

      if (error) throw error;
      return (data || []).map((r: any) => ({
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
        excessAmount: parseFloat(r.excess_amount || 0),
        createdAt: r.created_at,
        createdBy: r.created_by,
      }));
    }

    return inMemoryPayments.filter((p) => p.invoiceId === invoiceId);
  }

  /**
   * Create Credit or Debit Note
   */
  public static async issueCreditDebitNote(params: IssueNoteParams): Promise<CreditDebitNote> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('issue_credit_debit_note_atomic', {
        p_original_invoice_id: params.originalInvoiceId,
        p_note_type: params.noteType,
        p_amount: params.amount,
        p_reason: params.reason,
        p_snapshot_json: params.snapshotJson || {},
        p_template_id: params.templateId || 'format_credit_debit_v1',
        p_created_by: params.createdBy || 'admin',
      });

      if (error) throw error;
      return data;
    }

    const prefix = params.noteType === 'credit' ? 'CN' : 'DN';
    const noteNumber = `${prefix}-${1001 + inMemoryNotes.length}`;
    const newNote: CreditDebitNote = {
      id: `note-${Date.now()}`,
      noteType: params.noteType,
      noteNumber,
      originalInvoiceId: params.originalInvoiceId,
      supplierId: 'a0000000-0000-0000-0000-000000000002',
      customerId: 'b0000000-0000-0000-0000-000000000001',
      noteDate: new Date().toISOString().split('T')[0],
      amount: params.amount,
      reason: params.reason,
      snapshotJson: params.snapshotJson || {},
      templateId: params.templateId || 'format_credit_debit_v1',
      status: 'locked',
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy || 'admin',
    };
    inMemoryNotes.push(newNote);
    return newNote;
  }

  /**
   * Get Credit/Debit notes for an invoice
   */
  public static async getNotesForInvoice(invoiceId: string): Promise<CreditDebitNote[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('credit_debit_notes')
        .select('*')
        .eq('original_invoice_id', invoiceId)
        .order('note_date', { ascending: true });

      if (error) throw error;
      return (data || []).map((r: any) => ({
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
    }

    return inMemoryNotes.filter((n) => n.originalInvoiceId === invoiceId);
  }

  /**
   * Log payment reminder
   */
  public static async logPaymentReminder(params: {
    invoiceId: string;
    reminderType: 'due_minus_3' | 'due_date' | 'overdue_7' | 'overdue_14' | 'custom';
    recipientPhone: string;
    messageText: string;
    createdBy?: string;
  }): Promise<PaymentReminder> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('payment_reminders')
        .insert({
          invoice_id: params.invoiceId,
          reminder_type: params.reminderType,
          recipient_phone: params.recipientPhone,
          message_text: params.messageText,
          channel: 'whatsapp',
          created_by: params.createdBy || 'office_staff',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const r: PaymentReminder = {
      id: `rem-${Date.now()}`,
      invoiceId: params.invoiceId,
      reminderType: params.reminderType,
      recipientPhone: params.recipientPhone,
      messageText: params.messageText,
      channel: 'whatsapp',
      sentAt: new Date().toISOString(),
      status: 'sent',
      createdBy: params.createdBy || 'office_staff',
    };
    inMemoryReminders.push(r);
    return r;
  }
}
