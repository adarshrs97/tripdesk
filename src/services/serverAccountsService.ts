// ==============================================================================
// Milestone 8: Server Accounts & Reports Service
// Interacts with PostgreSQL with full RLS support
// ==============================================================================

import { Client } from 'pg';
import {
  CashTransaction,
  BankAccount,
  BankTransaction,
  VendorPayable,
  EmiSchedule,
  FinancialAllocationRules,
  DEFAULT_ALLOCATION_RULES,
} from '../engine/accounts/types';
import { calculateVehiclePnL, calculateContractMargin, VehicleCostData } from '../engine/reports/pnlEngine';
import { calculateReceivablesAgeing, InvoiceReceivableItem } from '../engine/reports/receivablesEngine';
import { calculateFleetUtilisation, VehicleTripLogInput } from '../engine/reports/utilisationEngine';
import { ComprehensiveReportData } from '../engine/reports/reportExporter';
import { TEST_PG_CONFIG } from '../test/testDbHelper';

function formatDateOnly(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

export class ServerAccountsService {
  public static pgConfig = {
    host: TEST_PG_CONFIG.host as string,
    port: TEST_PG_CONFIG.port as number,
    user: TEST_PG_CONFIG.user as string,
    password: TEST_PG_CONFIG.password as string,
    database: 'test',
  };

  /**
   * Helper to execute queries under a specific Supabase JWT user context
   */
  public static async queryWithUser(
    userId: string | null,
    sql: string,
    params: any[] = []
  ): Promise<any> {
    const client = new Client(this.pgConfig);
    await client.connect();

    try {
      await client.query('SET ROLE starciti_app');
      if (userId) {
        await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${userId}"}', false);`);
      } else {
        await client.query(`SELECT set_config('request.jwt.claims', '', false);`);
      }

      return await client.query(sql, params);
    } finally {
      await client.end();
    }
  }

  // --------------------------------------------------------------------------
  // 1. CASH REGISTER
  // --------------------------------------------------------------------------
  public static async getCashTransactions(
    userId: string | null = null,
    filters?: { startDate?: string; endDate?: string; category?: string }
  ): Promise<CashTransaction[]> {
    let sql = `SELECT * FROM cash_transactions WHERE 1=1`;
    const params: any[] = [];

    if (filters?.startDate) {
      params.push(filters.startDate);
      sql += ` AND entry_date >= $${params.length}`;
    }
    if (filters?.endDate) {
      params.push(filters.endDate);
      sql += ` AND entry_date <= $${params.length}`;
    }
    if (filters?.category) {
      params.push(filters.category);
      sql += ` AND category = $${params.length}`;
    }

    sql += ` ORDER BY entry_date DESC, created_at DESC`;

    const res = await this.queryWithUser(userId, sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      entryDate: formatDateOnly(r.entry_date),
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

  public static async createCashTransaction(
    userId: string | null,
    input: Omit<CashTransaction, 'id' | 'createdAt' | 'createdBy' | 'runningBalance'>
  ): Promise<CashTransaction> {
    const res = await this.queryWithUser(
      userId,
      `INSERT INTO cash_transactions (
        entry_date, transaction_type, category, amount, driver_id, customer_id, vehicle_id, reference_no, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.entryDate,
        input.transactionType,
        input.category,
        input.amount,
        input.driverId || null,
        input.customerId || null,
        input.vehicleId || null,
        input.referenceNo || null,
        input.description,
      ]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      entryDate: formatDateOnly(r.entry_date),
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
    };
  }

  // --------------------------------------------------------------------------
  // 2. BANK ACCOUNTS & TRANSACTIONS
  // --------------------------------------------------------------------------
  public static async getBankAccounts(userId: string | null = null): Promise<BankAccount[]> {
    const res = await this.queryWithUser(
      userId,
      `SELECT * FROM bank_accounts WHERE is_active = TRUE ORDER BY bank_name ASC`
    );
    return res.rows.map((r: any) => ({
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

  public static async getBankTransactions(
    userId: string | null = null,
    filters?: { bankAccountId?: string }
  ): Promise<BankTransaction[]> {
    let sql = `SELECT * FROM bank_transactions WHERE 1=1`;
    const params: any[] = [];
    if (filters?.bankAccountId) {
      params.push(filters.bankAccountId);
      sql += ` AND bank_account_id = $${params.length}`;
    }
    sql += ` ORDER BY transaction_date DESC, created_at DESC`;

    const res = await this.queryWithUser(userId, sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      bankAccountId: r.bank_account_id,
      supplierId: r.supplier_id,
      transactionDate: formatDateOnly(r.transaction_date),
      mode: r.mode,
      direction: r.direction,
      amount: Number(r.amount),
      referenceNo: r.reference_no,
      description: r.description,
      cleared: r.cleared,
      createdAt: r.created_at,
    }));
  }

  // --------------------------------------------------------------------------
  // 3. VENDOR PAYABLES
  // --------------------------------------------------------------------------
  public static async getVendorPayables(
    userId: string | null = null,
    filters?: { status?: string; vendorType?: string }
  ): Promise<VendorPayable[]> {
    let sql = `SELECT * FROM vendor_payables WHERE 1=1`;
    const params: any[] = [];
    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters?.vendorType) {
      params.push(filters.vendorType);
      sql += ` AND vendor_type = $${params.length}`;
    }
    sql += ` ORDER BY due_date ASC, created_at DESC`;

    const res = await this.queryWithUser(userId, sql, params);
    return res.rows.map((r: any) => {
      const amount = Number(r.amount);
      const amountPaid = Number(r.amount_paid);
      return {
        id: r.id,
        vendorName: r.vendor_name,
        vendorType: r.vendor_type,
        billNo: r.bill_no,
        billDate: formatDateOnly(r.bill_date),
        dueDate: formatDateOnly(r.due_date),
        amount,
        amountPaid,
        balanceDue: Math.max(0, Math.round((amount - amountPaid) * 100) / 100),
        status: r.status,
        vehicleId: r.vehicle_id,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  public static async createVendorPayable(
    userId: string | null,
    input: Omit<VendorPayable, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'status' | 'balanceDue'>
  ): Promise<VendorPayable> {
    const res = await this.queryWithUser(
      userId,
      `INSERT INTO vendor_payables (
        vendor_name, vendor_type, bill_no, bill_date, due_date, amount, vehicle_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.vendorName,
        input.vendorType,
        input.billNo || null,
        input.billDate,
        input.dueDate,
        input.amount,
        input.vehicleId || null,
        input.notes || null,
      ]
    );

    const r = res.rows[0];
    const amount = Number(r.amount);
    const amountPaid = Number(r.amount_paid);
    return {
      id: r.id,
      vendorName: r.vendor_name,
      vendorType: r.vendor_type,
      billNo: r.bill_no,
      billDate: formatDateOnly(r.bill_date),
      dueDate: formatDateOnly(r.due_date),
      amount,
      amountPaid,
      balanceDue: Math.max(0, Math.round((amount - amountPaid) * 100) / 100),
      status: r.status,
      vehicleId: r.vehicle_id,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public static async recordPayablePayment(
    userId: string | null,
    payableId: string,
    paymentAmount: number
  ): Promise<VendorPayable> {
    const check = await this.queryWithUser(userId, `SELECT * FROM vendor_payables WHERE id = $1`, [payableId]);
    if (check.rows.length === 0) throw new Error('Vendor payable not found.');

    const curr = check.rows[0];
    const newPaid = Number(curr.amount_paid) + paymentAmount;
    const totalAmount = Number(curr.amount);
    const newStatus = newPaid >= totalAmount ? 'paid' : 'part_paid';

    const res = await this.queryWithUser(
      userId,
      `UPDATE vendor_payables
       SET amount_paid = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newPaid, newStatus, payableId]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      vendorName: r.vendor_name,
      vendorType: r.vendor_type,
      billNo: r.bill_no,
      billDate: formatDateOnly(r.bill_date),
      dueDate: formatDateOnly(r.due_date),
      amount: Number(r.amount),
      amountPaid: Number(r.amount_paid),
      balanceDue: Math.max(0, Math.round((Number(r.amount) - Number(r.amount_paid)) * 100) / 100),
      status: r.status,
      vehicleId: r.vehicle_id,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  // --------------------------------------------------------------------------
  // 4. EMI PAYMENT SCHEDULES
  // --------------------------------------------------------------------------
  public static async getEmiSchedules(
    userId: string | null = null,
    filters?: { vehicleId?: string; monthYear?: string; status?: string }
  ): Promise<EmiSchedule[]> {
    let sql = `SELECT * FROM emi_schedules WHERE 1=1`;
    const params: any[] = [];
    if (filters?.vehicleId) {
      params.push(filters.vehicleId);
      sql += ` AND vehicle_id = $${params.length}`;
    }
    if (filters?.monthYear) {
      params.push(filters.monthYear);
      sql += ` AND month_year = $${params.length}`;
    }
    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    sql += ` ORDER BY due_date ASC`;

    const res = await this.queryWithUser(userId, sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      financier: r.financier,
      accountNo: r.account_no,
      monthYear: r.month_year,
      dueDate: formatDateOnly(r.due_date),
      amount: Number(r.amount),
      paidDate: r.paid_date ? formatDateOnly(r.paid_date) : null,
      paymentReference: r.payment_reference,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
    }));
  }

  public static async recordEmiPayment(
    userId: string | null,
    emiId: string,
    paidDate: string,
    paymentReference: string
  ): Promise<EmiSchedule> {
    const res = await this.queryWithUser(
      userId,
      `UPDATE emi_schedules
       SET status = 'paid', paid_date = $1, payment_reference = $2
       WHERE id = $3
       RETURNING *`,
      [paidDate, paymentReference, emiId]
    );

    if (res.rows.length === 0) throw new Error('EMI schedule item not found.');
    const r = res.rows[0];
    return {
      id: r.id,
      vehicleId: r.vehicle_id,
      financier: r.financier,
      accountNo: r.account_no,
      monthYear: r.month_year,
      dueDate: formatDateOnly(r.due_date),
      amount: Number(r.amount),
      paidDate: r.paid_date ? formatDateOnly(r.paid_date) : null,
      paymentReference: r.payment_reference,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
    };
  }

  // --------------------------------------------------------------------------
  // 5. FINANCIAL ALLOCATION RULES & SETTINGS
  // --------------------------------------------------------------------------
  public static async getFinancialSettings(
    userId: string | null = null
  ): Promise<FinancialAllocationRules> {
    const res = await this.queryWithUser(
      userId,
      `SELECT allocation_rules, cost_completeness_strict FROM financial_settings LIMIT 1`
    );
    if (res.rows.length === 0) return DEFAULT_ALLOCATION_RULES;
    return {
      ...DEFAULT_ALLOCATION_RULES,
      ...res.rows[0].allocation_rules,
      costCompletenessStrict: res.rows[0].cost_completeness_strict,
    };
  }

  public static async updateFinancialSettings(
    userId: string | null,
    rules: Partial<FinancialAllocationRules>
  ): Promise<FinancialAllocationRules> {
    const current = await this.getFinancialSettings(userId);
    const updated = { ...current, ...rules };

    await this.queryWithUser(
      userId,
      `UPDATE financial_settings
       SET allocation_rules = $1,
           cost_completeness_strict = $2,
           updated_at = NOW(),
           updated_by = get_current_app_role()
       WHERE id = (SELECT id FROM financial_settings LIMIT 1)`,
      [JSON.stringify(updated), updated.costCompletenessStrict]
    );

    return updated;
  }

  // --------------------------------------------------------------------------
  // 6. COMPREHENSIVE REPORT GENERATION
  // --------------------------------------------------------------------------
  public static async generateComprehensiveReport(
    userId: string | null,
    monthYear: string = '2026-08'
  ): Promise<ComprehensiveReportData> {
    const rules = await this.getFinancialSettings(userId);

    // 1. Fetch Master Vehicles
    const vehiclesRes = await this.queryWithUser(
      userId,
      `SELECT id, registration_number, make, model, monthly_emi_amount, is_attached FROM vehicles WHERE is_active = TRUE`
    );
    const vehicles = vehiclesRes.rows;

    // 2. Fetch Invoices for Month
    const invoicesRes = await this.queryWithUser(
      userId,
      `SELECT i.id, i.invoice_number, i.customer_id, c.name as customer_name,
              s.name as supplier_name, i.invoice_date, i.due_date,
              i.total_amount, i.tds_amount, i.status,
              COALESCE((SELECT SUM(amount_received) FROM payments WHERE invoice_id = i.id), 0) as paid_amount,
              COALESCE((SELECT SUM(tds_deducted) FROM payments WHERE invoice_id = i.id), i.tds_amount, 0) as paid_tds
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       JOIN supplier_profiles s ON s.id = i.supplier_id
       WHERE TO_CHAR(i.invoice_date, 'YYYY-MM') = $1
       ORDER BY i.invoice_number ASC`,
      [monthYear]
    );

    // 3. Fetch Trip Ledger Entries for Month
    const tripsRes = await this.queryWithUser(
      userId,
      `SELECT vehicle_id, date, km_run, driver_id, driver_bata, is_night_halt, contract_id
       FROM trip_ledger
       WHERE TO_CHAR(date, 'YYYY-MM') = $1`,
      [monthYear]
    );
    const trips = tripsRes.rows;

    // 4. Fetch Fuel Entries for Month
    const fuelRes = await this.queryWithUser(
      userId,
      `SELECT vehicle_id, total_amount, status
       FROM fuel_entries
       WHERE TO_CHAR(fuel_date, 'YYYY-MM') = $1 AND status != 'rejected'`,
      [monthYear]
    );
    const fuelEntries = fuelRes.rows;

    // 5. Fetch Service / Workshop Bills for Month
    const serviceRes = await this.queryWithUser(
      userId,
      `SELECT vehicle_id, amount FROM vendor_payables
       WHERE TO_CHAR(bill_date, 'YYYY-MM') = $1 AND vendor_type IN ('workshop_service', 'spare_parts')`,
      [monthYear]
    );
    const serviceBills = serviceRes.rows;

    // 6. Fetch EMI Schedules for Month
    const emiRes = await this.queryWithUser(
      userId,
      `SELECT vehicle_id, amount FROM emi_schedules WHERE month_year = $1`,
      [monthYear]
    );
    const emiEntries = emiRes.rows;

    // Calculate Vehicle P&L
    const vehiclePnL = vehicles.map((v: any) => {
      // Find invoices allocated to this vehicle (e.g., VTL invoice 108191 allocated to KL 01 CP 3284)
      const vTrips = trips.filter((t: any) => t.vehicle_id === v.id);
      const hasTrips = vTrips.length > 0;

      // Revenue: derived dynamically from invoices or trips linked to this vehicle
      let vRevenue = 0;
      const vInvoiceIds = new Set(vTrips.map((t: any) => t.invoice_id).filter(Boolean));
      invoicesRes.rows.forEach((i: any) => {
        if (vInvoiceIds.has(i.id) || (i.vehicle_plate && (i.vehicle_plate === v.registration_number || i.vehicle_plate === v.display_reg_no))) {
          vRevenue += Number(i.total_amount || 0);
        }
      });
      if (vRevenue === 0 && vTrips.length > 0) {
        vRevenue = vTrips.reduce((acc: number, t: any) => acc + Number(t.billing_amount || 0), 0);
      }

      // Fuel
      const vFuels = fuelEntries.filter((f: any) => f.vehicle_id === v.id);
      const fuelCost = vFuels.length > 0 ? vFuels.reduce((acc: number, f: any) => acc + Number(f.total_amount), 0) : null;

      // Service
      const vServices = serviceBills.filter((s: any) => s.vehicle_id === v.id);
      const serviceCost = vServices.reduce((acc: number, s: any) => acc + Number(s.amount), 0);

      // EMI
      const vEmi = emiEntries.find((e: any) => e.vehicle_id === v.id);
      const emiCost = vEmi ? Number(vEmi.amount) : (v.monthly_emi_amount ? Number(v.monthly_emi_amount) : null);
      const isVehicleFinanced = Boolean(v.monthly_emi_amount && Number(v.monthly_emi_amount) > 0);

      // Driver pay: sum of daily driver_bata from trips if entered
      const bataSum = vTrips.reduce((acc: number, t: any) => acc + (t.driver_bata ? Number(t.driver_bata) : 0), 0);
      const driverPayCost = hasTrips && bataSum > 0 ? bataSum : null;

      const costData: VehicleCostData = {
        vehicleId: v.id,
        registrationNumber: v.registration_number,
        vehicleModel: `${v.make || ''} ${v.model || ''}`.trim(),
        revenue: vRevenue,
        fuelCost,
        serviceCost: serviceCost > 0 ? serviceCost : (hasTrips ? serviceCost : null),
        emiCost,
        driverPayCost,
        hasFuelEntries: vFuels.length > 0,
        hasDriverPayEntered: driverPayCost !== null,
        hasEmiEntered: emiCost !== null,
        hasServiceRecorded: vServices.length > 0,
        isVehicleFinanced,
      };

      return calculateVehiclePnL(costData, monthYear, rules);
    });

    // Contract Margins: queried dynamically from registered contracts and invoices
    const contractsRes = await this.queryWithUser(
      userId,
      `SELECT c.id, c.agreement_no, cust.name as customer_name
       FROM contracts c
       LEFT JOIN customers cust ON c.customer_id = cust.id`
    );
    const contractMargins = contractsRes.rows.map((c: any) => {
      const cInvoices = invoicesRes.rows.filter((i: any) => i.contract_id === c.id);
      const cRevenue = cInvoices.reduce((acc: number, i: any) => acc + Number(i.total_amount || 0), 0);
      const cTrips = trips.filter((t: any) => t.contract_id === c.id);
      const bataSum = cTrips.reduce((acc: number, t: any) => acc + (t.driver_bata ? Number(t.driver_bata) : 0), 0);
      return calculateContractMargin(
        {
          contractId: c.id,
          contractNumber: c.agreement_no || c.id,
          customerName: c.customer_name || 'Contract Customer',
          monthYear,
          revenue: cRevenue,
          directFuelCost: null,
          driverBataCost: cTrips.length > 0 && bataSum > 0 ? bataSum : null,
          tollParkingCost: 0,
          hasFuelData: false,
          hasDriverBataData: cTrips.length > 0 && bataSum > 0,
        },
        rules
      );
    });

    // Receivables Ageing
    const receivableItems: InvoiceReceivableItem[] = invoicesRes.rows.map((r: any) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      supplierName: r.supplier_name,
      invoiceDate: r.invoice_date.toISOString ? r.invoice_date.toISOString().slice(0, 10) : String(r.invoice_date).slice(0, 10),
      dueDate: r.due_date.toISOString ? r.due_date.toISOString().slice(0, 10) : String(r.due_date).slice(0, 10),
      totalAmount: Number(r.total_amount),
      amountPaid: Number(r.paid_amount),
      tdsDeducted: Number(r.paid_tds),
      balanceDue: Math.max(0, Math.round((Number(r.total_amount) - Number(r.paid_amount) - Number(r.paid_tds)) * 100) / 100),
      status: r.status,
    }));
    const receivables = calculateReceivablesAgeing(receivableItems, '2026-09-01');

    // Fleet Utilisation
    const tripLogInputs: VehicleTripLogInput[] = trips.map((t: any) => {
      const v = vehicles.find((veh: any) => veh.id === t.vehicle_id);
      return {
        vehicleId: t.vehicle_id,
        registrationNumber: v ? v.registration_number : 'UNKNOWN',
        date: t.date.toISOString ? t.date.toISOString().slice(0, 10) : String(t.date).slice(0, 10),
        kmRun: Number(t.km_run || 0),
      };
    });

    const utilisation = calculateFleetUtilisation(
      vehicles.map((v: any) => ({
        id: v.id,
        registrationNumber: v.registration_number,
        model: `${v.make || ''} ${v.model || ''}`.trim(),
      })),
      tripLogInputs,
      [],
      monthYear
    );

    const suppliersRes = await this.queryWithUser(userId, `SELECT trade_name FROM supplier_profiles WHERE is_active = true`);
    const dynamicFirmName = suppliersRes.rows.length > 0
      ? suppliersRes.rows.map((s: any) => s.trade_name).join(' & ')
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
