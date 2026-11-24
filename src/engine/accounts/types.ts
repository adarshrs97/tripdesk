// ==============================================================================
// Milestone 8: Accounts & Reports Type Definitions
// ==============================================================================

export type CashTransactionType = 'receipt' | 'payment' | 'deposit_to_bank' | 'petty_cash';

export type CashCategory =
  | 'driver_bata'
  | 'fuel_settlement'
  | 'customer_cash_payment'
  | 'office_expense'
  | 'workshop_maintenance'
  | 'toll_parking'
  | 'police_rto_challan'
  | 'owner_drawing'
  | 'other';

export interface CashTransaction {
  id: string;
  entryDate: string; // YYYY-MM-DD
  transactionType: CashTransactionType;
  category: CashCategory;
  amount: number;
  driverId?: string | null;
  customerId?: string | null;
  vehicleId?: string | null;
  referenceNo?: string | null;
  description: string;
  runningBalance?: number | null;
  createdBy?: string | null;
  createdAt?: string;
}

export type BankMode = 'bank_transfer' | 'upi' | 'neft' | 'rtgs' | 'cheque' | 'cash_deposit' | 'emi_debit';

export interface BankAccount {
  id: string;
  supplierId?: string | null;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  accountType: 'current' | 'savings' | 'od';
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt?: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId?: string | null;
  supplierId?: string | null;
  transactionDate: string; // YYYY-MM-DD
  mode: BankMode;
  direction: 'credit' | 'debit';
  amount: number;
  referenceNo?: string | null;
  description: string;
  cleared: boolean;
  createdAt?: string;
}

export type VendorType =
  | 'attached_vehicle'
  | 'workshop_service'
  | 'fuel_station_credit'
  | 'spare_parts'
  | 'rto_permit'
  | 'other';

export type PayableStatus = 'unpaid' | 'part_paid' | 'paid';

export interface VendorPayable {
  id: string;
  vendorName: string;
  vendorType: VendorType;
  billNo?: string | null;
  billDate: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
  balanceDue?: number;
  status: PayableStatus;
  vehicleId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type EmiStatus = 'pending' | 'paid' | 'overdue';

export interface EmiSchedule {
  id: string;
  vehicleId: string;
  financier: string;
  accountNo: string;
  monthYear: string; // YYYY-MM
  dueDate: string;
  amount: number;
  paidDate?: string | null;
  paymentReference?: string | null;
  status: EmiStatus;
  notes?: string | null;
  createdAt?: string;
}

export interface FinancialAllocationRules {
  driverPayMethod: 'actual_or_daily_bata' | 'flat_monthly_salary' | 'manual_only';
  emiAllocationMethod: 'actual_vehicle_emi' | 'pro_rata_revenue';
  costCompletenessStrict: boolean; // MANDATE: true means incomplete data produces 'incomplete data', never zero-fill!
  includeServiceInPnl: boolean;
  includeFuelInPnl: boolean;
  includeEmiInPnl: boolean;
  includeDriverPayInPnl: boolean;
  defaultWorkingDays: number;
  receivablesAgeingBrackets: number[];
}

export const DEFAULT_ALLOCATION_RULES: FinancialAllocationRules = {
  driverPayMethod: 'actual_or_daily_bata',
  emiAllocationMethod: 'actual_vehicle_emi',
  costCompletenessStrict: true,
  includeServiceInPnl: true,
  includeFuelInPnl: true,
  includeEmiInPnl: true,
  includeDriverPayInPnl: true,
  defaultWorkingDays: 30,
  receivablesAgeingBrackets: [30, 60, 90],
};
