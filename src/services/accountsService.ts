// ==============================================================================
// Milestone 8: Client Accounts Service (Browser & Supabase Safe)
// Interacts with Supabase database under logged-in JWT / RLS
// Clean Empty States, Zero Invented Data, Dynamic Reporting & Sample Data Purge
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  CashTransaction,
  BankAccount,
  BankTransaction,
  VendorPayable,
  EmiSchedule,
  FinancialAllocationRules,
  DEFAULT_ALLOCATION_RULES,
} from '../engine/accounts/types';
import {
  calculateVehiclePnL,
  calculateContractMargin,
  VehicleCostData,
} from '../engine/reports/pnlEngine';
import { calculateReceivablesAgeing, InvoiceReceivableItem } from '../engine/reports/receivablesEngine';
import { calculateFleetUtilisation, VehicleTripLogInput } from '../engine/reports/utilisationEngine';
import { ComprehensiveReportData } from '../engine/reports/reportExporter';

export class AccountsService {
  // Empty default fallback arrays - no invented banks, vehicles or EMI loans
  private static mockCash: CashTransaction[] = [];
  private static mockBankAccounts: BankAccount[] = [];
  private static mockBankTx: BankTransaction[] = [];
  private static mockPayables: VendorPayable[] = [];
  private static mockEmi: EmiSchedule[] = [];

  private static currentRules: FinancialAllocationRules = { ...DEFAULT_ALLOCATION_RULES };

