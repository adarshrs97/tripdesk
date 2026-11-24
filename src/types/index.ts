export type UserRole = 'admin' | 'staff' | 'driver' | 'customer_viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  driverId?: string;
}

export interface SupplierProfile {
  id: string;
  tradeName: string;
  legalName: string;
  address: string;
  city: string;
  pincode: string;
  state: string;
  phone: string;
  secondaryPhone?: string;
  email: string;
  pan: string;
  gstin?: string;
  sacCode: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId?: string;
  logoUrl?: string;
  invoicePrefix: string;
  promoText?: string;
  isDefault?: boolean;
}

export type ViewId = 
  | 'dashboard'
  | 'ledger'
  | 'invoices'
  | 'customers'
  | 'enquiries'
  | 'quotes'
  | 'bookings'
  | 'tripplanning'
  | 'fleet'
  | 'compliance'
  | 'staff'
  | 'expenses'
  | 'flags'
  | 'accounts'
  | 'reports'
  | 'suppliers'
  | 'templates'
  | 'driver'
  | 'settings'
  | 'approvals';

export interface NavItem {
  id: ViewId;
  label: string;
  iconName: string;
  badge?: string | number;
  badgeColor?: 'brand' | 'amber' | 'red';
  minRole?: UserRole;
}

export type PaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque';

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  paymentDate: string;
  amountReceived: number;
  tdsDeducted: number;
  tdsRate: number;
  mode: PaymentMode;
  referenceNo?: string | null;
  notes?: string | null;
  excessAmount: number;
  createdAt: string;
  createdBy?: string | null;
}

export type NoteType = 'credit' | 'debit';

export interface CreditDebitNote {
  id: string;
  noteType: NoteType;
  noteNumber: string;
  originalInvoiceId: string;
  supplierId: string;
  customerId: string;
  noteDate: string;
  amount: number;
  reason: string;
  snapshotJson: any;
  templateId: string;
  status: 'locked' | 'cancelled';
  createdAt: string;
  createdBy?: string | null;
}

export interface PaymentReminder {
  id: string;
  invoiceId: string;
  reminderType: 'due_minus_3' | 'due_date' | 'overdue_7' | 'overdue_14' | 'custom';
  recipientPhone: string;
  messageText: string;
  channel: 'whatsapp';
  sentAt: string;
  status: 'sent';
  createdBy?: string | null;
}

export interface ReceivablesAgeingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  totalOutstanding: number;
}

export interface CustomerAgeingSummary {
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  totalBilled: number;
  totalPaid: number;
  totalTds: number;
  netCreditNotes: number;
  outstandingBalance: number;
  oldestOverdueDate?: string | null;
  unpaidInvoiceCount: number;
  ageing: ReceivablesAgeingBucket;
}

export interface CustomerStatementRow {
  date: string;
  type: 'invoice' | 'payment' | 'credit_note' | 'debit_note';
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}
