import { describe, it, expect } from 'vitest';
import {
  validateFormula,
  evaluateFormula,
  format1SchoolTemplate,
  format2VTLTemplate,
  renderInvoiceTemplate,
  calculateFormat1Invoice,
  calculateMonthlyFixedInvoice,
  vtlLedgerTemplate,
  schoolLedgerTemplate,
  DayLedgerEntry,
  PerTripPackageParams,
  MonthlyFixedContractParams,
  parseHHMM,
} from '../engine';

describe('Milestone 2b: Template Engine & Declarative JSON Templates', () => {
  describe('Safe Expression Engine (expr-eval)', () => {
    it('validates syntax correctly', () => {
      expect(validateFormula('outputs.extraHoursAmount > 0').valid).toBe(true);
      expect(validateFormula('row.usedKm * 15').valid).toBe(true);
      expect(validateFormula('row.extraKm > 0 ? row.extraKm * 18 : 0').valid).toBe(true);
      expect(validateFormula('min(row.hours, 10)').valid).toBe(true);
      // Syntax error
      expect(validateFormula('outputs.extraHoursAmount >').valid).toBe(false);
      expect(validateFormula('** invalid').valid).toBe(false);
    });

    it('evaluates safe formulas on context data', () => {
      const context = {
        row: { usedKm: 85, extraKm: 5 },
        outputs: { fixedAmount: 65000, extraHoursAmount: 1462.5 },
      };

      expect(evaluateFormula('outputs.fixedAmount', context)).toBe(65000);
      expect(evaluateFormula('row.extraKm * 15', context)).toBe(75);
      expect(evaluateFormula('outputs.extraHoursAmount > 0', context)).toBe(true);
      expect(evaluateFormula('row.extraKm > 10 ? 100 : 50', context)).toBe(50);
      expect(evaluateFormula('min(outputs.fixedAmount, 70000)', context)).toBe(65000);
    });

    it('handles null/undefined values safely without throwing', () => {
      expect(evaluateFormula('row.nonExistent', {})).toBeNull();
      expect(evaluateFormula('', {})).toBeNull();
    });
  });

  describe('Format 1 School Template Rendering', () => {
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
      { date: '03/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('12.15'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      { date: '03/08/2026', dayStatus: 'RUN', usedKm: 84, durationMinutes: 660, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      { date: '04/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('11.45'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      { date: '04/08/2026', dayStatus: 'RUN', usedKm: 90, durationMinutes: parseHHMM('10.15'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('10.30'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 600, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('12.30'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
    ];

    it('renders Format 1 invoice with confirmed handwritten column layout', () => {
      // 1. Compute via pure engine
      const calculation = calculateFormat1Invoice(schoolLines, schoolParams);

      // 2. Render via declarative JSON template
      const rendered = renderInvoiceTemplate(format1SchoolTemplate, {
        invoice: {
          number: 'SC/2026/08/01',
          date: '31/08/2026',
          periodText: '01/08/2026 to 05/08/2026',
        },
        supplier: {
          legalName: 'StarCiti Group',
          address: 'Killipalam, Trivandrum 695002',
          phone: '+91 94470 12345',
        },
        customer: {
          name: 'The Oxford School',
          billingAddress: 'Trivandrum',
        },
        contract: {
          name: 'Daily School Transport',
          sacCode: '996601',
        },
        outputs: calculation,
        rows: calculation.rows,
      });

      // Verify visible columns (8 confirmed columns)
      const expectedColumnLabels = [
        'Date',
        'Vehicle Type',
        'Total Hours',
        'Total KM',
        'Rate',
        'Additional Hours',
        'Additional KM',
        'Amount (₹)',
      ];
      expect(rendered.columns.map((c) => c.label)).toEqual(expectedColumnLabels);

      // Verify all 8 rows rendered
      expect(rendered.rows.length).toBe(8);

      // Check first row cells
      expect(rendered.rows[0].cells.map((c) => c.formattedText)).toEqual([
        '01/08/2026',
        'Sedan',
        '10:00',
        '82 KM',
        '₹2,415.00',
        '0:00',
        '2 KM',
        '₹2,445.00',
      ]);

      // Check totals
      expect(rendered.totalAmount).toBe(21210);
      expect(rendered.amountInWords).toBe('Twenty One Thousand Two Hundred and Ten Only');
    });
  });

  describe('Format 2 VTL Template Rendering', () => {
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

    const augEntries: DayLedgerEntry[] = [
      { date: '2026-08-01', dayStatus: 'RUN', usedKm: 48, durationMinutes: 780, nightBata: true },
      { date: '2026-08-03', dayStatus: 'RUN', usedKm: 118, durationMinutes: parseHHMM('13.15') },
      { date: '2026-08-05', dayStatus: 'RUN', usedKm: 215, durationMinutes: 780, outstationBata: true, permit: 600 },
      { date: '2026-08-16', dayStatus: 'RUN', usedKm: 197, durationMinutes: parseHHMM('12.30'), outstationBata: true, permit: 600 },
      { date: '2026-08-19', dayStatus: 'RUN', usedKm: 190, durationMinutes: 780, outstationBata: true },
      { date: '2026-08-22', dayStatus: 'RUN', usedKm: 141, durationMinutes: parseHHMM('15.30'), nightBata: true },
      { date: '2026-08-31', dayStatus: 'RUN', usedKm: 107, durationMinutes: parseHHMM('13.30') },
    ];

    it('renders Format 2 VTL monthly invoice with accurate breakup box', () => {
      const calculation = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', augEntries, vtlParams);

      const rendered = renderInvoiceTemplate(format2VTLTemplate, {
        invoice: {
          number: 'CT&T/2026-2027/08/01',
          date: '31/08/2026',
          periodText: '01/08/2026 to 31/08/2026',
        },
        supplier: {
          legalName: 'M/S CITY TOURS & TRAVELS',
          address: 'Trivandrum',
          phone: '+91 94470 00000',
        },
        customer: {
          name: 'M/S Vindhya Telelinks Ltd',
          billingAddress: 'Trivandrum',
        },
        contract: {
          name: 'VTL Monthly Car Hire',
          agreementNo: 'VTL/OFC/AGMT/2024-25/001 DT. 01/09/2024',
          vehiclePlate: 'KL01 CP 3284',
          driverName: 'Sujith Kumar S',
          sacCode: '996601',
        },
        outputs: calculation,
        rows: [
          {
            description: 'Hiring charges for 7-seat AC Car KL01 CP 3284 with Driver for the month of August 2026',
            amount: calculation.fixedAmount,
          },
        ],
      });

      // Verify particulars table has single contract hiring charges row
      expect(rendered.rows.length).toBe(1);
      expect(rendered.rows[0].cells[1].formattedText).toContain('Hiring charges for 7-seat AC Car');
      expect(rendered.rows[0].cells[2].formattedText).toBe('₹65,000.00');

      // Verify breakup box contains all active components
      const breakupLabels = rendered.breakupRows.map((b) => b.label);
      expect(breakupLabels).toContain('Fixed Charges for 3000 Kms / 30 Days');
      expect(breakupLabels).toContain('Extra Working Hours (pro-rata)');
      expect(breakupLabels).toContain('Outstation Night Halt Bata');
      expect(breakupLabels).toContain('Driver Night Bata');
      expect(breakupLabels).toContain('Toll & Permit Charges');

      // Total ₹68,662
      expect(rendered.totalAmount).toBe(68662);
      expect(rendered.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Sixty Two Only');
    });
  });

  describe('Ledger Templates', () => {
    it('provides VTL ledger template with Start/Close KM, Time, Extra Hours, and Bata', () => {
      expect(vtlLedgerTemplate.fields.length).toBe(12);
      const fieldKeys = vtlLedgerTemplate.fields.map((f) => f.key);
      expect(fieldKeys).toContain('startKm');
      expect(fieldKeys).toContain('closeKm');
      expect(fieldKeys).toContain('usedKm');
      expect(fieldKeys).toContain('startTime');
      expect(fieldKeys).toContain('closeTime');
      expect(fieldKeys).toContain('extraMinutes');
      expect(fieldKeys).toContain('nightBata');
      expect(fieldKeys).toContain('outstationBata');
    });

    it('provides School ledger template supporting vehicle slot and daily hire', () => {
      expect(schoolLedgerTemplate.fields.length).toBe(6);
      const fieldKeys = schoolLedgerTemplate.fields.map((f) => f.key);
      expect(fieldKeys).toContain('vehicleSlot');
      expect(fieldKeys).toContain('usedKm');
      expect(fieldKeys).toContain('durationMinutes');
    });
  });
});
