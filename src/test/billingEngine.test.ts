import { describe, it, expect } from 'vitest';
import {
  parseHHMM,
  formatMinutesToHM,
  parseTimeString,
  calculateTripDurationMinutes,
  inrWords,
  applyRounding,
  calculateFormat1Row,
  calculateFormat1Invoice,
  calculateMonthlyFixedInvoice,
  DayLedgerEntry,
  PerTripPackageParams,
  MonthlyFixedContractParams,
} from '../engine';

describe('Milestone 2: Pure Billing Engine & Golden Tests', () => {
  // GOLDEN TEST 1: Format 1 School 8 lines from reference photo
  describe('Golden Test 1: Format 1 School 8 lines (§3.2)', () => {
    const schoolParams: PerTripPackageParams = {
      baseAmount: 2415,
      includedHours: 10,
      includedKm: 80,
      extraHourRate: 200,
      extraKmRate: 15,
      roundingMode: 'down',
    };

    const schoolLines: DayLedgerEntry[] = [
      // Line 1: 01/08/2026, min hours (10h), 82 KM -> 2,445
      { date: '01/08/2026', dayStatus: 'RUN', usedKm: 82, durationMinutes: 600, vehicleType: 'Sedan' },
      // Line 2: 03/08/2026 Vehicle 1, 12.15 hours (735 min), min KM (80 km) -> 2,865
      { date: '03/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('12.15'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      // Line 3: 03/08/2026 Vehicle 2, 11 hours (660 min), 84 KM -> 2,675
      { date: '03/08/2026', dayStatus: 'RUN', usedKm: 84, durationMinutes: 660, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      // Line 4: 04/08/2026 Vehicle 1, 11.45 hours (705 min), min KM (80 km) -> 2,765
      { date: '04/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('11.45'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      // Line 5: 04/08/2026 Vehicle 2, 10.15 hours (615 min), 90 KM -> 2,615
      { date: '04/08/2026', dayStatus: 'RUN', usedKm: 90, durationMinutes: parseHHMM('10.15'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      // Line 6: 05/08/2026 Vehicle 1, 10.30 hours (630 min), min KM (80 km) -> 2,515
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('10.30'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      // Line 7: 05/08/2026 Vehicle 2, min hours (10h), min KM (80 km) -> 2,415
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 600, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      // Line 8: 05/08/2026 Vehicle 1, 12.30 hours (750 min), min KM (80 km) -> 2,915
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('12.30'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
    ];

    it('calculates each of the 8 lines with 100% exact rupee precision', () => {
      const expectedAmounts = [2445, 2865, 2675, 2765, 2615, 2515, 2415, 2915];

      schoolLines.forEach((line, idx) => {
        const result = calculateFormat1Row(line, schoolParams);
        expect(result.lineTotal).toBe(expectedAmounts[idx]);
      });
    });

    it('sums all 8 lines to exactly ₹21,210', () => {
      const invoiceResult = calculateFormat1Invoice(schoolLines, schoolParams);
      expect(invoiceResult.subtotal).toBe(21210);
      expect(invoiceResult.totalAmount).toBe(21210);
      expect(invoiceResult.amountInWords).toBe('Twenty One Thousand Two Hundred and Ten Only');
    });
  });

  // GOLDEN TEST 2: Aug 2026 VTL Monthly Fixed Contract
  describe('Golden Test 2: VTL Monthly Contract Aug 2026 (§7)', () => {
    const vtlParamsAug2026: MonthlyFixedContractParams = {
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

    // Real August 2026 ledger data reconstructed from Excel Aug sheet
    const augEntries: DayLedgerEntry[] = [
      // Aug 1: St 155622, Cl 155670 (48 km), ST 05:00, CL 18:00 (13h -> 1h extra), Night Bata 200
      { date: '2026-08-01', dayStatus: 'RUN', usedKm: 48, durationMinutes: 780, nightBata: true, remarks: 'Kachani, Airport (AVP)' },
      // Aug 2: Sunday
      { date: '2026-08-02', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
      // Aug 3: St 155705, Cl 155823 (118 km), ST 06:15, CL 19:30 (13h 15m -> 1h 15m extra = 75 min)
      { date: '2026-08-03', dayStatus: 'RUN', usedKm: 118, durationMinutes: parseHHMM('13.15'), remarks: 'Kattakada KSEB' },
      // Aug 4: 48 km, 11h 15m
      { date: '2026-08-04', dayStatus: 'RUN', usedKm: 48, durationMinutes: parseHHMM('11.15'), remarks: 'Site Trips' },
      // Aug 5: 215 km, 13h (1h extra = 60 min), Outstation Bata 200, Permit 600
      { date: '2026-08-05', dayStatus: 'RUN', usedKm: 215, durationMinutes: 780, outstationBata: true, permit: 600, remarks: 'Premit Kaushel Kanyakumari' },
      // Aug 6: 74 km, 11.30h
      { date: '2026-08-06', dayStatus: 'RUN', usedKm: 74, durationMinutes: parseHHMM('11.30') },
      // Aug 7: 43 km, 12h
      { date: '2026-08-07', dayStatus: 'RUN', usedKm: 43, durationMinutes: 720 },
      // Aug 8: 46 km, 9.45h
      { date: '2026-08-08', dayStatus: 'RUN', usedKm: 46, durationMinutes: parseHHMM('9.45') },
      // Aug 9: Sunday
      { date: '2026-08-09', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
      // Aug 10: 54 km, 10.15h
      { date: '2026-08-10', dayStatus: 'RUN', usedKm: 54, durationMinutes: parseHHMM('10.15') },
      // Aug 11: 25 km, 10.15h
      { date: '2026-08-11', dayStatus: 'RUN', usedKm: 25, durationMinutes: parseHHMM('10.15') },
      // Aug 12: 70 km, 9.30h
      { date: '2026-08-12', dayStatus: 'RUN', usedKm: 70, durationMinutes: parseHHMM('9.30') },
      // Aug 13: 33 km, 10.30h
      { date: '2026-08-13', dayStatus: 'RUN', usedKm: 33, durationMinutes: parseHHMM('10.30') },
      // Aug 14: 55 km, 10h
      { date: '2026-08-14', dayStatus: 'RUN', usedKm: 55, durationMinutes: 600 },
      // Aug 15: 8 km, 2.45h
      { date: '2026-08-15', dayStatus: 'RUN', usedKm: 8, durationMinutes: parseHHMM('2.45') },
      // Aug 16: 197 km, 12h 30m (30 min extra = 30 min), Outstation Bata 200, Permit 600
      { date: '2026-08-16', dayStatus: 'RUN', usedKm: 197, durationMinutes: parseHHMM('12.30'), outstationBata: true, permit: 600, remarks: 'Premit Kanyakumari' },
      // Aug 17: 34 km, 10h
      { date: '2026-08-17', dayStatus: 'RUN', usedKm: 34, durationMinutes: 600 },
      // Aug 18: 25 km, 10.15h
      { date: '2026-08-18', dayStatus: 'RUN', usedKm: 25, durationMinutes: parseHHMM('10.15') },
      // Aug 19: 190 km, 13h (1h extra = 60 min), Outstation Bata 200
      { date: '2026-08-19', dayStatus: 'RUN', usedKm: 190, durationMinutes: 780, outstationBata: true, remarks: 'Kollam' },
      // Aug 20: 50 km, 9h (Substitute vehicle KL74 E 3694, Afzal)
      { date: '2026-08-20', dayStatus: 'RUN', usedKm: 50, durationMinutes: 540, vehicleType: 'sedan' },
      // Aug 21: 83 km, 11.30h
      { date: '2026-08-21', dayStatus: 'RUN', usedKm: 83, durationMinutes: parseHHMM('11.30') },
      // Aug 22: 141 km, 15h 30m (3h 30m extra = 210 min), Night Bata 200 (05:00 start)
      { date: '2026-08-22', dayStatus: 'RUN', usedKm: 141, durationMinutes: parseHHMM('15.30'), nightBata: true },
      // Aug 23: Sunday
      { date: '2026-08-23', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
      // Aug 24: 93 km, 11h
      { date: '2026-08-24', dayStatus: 'RUN', usedKm: 93, durationMinutes: 660 },
      // Aug 25: 52 km, 4h
      { date: '2026-08-25', dayStatus: 'RUN', usedKm: 52, durationMinutes: 240 },
      // Aug 26: ONAM (Holiday)
      { date: '2026-08-26', dayStatus: 'HOLIDAY', usedKm: 0, durationMinutes: 0 },
      // Aug 27: 22 km, 9h
      { date: '2026-08-27', dayStatus: 'RUN', usedKm: 22, durationMinutes: 540 },
      // Aug 28: Holiday
      { date: '2026-08-28', dayStatus: 'HOLIDAY', usedKm: 0, durationMinutes: 0 },
      // Aug 29: 53 km, 9h
      { date: '2026-08-29', dayStatus: 'RUN', usedKm: 53, durationMinutes: 540 },
      // Aug 30: Sunday
      { date: '2026-08-30', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
      // Aug 31: 107 km, 13h 30m (1h 30m extra = 90 min)
      { date: '2026-08-31', dayStatus: 'RUN', usedKm: 107, durationMinutes: parseHHMM('13.30') },
    ];

    it('verifies August run days = 25, used km = 1884, extra minutes = 585 (9h 45m)', () => {
      const result = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', augEntries, vtlParamsAug2026);

      expect(result.actualRunDays).toBe(25);
      expect(result.contractWorkingDays).toBe(30);
      expect(result.totalKmUsed).toBe(1884);
      expect(result.extraKm).toBe(0); // 1884 < 3000

      // Extra minutes: 60 + 75 + 60 + 30 + 60 + 210 + 90 = 585 mins
      expect(result.totalExtraMinutes).toBe(585);
      expect(result.extraHoursDecimal).toBe(9.75); // 585 / 60 = 9.75 hours
      expect(result.extraHoursAmount).toBe(1462.50); // 9.75 * 150 = 1462.50
      expect(result.nightBataAmount).toBe(400); // 2 days @ 200
      expect(result.outstationBataAmount).toBe(600); // 3 days @ 200
      expect(result.tollPermitAmount).toBe(1200); // 2 days @ 600

      // Correct engine total: 65000 + 1462.50 + 400 + 600 + 1200 = 68662.50 -> rounded down = 68662
      expect(result.subtotal).toBe(68662.50);
      expect(result.totalAmount).toBe(68662);
      expect(result.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Sixty Two Only');
    });

    it('reproduces the historical decimal mistake when legacy flag is enabled: yields ₹68,617.50 -> ₹68,617', () => {
      const legacyParams: MonthlyFixedContractParams = {
        ...vtlParamsAug2026,
        legacyDecimalHoursBug: true,
      };

      const result = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', augEntries, legacyParams);

      expect(result.extraHoursDecimal).toBe(9.45); // Treated 9h 45m as decimal 9.45!
      expect(result.extraHoursAmount).toBe(1417.50); // 9.45 * 150 = 1417.50
      expect(result.subtotal).toBe(68617.50);
      expect(result.totalAmount).toBe(68617); // Printed 68617 on PDF!
      expect(result.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Seventeen Only');
    });
  });

  // GOLDEN TEST 3: Indian Currency in Words
  describe('Golden Test 3: inrWords (§7)', () => {
    it('converts amounts to standard Indian English words with Lakhs/Crores grouping', () => {
      expect(inrWords(68617)).toBe('Sixty Eight Thousand Six Hundred and Seventeen Only');
      expect(inrWords(21210)).toBe('Twenty One Thousand Two Hundred and Ten Only');
      expect(inrWords(2445)).toBe('Two Thousand Four Hundred and Forty Five Only');
      expect(inrWords(65000)).toBe('Sixty Five Thousand Only');
      expect(inrWords(100000)).toBe('One Lakh Only');
      expect(inrWords(10000000)).toBe('One Crore Only');
      expect(inrWords(0)).toBe('Zero Rupees Only');
    });
  });

  // GOLDEN TEST 4: Duration & Time Parsing
  describe('Golden Test 4: Duration & Time Parsing (§7)', () => {
    it('parses HH.MM duration strings into integer minutes', () => {
      expect(parseHHMM('12.15')).toBe(735); // 12 * 60 + 15
      expect(parseHHMM('10.30')).toBe(630); // 10 * 60 + 30
      expect(parseHHMM('11.45')).toBe(705); // 11 * 60 + 45
      expect(parseHHMM('9.45')).toBe(585);  // 9 * 60 + 45
      expect(parseHHMM('10')).toBe(600);    // 10 * 60
    });

    it('rejects minutes >= 60 in parseHHMM', () => {
      expect(() => parseHHMM('1.75')).toThrow(/minutes must be < 60/);
      expect(() => parseHHMM('2.60')).toThrow(/minutes must be < 60/);
    });

    it('parses messy text time strings from sheet ALL', () => {
      expect(parseTimeString('9.am')).toBe(540); // 09:00
      expect(parseTimeString('10.pm night')).toBe(1320); // 22:00
      expect(parseTimeString('7Pm')).toBe(1140); // 19:00
      expect(parseTimeString('5.15am')).toBe(315); // 05:15
      expect(parseTimeString('9.15p m')).toBe(1275); // 21:15
      expect(parseTimeString('8.45')).toBe(525); // 08:45
      expect(parseTimeString(0.375)).toBe(540); // 0.375 of day = 09:00
    });

    it('formats integer minutes back to HH:MM', () => {
      expect(formatMinutesToHM(735)).toBe('12:15');
      expect(formatMinutesToHM(585)).toBe('9:45');
      expect(formatMinutesToHM(60)).toBe('1:00');
      expect(formatMinutesToHM(0)).toBe('0:00');
    });

    it('calculates duration between start time and close time across noon and midnight', () => {
      // 05:00 to 18:00 = 13 hours = 780 min
      expect(calculateTripDurationMinutes('05:00', '18:00')).toBe(780);
      // 22:00 to 02:00 next day = 4 hours = 240 min
      expect(calculateTripDurationMinutes('22:00', '02:00')).toBe(240);
    });

    it('tests rounding utilities (down, nearest, none)', () => {
      expect(applyRounding(68662.5, 'down').rounded).toBe(68662);
      expect(applyRounding(68662.5, 'down').roundOff).toBe(-0.5);
      expect(applyRounding(68662.6, 'nearest').rounded).toBe(68663);
      expect(applyRounding(68662.4, 'nearest').rounded).toBe(68662);
      expect(applyRounding(68662.5, 'none').rounded).toBe(68662.5);
    });
  });

  // GOLDEN TEST 5: Versioned Terms Calculation (Aug 2025 vs Aug 2026)
  describe('Golden Test 5: Versioned Terms Calculation (§7)', () => {
    it('applies older Aug 2025 contract terms (2,700 km, 10h, Rs 250 bata)', () => {
      const aug2025Params: MonthlyFixedContractParams = {
        fixedAmount: 65000,
        includedKm: 2700,
        includedHoursPerDay: 10,
        extraKmRate: 18,
        extraHourRate: 150,
        nightBataRate: 250,
        outstationBataRate: 250,
        roundingMode: 'down',
      };

      const sampleEntry: DayLedgerEntry[] = [
        { date: '2025-08-01', dayStatus: 'RUN', usedKm: 200, durationMinutes: 720, nightBata: true, outstationBata: true }
      ];

      const res = calculateMonthlyFixedInvoice('2025-08-01', '2025-08-31', sampleEntry, aug2025Params);
      expect(res.nightBataAmount).toBe(250); // Rs 250 in 2025!
      expect(res.outstationBataAmount).toBe(250); // Rs 250 in 2025!
      expect(res.fixedKm).toBe(2700); // 2700 km in 2025!
    });

    it('applies Aug 2026 contract terms (3,000 km, 12h, Rs 200 bata)', () => {
      const aug2026Params: MonthlyFixedContractParams = {
        fixedAmount: 65000,
        includedKm: 3000,
        includedHoursPerDay: 12,
        extraKmRate: 18,
        extraHourRate: 150,
        nightBataRate: 200,
        outstationBataRate: 200,
        roundingMode: 'down',
      };

      const sampleEntry: DayLedgerEntry[] = [
        { date: '2026-08-01', dayStatus: 'RUN', usedKm: 200, durationMinutes: 720, nightBata: true, outstationBata: true }
      ];

      const res = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', sampleEntry, aug2026Params);
      expect(res.nightBataAmount).toBe(200); // Rs 200 in 2026!
      expect(res.outstationBataAmount).toBe(200); // Rs 200 in 2026!
      expect(res.fixedKm).toBe(3000); // 3000 km in 2026!
    });
  });

  // GOLDEN TEST 6: Property Tests
  describe('Golden Test 6: Invariant & Property Tests (§7)', () => {
    it('monotonicity: amount never decreases when km or hours increase', () => {
      const baseParams: PerTripPackageParams = {
        baseAmount: 2415,
        includedHours: 10,
        includedKm: 80,
        extraHourRate: 200,
        extraKmRate: 15,
      };

      const baseRes = calculateFormat1Row({ date: '2026-08-01', dayStatus: 'RUN', usedKm: 80, durationMinutes: 600 }, baseParams);

      // Higher KM
      const higherKmRes = calculateFormat1Row({ date: '2026-08-01', dayStatus: 'RUN', usedKm: 90, durationMinutes: 600 }, baseParams);
      expect(higherKmRes.lineTotal).toBeGreaterThanOrEqual(baseRes.lineTotal);

      // Higher Hours
      const higherHrRes = calculateFormat1Row({ date: '2026-08-01', dayStatus: 'RUN', usedKm: 80, durationMinutes: 720 }, baseParams);
      expect(higherHrRes.lineTotal).toBeGreaterThanOrEqual(baseRes.lineTotal);

      // Both higher
      const bothHigherRes = calculateFormat1Row({ date: '2026-08-01', dayStatus: 'RUN', usedKm: 95, durationMinutes: 750 }, baseParams);
      expect(bothHigherRes.lineTotal).toBeGreaterThanOrEqual(higherKmRes.lineTotal);
      expect(bothHigherRes.lineTotal).toBeGreaterThanOrEqual(higherHrRes.lineTotal);
    });

    it('additivity: total invoice amount equals the sum of line items', () => {
      const schoolParams: PerTripPackageParams = {
        baseAmount: 2415,
        includedHours: 10,
        includedKm: 80,
        extraHourRate: 200,
        extraKmRate: 15,
      };

      const lines: DayLedgerEntry[] = [
        { date: '2026-08-01', dayStatus: 'RUN', usedKm: 82, durationMinutes: 600 },
        { date: '2026-08-02', dayStatus: 'RUN', usedKm: 84, durationMinutes: 660 },
        { date: '2026-08-03', dayStatus: 'RUN', usedKm: 90, durationMinutes: 615 },
      ];

      const inv = calculateFormat1Invoice(lines, schoolParams);
      const manualSum = inv.rows.reduce((sum, r) => sum + r.lineTotal, 0);
      expect(inv.subtotal).toBe(manualSum);
    });
  });
});