  /**
   * Check whether sample demonstration data exists in the database
   */
  public static async hasSampleData(): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const [banks, emi, payables, vehicles] = await Promise.all([
          supabase.from('bank_accounts').select('id').eq('is_sample_data', true).limit(1),
          supabase.from('emi_schedules').select('id').eq('is_sample_data', true).limit(1),
          supabase.from('vendor_payables').select('id').eq('is_sample_data', true).limit(1),
          supabase.from('vehicles').select('id').eq('is_sample_data', true).limit(1),
        ]);
        return Boolean(
          (banks.data && banks.data.length > 0) ||
          (emi.data && emi.data.length > 0) ||
          (payables.data && payables.data.length > 0) ||
          (vehicles.data && vehicles.data.length > 0)
        );
      } catch {
        return false;
      }
    }
    return this.mockBankAccounts.some(b => (b as any).isSampleData);
  }

  /**
   * One-click removal of all sample demo data across the database
   */
  public static async removeAllSampleData(): Promise<{ success: boolean; [key: string]: any }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('remove_all_sample_data');
      if (error) {
        console.error('Failed to remove sample data via RPC:', error);
        throw error;
      }
      return data;
    }

    this.mockCash = [];
    this.mockBankAccounts = [];
    this.mockBankTx = [];
    this.mockPayables = [];
    this.mockEmi = [];
    return { success: true, message: 'All sample data removed.' };
  }

  // --- CASH TRANSACTIONS ---
  public static async getCashTransactions(): Promise<CashTransaction[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('cash_transactions')
          .select('*')
          .order('entry_date', { ascending: false });
        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            entryDate: r.entry_date,
            transactionType: r.transaction_type,
            category: r.category,
            amount: Number(r.amount),
            driverId: r.driver_id,
            customerId: r.customer_id,
            vehicleId: r.vehicle_id,
            referenceNo: r.reference_no,
            description: r.description,
            runningBalance: r.running_balance !== null ? Number(r.running_balance) : null,
            createdBy: r.created_by,
            createdAt: r.created_at,
          }));
        }
      } catch (err) {
        console.warn('Fallback loading cash transactions:', err);
      }
    }
    return [...this.mockCash];
  }

  public static async createCashTransaction(
    input: Omit<CashTransaction, 'id' | 'createdAt' | 'createdBy' | 'runningBalance'>
  ): Promise<CashTransaction> {
    const newTx: CashTransaction = {
      id: crypto.randomUUID(),
      entryDate: input.entryDate,
      transactionType: input.transactionType,
      category: input.category,
      amount: input.amount,
      driverId: input.driverId,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      referenceNo: input.referenceNo,
      description: input.description,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('cash_transactions').insert({
          id: newTx.id,
          entry_date: newTx.entryDate,
          transaction_type: newTx.transactionType,
          category: newTx.category,
          amount: newTx.amount,
          driver_id: newTx.driverId || null,
          customer_id: newTx.customerId || null,
          vehicle_id: newTx.vehicleId || null,
          reference_no: newTx.referenceNo || null,
          description: newTx.description,
        });
        if (!error) {
          this.mockCash.unshift(newTx);
          return newTx;
        }
      } catch (err) {
        console.warn('Fallback saving cash transaction:', err);
      }
    }

    this.mockCash.unshift(newTx);
    return newTx;
  }

  // --- BANK ACCOUNTS ---
  public static async getBankAccounts(): Promise<BankAccount[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('is_active', true);
        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            supplierId: r.supplier_id,
            bankName: r.bank_name,
            accountNumber: r.account_number,
            ifscCode: r.ifsc_code,
            branch: r.branch,
            accountType: r.account_type,
            openingBalance: Number(r.opening_balance),
            currentBalance: Number(r.current_balance),
            isActive: r.is_active,
            createdAt: r.created_at,
          }));
        }
      } catch (err) {
        console.warn('Fallback loading bank accounts:', err);
      }
    }
    return [...this.mockBankAccounts];
  }

  public static async createBankAccount(
    input: Omit<BankAccount, 'id' | 'createdAt' | 'isActive' | 'currentBalance'>
  ): Promise<BankAccount> {
    const newAccount: BankAccount = {
      id: crypto.randomUUID(),
      supplierId: input.supplierId,
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      ifscCode: input.ifscCode,
      branch: input.branch,
      accountType: input.accountType,
      openingBalance: input.openingBalance,
      currentBalance: input.openingBalance,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('bank_accounts').insert({
          id: newAccount.id,
          supplier_id: newAccount.supplierId || null,
          bank_name: newAccount.bankName,
          account_number: newAccount.accountNumber,
          ifsc_code: newAccount.ifscCode,
          branch: newAccount.branch,
          account_type: newAccount.accountType,
          opening_balance: newAccount.openingBalance,
          current_balance: newAccount.currentBalance,
          is_active: true,
          is_sample_data: false,
        });
        if (!error) {
          this.mockBankAccounts.push(newAccount);
          return newAccount;
        }
      } catch (err) {
        console.warn('Fallback saving bank account:', err);
      }
    }

    this.mockBankAccounts.push(newAccount);
    return newAccount;
  }

  // --- BANK TRANSACTIONS ---
  public static async getBankTransactions(): Promise<BankTransaction[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('bank_transactions')
          .select('*')
          .order('transaction_date', { ascending: false });
        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            bankAccountId: r.bank_account_id,
            supplierId: r.supplier_id,
            transactionDate: r.transaction_date,
            mode: r.mode,
            direction: r.direction,
            amount: Number(r.amount),
            referenceNo: r.reference_no,
            description: r.description,
            cleared: r.cleared,
            createdAt: r.created_at,
          }));
        }
      } catch (err) {
        console.warn('Fallback loading bank transactions:', err);
      }
    }
    return [...this.mockBankTx];
  }

  public static async createBankTransaction(
    input: Omit<BankTransaction, 'id' | 'createdAt'>
  ): Promise<BankTransaction> {
    const newTx: BankTransaction = {
      id: crypto.randomUUID(),
      bankAccountId: input.bankAccountId,
      supplierId: input.supplierId,
      transactionDate: input.transactionDate,
      mode: input.mode,
      direction: input.direction,
      amount: input.amount,
      referenceNo: input.referenceNo,
      description: input.description,
      cleared: input.cleared,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('bank_transactions').insert({
          id: newTx.id,
          bank_account_id: newTx.bankAccountId || null,
          supplier_id: newTx.supplierId || null,
          transaction_date: newTx.transactionDate,
          mode: newTx.mode,
          direction: newTx.direction,
          amount: newTx.amount,
          reference_no: newTx.referenceNo || null,
          description: newTx.description,
          cleared: newTx.cleared,
          is_sample_data: false,
        });
        if (!error) {
          this.mockBankTx.unshift(newTx);
          return newTx;
        }
      } catch (err) {
        console.warn('Fallback saving bank transaction:', err);
      }
    }

    this.mockBankTx.unshift(newTx);
    return newTx;
  }

  // --- VENDOR PAYABLES ---
  public static async getVendorPayables(): Promise<VendorPayable[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vendor_payables')
          .select('*')
          .order('due_date', { ascending: true });
        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            vendorName: r.vendor_name,
            vendorType: r.vendor_type,
            billNo: r.bill_no,
            billDate: r.bill_date,
            dueDate: r.due_date,
            amount: Number(r.amount),
            amountPaid: Number(r.amount_paid),
            balanceDue: Math.max(0, Math.round((Number(r.amount) - Number(r.amount_paid)) * 100) / 100),
            status: r.status,
            vehicleId: r.vehicle_id,
            notes: r.notes,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        }
      } catch (err) {
        console.warn('Fallback loading payables:', err);
      }
    }
    return [...this.mockPayables];
  }

  public static async createVendorPayable(
    input: Omit<VendorPayable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status' | 'balanceDue'>
  ): Promise<VendorPayable> {
    const newPayable: VendorPayable = {
      id: crypto.randomUUID(),
      vendorName: input.vendorName,
      vendorType: input.vendorType,
      billNo: input.billNo,
      billDate: input.billDate,
      dueDate: input.dueDate,
      amount: input.amount,
      amountPaid: 0,
      balanceDue: input.amount,
      status: 'unpaid',
      vehicleId: input.vehicleId,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('vendor_payables').insert({
          id: newPayable.id,
          vendor_name: newPayable.vendorName,
          vendor_type: newPayable.vendorType,
          bill_no: newPayable.billNo || null,
          bill_date: newPayable.billDate,
          due_date: newPayable.dueDate,
          amount: newPayable.amount,
          vehicle_id: newPayable.vehicleId || null,
          notes: newPayable.notes || null,
          is_sample_data: false,
        });
        if (!error) {
          this.mockPayables.unshift(newPayable);
          return newPayable;
        }
      } catch (err) {
        console.warn('Fallback saving payable:', err);
      }
    }

    this.mockPayables.unshift(newPayable);
    return newPayable;
  }

  public static async recordPayablePayment(payableId: string, paymentAmount: number): Promise<VendorPayable> {
    const payable = this.mockPayables.find((p) => p.id === payableId);
    if (payable) {
      payable.amountPaid += paymentAmount;
      payable.balanceDue = Math.max(0, Math.round((payable.amount - payable.amountPaid) * 100) / 100);
      payable.status = payable.amountPaid >= payable.amount ? 'paid' : 'part_paid';
      payable.updatedAt = new Date().toISOString();
    }

    if (isSupabaseConfigured) {
      try {
        const { data: cur } = await supabase
          .from('vendor_payables')
          .select('amount, amount_paid')
          .eq('id', payableId)
          .single();
        if (cur) {
          const newPaid = Number(cur.amount_paid) + paymentAmount;
          const newStatus = newPaid >= Number(cur.amount) ? 'paid' : 'part_paid';
          await supabase
            .from('vendor_payables')
            .update({
              amount_paid: newPaid,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payableId);
        }
      } catch (err) {
        console.warn('Fallback updating payable payment:', err);
      }
    }

    return payable || {
      id: payableId,
      vendorName: 'Updated Vendor',
      vendorType: 'other',
      billDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      amount: paymentAmount,
      amountPaid: paymentAmount,
      balanceDue: 0,
      status: 'paid',
    };
  }

  // --- EMI SCHEDULES ---
  public static async getEmiSchedules(): Promise<EmiSchedule[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('emi_schedules')
          .select('*')
          .order('due_date', { ascending: true });
        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            vehicleId: r.vehicle_id,
            financier: r.financier,
            accountNo: r.account_no,
            monthYear: r.month_year,
            dueDate: r.due_date,
            amount: Number(r.amount),
            paidDate: r.paid_date,
            paymentReference: r.payment_reference,
            status: r.status,
            notes: r.notes,
            createdAt: r.created_at,
          }));
        }
      } catch (err) {
        console.warn('Fallback loading emi schedules:', err);
      }
    }
    return [...this.mockEmi];
  }

  public static async createEmiSchedule(
    input: Omit<EmiSchedule, 'id' | 'createdAt' | 'status'>
  ): Promise<EmiSchedule> {
    const newEmi: EmiSchedule = {
      id: crypto.randomUUID(),
      vehicleId: input.vehicleId,
      financier: input.financier,
      accountNo: input.accountNo,
      monthYear: input.monthYear,
      dueDate: input.dueDate,
      amount: input.amount,
      paidDate: input.paidDate || null,
      paymentReference: input.paymentReference || null,
      status: input.paidDate ? 'paid' : 'pending',
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('emi_schedules').insert({
          id: newEmi.id,
          vehicle_id: newEmi.vehicleId,
          financier: newEmi.financier,
          account_no: newEmi.accountNo,
          month_year: newEmi.monthYear,
          due_date: newEmi.dueDate,
          amount: newEmi.amount,
          paid_date: newEmi.paidDate,
          payment_reference: newEmi.paymentReference,
          status: newEmi.status,
          notes: newEmi.notes || null,
          is_sample_data: false,
        });
        if (!error) {
          this.mockEmi.push(newEmi);
          return newEmi;
        }
      } catch (err) {
        console.warn('Fallback saving emi schedule:', err);
      }
    }

    this.mockEmi.push(newEmi);
    return newEmi;
  }

  public static async recordEmiPayment(
    emiId: string,
    paidDate: string,
    paymentReference: string
  ): Promise<EmiSchedule> {
    const emi = this.mockEmi.find((e) => e.id === emiId);
    if (emi) {
      emi.status = 'paid';
      emi.paidDate = paidDate;
      emi.paymentReference = paymentReference;
    }

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('emi_schedules')
          .update({
            status: 'paid',
            paid_date: paidDate,
            payment_reference: paymentReference,
          })
          .eq('id', emiId);
      } catch (err) {
        console.warn('Fallback updating emi payment:', err);
      }
    }

    return emi || {
      id: emiId,
      vehicleId: '',
      financier: '',
      accountNo: '',
      monthYear: '',
      dueDate: '',
      amount: 0,
      status: 'paid',
      paidDate,
      paymentReference,
    };
  }

  // --- FINANCIAL & ALLOCATION SETTINGS ---
  public static async getFinancialSettings(): Promise<FinancialAllocationRules> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('financial_settings')
          .select('allocation_rules')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.allocation_rules) {
          this.currentRules = { ...DEFAULT_ALLOCATION_RULES, ...data.allocation_rules };
        }
      } catch (err) {
        console.warn('Fallback loading financial settings:', err);
      }
    }
    return { ...this.currentRules };
  }

  public static async updateFinancialSettings(
    rules: Partial<FinancialAllocationRules>
  ): Promise<FinancialAllocationRules> {
    this.currentRules = { ...this.currentRules, ...rules };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('financial_settings').insert({
          allocation_rules: this.currentRules,
          cost_completeness_strict: this.currentRules.costCompletenessStrict ?? true,
        });
      } catch (err) {
        console.warn('Fallback saving financial settings:', err);
      }
    }

    return { ...this.currentRules };
  }

  // --- DYNAMIC COMPREHENSIVE FINANCIAL REPORT ---
  public static async generateComprehensiveReport(
    monthYear: string = '2026-08'
  ): Promise<ComprehensiveReportData> {
    const rules = await this.getFinancialSettings();

    // 1. Fetch registered fleet vehicles (strictly active and verified)
    let vehicles: any[] = [];
    let invoices: any[] = [];
    let trips: any[] = [];
    let contracts: any[] = [];
    let suppliers: any[] = [];

    if (isSupabaseConfigured) {
      try {
        const { data: vData } = await supabase
          .from('vehicles')
          .select('id, reg_no, display_reg_no, make_model, vehicle_type, is_active')
          .eq('is_active', true);
        if (vData) vehicles = vData;

        const { data: invData } = await supabase
          .from('invoices')
          .select('id, invoice_number, customer_id, contract_id, supplier_id, invoice_date, due_date, total_amount, paid_amount, paid_tds, status, vehicle_plate');
        if (invData) invoices = invData;

        const { data: tripData } = await supabase
          .from('trip_ledger')
          .select('id, vehicle_id, contract_id, date, km_run, billing_amount, driver_bata')
          .gte('date', `${monthYear}-01`)
          .lte('date', `${monthYear}-31`);
        if (tripData) trips = tripData;

        const { data: cData } = await supabase
          .from('contracts')
          .select('id, agreement_no, customer_id, customers(name)');
        if (cData) contracts = cData;

        const { data: sData } = await supabase
          .from('supplier_profiles')
          .select('trade_name')
          .eq('is_active', true);
        if (sData) suppliers = sData;
      } catch (err) {
        console.warn('Could not query financial tables from DB:', err);
      }
    }

    // 2. Fetch fuel totals for the month
    let fuelByVehicle: Record<string, number> = {};
    if (isSupabaseConfigured) {
      try {
        const { data: fuelRows } = await supabase
          .from('fuel_entries')
          .select('vehicle_id, total_amount')
          .gte('fuel_date', `${monthYear}-01`)
          .lte('fuel_date', `${monthYear}-31`);
        if (fuelRows) {
          for (const f of fuelRows) {
            fuelByVehicle[f.vehicle_id] = (fuelByVehicle[f.vehicle_id] || 0) + Number(f.total_amount);
          }
        }
      } catch (err) {
        console.warn('Could not query fuel from DB:', err);
      }
    }

    // 3. Build Vehicle Cost Inputs with strict incomplete data protection
    const vehicleCostInputs: VehicleCostData[] = vehicles.map((v) => {
      const vTrips = trips.filter((t) => t.vehicle_id === v.id);
      const vPlate = v.display_reg_no || v.reg_no;
      const vInvoices = invoices.filter((i) => i.vehicle_plate === vPlate || i.vehicle_plate === v.reg_no);
      
      let vRevenue = vInvoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
      if (vRevenue === 0 && vTrips.length > 0) {
        vRevenue = vTrips.reduce((acc, t) => acc + Number(t.billing_amount || 0), 0);
      }

      const fuelCost = fuelByVehicle[v.id] ?? null;
      const bataSum = vTrips.reduce((acc, t) => acc + (t.driver_bata ? Number(t.driver_bata) : 0), 0);
      const driverPayCost = vTrips.length > 0 && bataSum > 0 ? bataSum : null;

      return {
        vehicleId: v.id,
        registrationNumber: v.display_reg_no || v.reg_no,
        vehicleModel: v.make_model || 'Fleet Vehicle',
        revenue: vRevenue,
        fuelCost: fuelCost,
        serviceCost: null,
        emiCost: null,
        driverPayCost: driverPayCost,
        hasFuelEntries: fuelCost !== null,
        hasDriverPayEntered: driverPayCost !== null,
        hasEmiEntered: false,
        hasServiceRecorded: false,
        isVehicleFinanced: false,
      };
    });

    const vehiclePnL = vehicleCostInputs.map((v) => calculateVehiclePnL(v, monthYear, rules));

    // 4. Contract Margins (dynamically from registered contracts)
    const contractMargins = contracts.map((c) => {
      const cInvoices = invoices.filter((i) => i.contract_id === c.id);
      const cRevenue = cInvoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
      const cTrips = trips.filter((t) => t.contract_id === c.id);
      const cBata = cTrips.reduce((acc, t) => acc + (t.driver_bata ? Number(t.driver_bata) : 0), 0);
      const custName = (c.customers as any)?.name || 'Contract Customer';

      return calculateContractMargin(
        {
          contractId: c.id,
          contractNumber: c.agreement_no || c.id,
          customerName: custName,
          monthYear,
          revenue: cRevenue,
          directFuelCost: null,
          driverBataCost: cTrips.length > 0 && cBata > 0 ? cBata : null,
          tollParkingCost: 0,
          hasFuelData: false,
          hasDriverBataData: cTrips.length > 0 && cBata > 0,
        },
        rules
      );
    });

    // 5. Receivables Ageing (from real customer invoices)
    const receivableItems: InvoiceReceivableItem[] = invoices.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerId: r.customer_id,
      customerName: r.customer_name || 'Customer',
      supplierName: r.supplier_name || 'Supplier',
      invoiceDate: String(r.invoice_date).slice(0, 10),
      dueDate: String(r.due_date || r.invoice_date).slice(0, 10),
      totalAmount: Number(r.total_amount || 0),
      amountPaid: Number(r.paid_amount || 0),
      tdsDeducted: Number(r.paid_tds || 0),
      balanceDue: Math.max(0, Math.round((Number(r.total_amount || 0) - Number(r.paid_amount || 0) - Number(r.paid_tds || 0)) * 100) / 100),
      status: r.status,
    }));

    const receivables = calculateReceivablesAgeing(receivableItems, `${monthYear}-01`);

    // 6. Utilisation (from actual trip logs)
    const tripLogInputs: VehicleTripLogInput[] = trips.map((t) => {
      const v = vehicles.find((veh) => veh.id === t.vehicle_id);
      return {
        vehicleId: t.vehicle_id,
        registrationNumber: v ? (v.display_reg_no || v.reg_no) : 'UNKNOWN',
        date: String(t.date).slice(0, 10),
        kmRun: Number(t.km_run || 0),
      };
    });

    const utilisation = calculateFleetUtilisation(
      vehicles.map((v) => ({
        id: v.id,
        registrationNumber: v.display_reg_no || v.reg_no,
        model: v.make_model || 'Fleet Vehicle',
      })),
      tripLogInputs,
      [],
      monthYear
    );

    const dynamicFirmName = suppliers.length > 0
      ? suppliers.map((s) => s.trade_name).join(' & ')
      : 'Fleet Management Desk';

    return {
      monthYear,
      generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      firmName: dynamicFirmName,
      vehiclePnL,
      contractMargins,
      receivables,
      utilisation,
    };
  }
}
