// ==============================================================================
// Milestone 8 Tests: Accounts & Financial Reports
// Verifies: Cash Register, Bank Accounts, Payables, EMI Schedule,
//           Profit Per Vehicle & Contract (Strict Incomplete Data Protection, NEVER zero-fill),
//           Receivables Ageing, Utilisation, Excel/PDF Export, Settings Allocation Rules, RLS.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import * as XLSX from 'xlsx';
import {
  calculateVehiclePnL,
  calculateContractMargin,
  VehicleCostData,
  ContractCostData,
} from '../engine/reports/pnlEngine';
import {
  calculateReceivablesAgeing,
  InvoiceReceivableItem,
} from '../engine/reports/receivablesEngine';
import {
  calculateFleetUtilisation,
  VehicleTripLogInput,
} from '../engine/reports/utilisationEngine';
import {
  exportComprehensiveReportToExcel,
  generatePrintableReportHtml,
  ComprehensiveReportData,
} from '../engine/reports/reportExporter';
import { ServerAccountsService } from '../services/serverAccountsService';
import { DEFAULT_ALLOCATION_RULES } from '../engine/accounts/types';
import { createTestClient, assertTestDatabaseGuard, TEST_PG_CONFIG } from './testDbHelper';

describe('Milestone 8: Accounts & Financial Reports Tests', () => {
  let client: Client;

  // App User IDs for RLS testing
  const adminUserId = 'c0000000-0000-0000-0000-000000000001';
  const staffUserId = 'c0000000-0000-0000-0000-000000000002';
  const driverUserId = 'c0000000-0000-0000-0000-000000000003';
  const customerUserId = 'c0000000-0000-0000-0000-000000000004';

  const kl01VehicleId = '10000000-0000-0000-0000-000000000001'; // KL 01 CP 3284

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);

    ServerAccountsService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'test',
    };
  });

  afterAll(async () => {
    // Cleanup temporary test entries
    await client.query("DELETE FROM cash_transactions WHERE description LIKE 'TEST_%'");
    await client.query("DELETE FROM vendor_payables WHERE vendor_name LIKE 'TEST_%'");
    await client.end();
  });

  // --------------------------------------------------------------------------
  // 1. VEHICLE P&L ENGINE (STRICT INCOMPLETE DATA PROTECTION)
  // --------------------------------------------------------------------------
  describe('1. Vehicle P&L & Strict Incomplete Data Protection (Never Zero-Fill)', () => {
    it('correctly calculates vehicle profit and margin percentage when all cost components are present', () => {
      // Golden numbers: Revenue = Rs 68,662; Fuel = Rs 12,000; Service = Rs 4,650; EMI = Rs 14,250; Driver Pay = Rs 18,000
      const costData: VehicleCostData = {
        vehicleId: kl01VehicleId,
        registrationNumber: 'KL 01 CP 3284',
        vehicleModel: 'Maruti Ertiga',
        revenue: 68662,
        fuelCost: 12000,
        serviceCost: 4650,
        emiCost: 14250,
        driverPayCost: 18000,
        hasFuelEntries: true,
        hasDriverPayEntered: true,
        hasEmiEntered: true,
        hasServiceRecorded: true,
        isVehicleFinanced: true,
      };

      const result = calculateVehiclePnL(costData, '2026-08', DEFAULT_ALLOCATION_RULES);

      // Total costs = 12000 + 4650 + 14250 + 18000 = 48,900
      expect(result.totalCosts).toBe(48900);
      // Profit = 68662 - 48900 = 19,762
      expect(result.profit).toBe(19762);
      // Margin % = (19762 / 68662) * 100 = 28.8%
      expect(result.marginPercentage).toBe(28.8);
      expect(result.status).toBe('complete');
      expect(result.isComplete).toBe(true);
      expect(result.missingCostItems.length).toBe(0);
    });

    it('MANDATE: surfaces "incomplete data" when fuel cost is missing, NEVER zero-fills profit', () => {
      const missingFuelData: VehicleCostData = {
        vehicleId: kl01VehicleId,
        registrationNumber: 'KL 01 CP 3284',
        revenue: 68662,
        fuelCost: null, // Fuel not logged!
        serviceCost: 4650,
        emiCost: 14250,
        driverPayCost: 18000,
        hasFuelEntries: false,
        hasDriverPayEntered: true,
        hasEmiEntered: true,
        hasServiceRecorded: true,
        isVehicleFinanced: true,
      };

      const result = calculateVehiclePnL(missingFuelData, '2026-08', DEFAULT_ALLOCATION_RULES);

      // MUST NOT zero-fill profit or assume 0 fuel cost!
      expect(result.profit).toBeNull();
      expect(result.totalCosts).toBeNull();
      expect(result.marginPercentage).toBeNull();
      expect(result.status).toBe('incomplete_data');
      expect(result.statusLabel).toBe('Incomplete data');
      expect(result.isComplete).toBe(false);
      expect(result.missingCostItems).toContain('Fuel expenses not logged');
    });

    it('MANDATE: surfaces "incomplete data" when driver pay is missing, NEVER zero-fills profit', () => {
      const missingDriverPayData: VehicleCostData = {
        vehicleId: kl01VehicleId,
        registrationNumber: 'KL 01 CP 3284',
        revenue: 68662,
        fuelCost: 12000,
        serviceCost: 4650,
        emiCost: 14250,
        driverPayCost: null, // Driver wages / bata not entered!
        hasFuelEntries: true,
        hasDriverPayEntered: false,
        hasEmiEntered: true,
        hasServiceRecorded: true,
        isVehicleFinanced: true,
      };

      const result = calculateVehiclePnL(missingDriverPayData, '2026-08', DEFAULT_ALLOCATION_RULES);

      expect(result.profit).toBeNull();
      expect(result.totalCosts).toBeNull();
      expect(result.status).toBe('incomplete_data');
      expect(result.missingCostItems).toContain('Driver pay / bata not entered');
    });

    it('MANDATE: surfaces "incomplete data" when financed vehicle EMI is missing', () => {
      const missingEmiData: VehicleCostData = {
        vehicleId: kl01VehicleId,
        registrationNumber: 'KL 01 CP 3284',
        revenue: 68662,
        fuelCost: 12000,
        serviceCost: 4650,
        emiCost: null, // Financed car but EMI schedule missing!
        driverPayCost: 18000,
        hasFuelEntries: true,
        hasDriverPayEntered: true,
        hasEmiEntered: false,
        hasServiceRecorded: true,
        isVehicleFinanced: true,
      };

      const result = calculateVehiclePnL(missingEmiData, '2026-08', DEFAULT_ALLOCATION_RULES);

      expect(result.profit).toBeNull();
      expect(result.status).toBe('incomplete_data');
      expect(result.missingCostItems).toContain('EMI schedule / loan payment not entered');
    });
  });

  // --------------------------------------------------------------------------
  // 2. CONTRACT MARGIN ENGINE
  // --------------------------------------------------------------------------
  describe('2. Contract Margin Engine', () => {
    it('calculates contract gross margin when direct trip expenses are provided', () => {
      const data: ContractCostData = {
        contractId: 'c-vtl',
        contractNumber: 'VTL-2026-AUG',
        customerName: 'M/s Vindhya Telelinks Limited',
        monthYear: '2026-08',
        revenue: 68662,
        directFuelCost: 12000,
        driverBataCost: 1000,
        tollParkingCost: 550,
        hasFuelData: true,
        hasDriverBataData: true,
      };

      const result = calculateContractMargin(data, DEFAULT_ALLOCATION_RULES);

      expect(result.totalDirectCosts).toBe(13550);
      expect(result.grossMargin).toBe(55112); // 68662 - 13550
      expect(result.marginPercentage).toBe(80.3);
      expect(result.status).toBe('complete');
    });

    it('surfaces "incomplete data" for contract margin if direct fuel or bata is unrecorded', () => {
      const data: ContractCostData = {
        contractId: 'c-vtl',
        customerName: 'M/s Vindhya Telelinks Limited',
        monthYear: '2026-08',
        revenue: 68662,
        directFuelCost: null,
        driverBataCost: 1000,
        tollParkingCost: 0,
        hasFuelData: false,
        hasDriverBataData: true,
      };

      const result = calculateContractMargin(data, DEFAULT_ALLOCATION_RULES);

      expect(result.grossMargin).toBeNull();
      expect(result.status).toBe('incomplete_data');
      expect(result.missingCostItems).toContain('Contract fuel consumption not logged');
    });
  });

  // --------------------------------------------------------------------------
  // 3. RECEIVABLES AGEING ENGINE
  // --------------------------------------------------------------------------
  describe('3. Receivables Ageing Engine', () => {
    it('classifies invoices into ageing brackets and tracks TDS deductions', () => {
      const mockInvoices: InvoiceReceivableItem[] = [
        {
          id: 'inv-1',
          invoiceNumber: '108191',
          customerId: 'c-vtl',
          customerName: 'Vindhya Telelinks Limited',
          supplierName: 'City Tours & Travels',
          invoiceDate: '2026-08-31',
          dueDate: '2026-09-30', // Not yet due as of 2026-09-01
          totalAmount: 68662,
          amountPaid: 0,
          tdsDeducted: 0,
          balanceDue: 68662,
          status: 'issued',
        },
        {
          id: 'inv-2',
          invoiceNumber: '108180',
          customerId: 'c-vtl',
          customerName: 'Vindhya Telelinks Limited',
          supplierName: 'City Tours & Travels',
          invoiceDate: '2026-07-31',
          dueDate: '2026-08-15', // Overdue by 17 days as of 2026-09-01
          totalAmount: 65000,
          amountPaid: 30000,
          tdsDeducted: 1300,
          balanceDue: 33700,
          status: 'part_paid',
        },
        {
          id: 'inv-3',
          invoiceNumber: '108150',
          customerId: 'c-kseb',
          customerName: 'KSEB Office',
          supplierName: 'Starciti Group',
          invoiceDate: '2026-06-30',
          dueDate: '2026-07-15', // Overdue by 48 days as of 2026-09-01
          totalAmount: 45000,
          amountPaid: 0,
          tdsDeducted: 900,
          balanceDue: 44100,
          status: 'overdue',
        },
      ];

      const ageing = calculateReceivablesAgeing(mockInvoices, '2026-09-01');

      expect(ageing.asOfDate).toBe('2026-09-01');
      expect(ageing.summary.current).toBe(68662);
      expect(ageing.summary.days1To30).toBe(33700);
      expect(ageing.summary.days31To60).toBe(44100);
      expect(ageing.summary.totalOutstanding).toBe(146462); // 68662 + 33700 + 44100
      expect(ageing.summary.totalTdsDeducted).toBe(2200); // 1300 + 900
      expect(ageing.customerSummaries.length).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 4. FLEET UTILISATION ENGINE
  // --------------------------------------------------------------------------
  describe('4. Fleet Utilisation Engine', () => {
    it('accurately calculates run days, idle days, and average KM per run day', () => {
      const vehicles = [
        { id: 'v-1', registrationNumber: 'KL 01 CP 3284', model: 'Maruti Ertiga' },
        { id: 'v-2', registrationNumber: 'KL 01 BZ 4111', model: 'Toyota Innova Crysta' },
      ];

      // KL 01 CP 3284 ran on 24 distinct days for 2,492 km total
      const trips: VehicleTripLogInput[] = [];
      for (let day = 1; day <= 24; day++) {
        const dateStr = `2026-08-${String(day).padStart(2, '0')}`;
        trips.push({
          vehicleId: 'v-1',
          registrationNumber: 'KL 01 CP 3284',
          date: dateStr,
          kmRun: 104,
        });
      }

      // Add a second trip on day 1 to test distinct day deduplication
      trips.push({
        vehicleId: 'v-1',
        registrationNumber: 'KL 01 CP 3284',
        date: '2026-08-01',
        kmRun: 20,
      });

      const util = calculateFleetUtilisation(vehicles, trips, [], '2026-08');

      expect(util.calendarDays).toBe(31);
      const ertigaUtil = util.vehicles.find((v) => v.vehicleId === 'v-1');
      expect(ertigaUtil).toBeDefined();
      expect(ertigaUtil?.runDays).toBe(24);
      expect(ertigaUtil?.idleDays).toBe(7); // 31 - 24
      expect(ertigaUtil?.totalKmRun).toBe(2516); // 24*104 + 20
      expect(ertigaUtil?.averageKmPerRunDay).toBe(104.8);
      expect(ertigaUtil?.utilisationRate).toBe(77.4); // (24/31)*100
    });
  });

  // --------------------------------------------------------------------------
  // 5. DATABASE OPERATIONS (CASH, BANK, PAYABLES, EMI, SETTINGS)
  // --------------------------------------------------------------------------
  describe('5. Database Operations (Cash Register, Payables, EMI & Settings)', () => {
    it('creates cash transaction and retrieves cash ledger with admin role', async () => {
      const cash = await ServerAccountsService.createCashTransaction(adminUserId, {
        entryDate: '2026-08-20',
        transactionType: 'payment',
        category: 'fuel_settlement',
        amount: 2500,
        description: 'TEST_Fuel cash reimbursement for emergency night trip',
      });

      expect(cash.id).toBeDefined();
      expect(cash.amount).toBe(2500);
      expect(cash.category).toBe('fuel_settlement');

      const list = await ServerAccountsService.getCashTransactions(adminUserId, { category: 'fuel_settlement' });
      const found = list.find((c) => c.id === cash.id);
      expect(found).toBeDefined();
      expect(found?.description).toContain('TEST_Fuel cash reimbursement');
    });

    it('records vendor payable, handles partial and full payments, and updates status', async () => {
      // 1. Create payable
      const payable = await ServerAccountsService.createVendorPayable(staffUserId, {
        vendorName: 'TEST_Kaimanam Tyres & Spares',
        vendorType: 'spare_parts',
        billNo: 'TEST-BILL-9901',
        billDate: '2026-08-10',
        dueDate: '2026-08-25',
        amount: 8000,
        vehicleId: kl01VehicleId,
        notes: 'Two front tyres replacement for Ertiga',
      });

      expect(payable.status).toBe('unpaid');
      expect(payable.balanceDue).toBe(8000);

      // 2. Record part payment of Rs 5,000
      const partPaid = await ServerAccountsService.recordPayablePayment(staffUserId, payable.id, 5000);
      expect(partPaid.status).toBe('part_paid');
      expect(partPaid.amountPaid).toBe(5000);
      expect(partPaid.balanceDue).toBe(3000);

      // 3. Record remaining payment of Rs 3,000
      const fullyPaid = await ServerAccountsService.recordPayablePayment(staffUserId, payable.id, 3000);
      expect(fullyPaid.status).toBe('paid');
      expect(fullyPaid.amountPaid).toBe(8000);
      expect(fullyPaid.balanceDue).toBe(0);
    });

    it('updates vehicle loan EMI schedule to paid with reference', async () => {
      const schedules = await ServerAccountsService.getEmiSchedules(adminUserId, {
        vehicleId: kl01VehicleId,
        monthYear: '2026-08',
      });

      expect(schedules.length).toBeGreaterThanOrEqual(1);
      const ertigaAugEmi = schedules[0];

      const paidEmi = await ServerAccountsService.recordEmiPayment(
        adminUserId,
        ertigaAugEmi.id,
        '2026-08-09',
        'TEST-ACH-889901'
      );

      expect(paidEmi.status).toBe('paid');
      expect(paidEmi.paidDate).toBe('2026-08-09');
      expect(paidEmi.paymentReference).toBe('TEST-ACH-889901');
    });

    it('persists and retrieves configurable allocation rules in financial_settings', async () => {
      const original = await ServerAccountsService.getFinancialSettings(adminUserId);
      expect(original.costCompletenessStrict).toBe(true);

      const updated = await ServerAccountsService.updateFinancialSettings(adminUserId, {
        driverPayMethod: 'flat_monthly_salary',
        defaultWorkingDays: 30,
      });

      expect(updated.driverPayMethod).toBe('flat_monthly_salary');
      expect(updated.defaultWorkingDays).toBe(30);

      // Restore default
      await ServerAccountsService.updateFinancialSettings(adminUserId, {
        driverPayMethod: 'actual_or_daily_bata',
      });
    });
  });

  // --------------------------------------------------------------------------
  // 6. EXCEL WORKBOOK EXPORT & PRINTABLE HTML REPORT
  // --------------------------------------------------------------------------
  describe('6. Multi-Sheet Excel & HTML/PDF Report Exporter', () => {
    it('generates a valid, multi-sheet Excel workbook with all 5 report tabs', () => {
      const mockReportData: ComprehensiveReportData = {
        monthYear: '2026-08',
        generatedAt: '2026-09-01 10:00:00',
        firmName: 'Starciti Group & City Tours & Travels',
        vehiclePnL: [
          {
            vehicleId: kl01VehicleId,
            registrationNumber: 'KL 01 CP 3284',
            vehicleModel: 'Maruti Ertiga',
            monthYear: '2026-08',
            revenue: 68662,
            fuelCost: 12000,
            serviceCost: 4650,
            emiCost: 14250,
            driverPayCost: 18000,
            totalCosts: 48900,
            profit: 19762,
            marginPercentage: 28.8,
            isComplete: true,
            status: 'complete',
            statusLabel: 'Complete',
            missingCostItems: [],
          },
          {
            vehicleId: '10000000-0000-0000-0000-000000000002',
            registrationNumber: 'KL 01 BZ 4111',
            vehicleModel: 'Toyota Innova Crysta',
            monthYear: '2026-08',
            revenue: 45000,
            fuelCost: null, // missing fuel
            serviceCost: 0,
            emiCost: 21500,
            driverPayCost: null,
            totalCosts: null,
            profit: null,
            marginPercentage: null,
            isComplete: false,
            status: 'incomplete_data',
            statusLabel: 'Incomplete data',
            missingCostItems: ['Fuel expenses not logged', 'Driver pay / bata not entered'],
          },
        ],
        contractMargins: [
          {
            contractId: 'c-vtl',
            contractNumber: 'VTL-2026-AUG',
            customerName: 'M/s Vindhya Telelinks Limited',
            monthYear: '2026-08',
            revenue: 68662,
            directFuelCost: 12000,
            driverBataCost: 1000,
            tollParkingCost: 0,
            totalDirectCosts: 13000,
            grossMargin: 55662,
            marginPercentage: 81.1,
            isComplete: true,
            status: 'complete',
            statusLabel: 'Complete',
            missingCostItems: [],
          },
        ],
        receivables: {
          asOfDate: '2026-09-01',
          summary: {
            current: 68662,
            days1To30: 33700,
            days31To60: 0,
            days61To90: 0,
            daysOver90: 0,
            totalOutstanding: 102362,
            totalTdsDeducted: 1300,
          },
          customerSummaries: [],
          invoices: [],
        },
        utilisation: {
          monthYear: '2026-08',
          calendarDays: 31,
          totalVehicles: 2,
          totalFleetKm: 4200,
          averageFleetKmPerVehicle: 2100,
          fleetAverageUtilisationRate: 75.5,
          vehicles: [],
        },
      };

      const excelBuffer = exportComprehensiveReportToExcel(mockReportData);
      expect(excelBuffer).toBeDefined();
      expect(excelBuffer.byteLength).toBeGreaterThan(1000);

      // Read back workbook using XLSX to verify sheets
      const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Executive_Overview');
      expect(workbook.SheetNames).toContain('Vehicle_PnL');
      expect(workbook.SheetNames).toContain('Contract_Margins');
      expect(workbook.SheetNames).toContain('Receivables_Ageing');
      expect(workbook.SheetNames).toContain('Fleet_Utilisation');

      // Verify that 'INCOMPLETE DATA' is explicitly present in Vehicle_PnL sheet
      const pnlSheet = workbook.Sheets['Vehicle_PnL'];
      const pnlCsv = XLSX.utils.sheet_to_csv(pnlSheet);
      expect(pnlCsv).toContain('INCOMPLETE DATA');
      expect(pnlCsv).toContain('KL 01 CP 3284');
      expect(pnlCsv).toContain('19762');
    });

    it('generates valid printable HTML report containing KPI cards and tables', () => {
      const mockReportData: ComprehensiveReportData = {
        monthYear: '2026-08',
        generatedAt: '2026-09-01 10:00:00',
        firmName: 'Starciti Group',
        vehiclePnL: [
          {
            vehicleId: kl01VehicleId,
            registrationNumber: 'KL 01 CP 3284',
            vehicleModel: 'Maruti Ertiga',
            monthYear: '2026-08',
            revenue: 68662,
            fuelCost: 12000,
            serviceCost: 4650,
            emiCost: 14250,
            driverPayCost: 18000,
            totalCosts: 48900,
            profit: 19762,
            marginPercentage: 28.8,
            isComplete: true,
            status: 'complete',
            statusLabel: 'Complete',
            missingCostItems: [],
          },
        ],
        contractMargins: [],
        receivables: {
          asOfDate: '2026-09-01',
          summary: {
            current: 68662,
            days1To30: 0,
            days31To60: 0,
            days61To90: 0,
            daysOver90: 0,
            totalOutstanding: 68662,
            totalTdsDeducted: 0,
          },
          customerSummaries: [],
          invoices: [],
        },
        utilisation: {
          monthYear: '2026-08',
          calendarDays: 31,
          totalVehicles: 1,
          totalFleetKm: 2516,
          averageFleetKmPerVehicle: 2516,
          fleetAverageUtilisationRate: 77.4,
          vehicles: [
            {
              vehicleId: kl01VehicleId,
              registrationNumber: 'KL 01 CP 3284',
              vehicleModel: 'Maruti Ertiga',
              monthYear: '2026-08',
              calendarDays: 31,
              runDays: 24,
              idleDays: 7,
              maintenanceDays: 0,
              totalKmRun: 2516,
              averageKmPerRunDay: 104.8,
              utilisationRate: 77.4,
            },
          ],
        },
      };

      const html = generatePrintableReportHtml(mockReportData);
      expect(html).toContain('Starciti Group');
      expect(html).toContain('KL 01 CP 3284');
      expect(html).toContain('₹19,762');
      expect(html).toContain('77.4%');
    });
  });

  // --------------------------------------------------------------------------
  // 7. ROW LEVEL SECURITY (RLS) FOR ACCOUNTS
  // --------------------------------------------------------------------------
  describe('7. Row Level Security (RLS) Isolation for Accounts & Financials', () => {
    it('RLS: Admin and Staff can select from cash_transactions and bank_accounts', async () => {
      const adminCash = await ServerAccountsService.getCashTransactions(adminUserId);
      expect(adminCash.length).toBeGreaterThanOrEqual(1);

      const staffCash = await ServerAccountsService.getCashTransactions(staffUserId);
      expect(staffCash.length).toBeGreaterThanOrEqual(1);

      const adminBank = await ServerAccountsService.getBankAccounts(adminUserId);
      expect(adminBank.length).toBeGreaterThanOrEqual(1);
    });

    it('RLS: Driver JWT receives ZERO rows and cannot read cash register or accounts', async () => {
      const driverCash = await ServerAccountsService.getCashTransactions(driverUserId);
      expect(driverCash.length).toBe(0);

      const driverBank = await ServerAccountsService.getBankAccounts(driverUserId);
      expect(driverBank.length).toBe(0);

      const driverPayables = await ServerAccountsService.getVendorPayables(driverUserId);
      expect(driverPayables.length).toBe(0);
    });

    it('RLS: Customer Viewer JWT receives ZERO rows and cannot read accounts or financial data', async () => {
      const customerCash = await ServerAccountsService.getCashTransactions(customerUserId);
      expect(customerCash.length).toBe(0);

      const customerBank = await ServerAccountsService.getBankAccounts(customerUserId);
      expect(customerBank.length).toBe(0);

      const customerEmi = await ServerAccountsService.getEmiSchedules(customerUserId);
      expect(customerEmi.length).toBe(0);
    });
  });
});
