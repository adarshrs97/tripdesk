import { describe, it, expect } from 'vitest';
import {
  resolveEffectiveRule,
  RuleDefinition,
  RuleEvaluationContext,
  calculateMonthlyFixedInvoice,
  detectLedgerAnomalies,
  DayLedgerEntry,
  MonthlyFixedContractParams,
  parseHHMM,
} from '../engine';

describe('Milestone 3 / Add-On: Declarative Rule Builder & Scope Ladder Tests', () => {
  // Real August 2026 ledger entries from VTL contract
  const augEntries: DayLedgerEntry[] = [
    { date: '2026-08-01', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 48, durationMinutes: 780, nightBata: true },
    { date: '2026-08-02', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
    { date: '2026-08-03', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 118, durationMinutes: parseHHMM('13.15') },
    { date: '2026-08-04', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 48, durationMinutes: parseHHMM('11.15') },
    { date: '2026-08-05', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 215, durationMinutes: 780, outstationBata: true, permit: 600 },
    { date: '2026-08-06', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 74, durationMinutes: parseHHMM('11.30') },
    { date: '2026-08-07', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 43, durationMinutes: 720 },
    { date: '2026-08-08', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 46, durationMinutes: parseHHMM('9.45') },
    { date: '2026-08-09', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
    { date: '2026-08-10', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 54, durationMinutes: parseHHMM('10.15') },
    { date: '2026-08-11', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 25, durationMinutes: parseHHMM('10.15') },
    { date: '2026-08-12', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 70, durationMinutes: parseHHMM('9.30') },
    { date: '2026-08-13', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 33, durationMinutes: parseHHMM('10.30') },
    { date: '2026-08-14', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 55, durationMinutes: 600 },
    { date: '2026-08-15', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 8, durationMinutes: parseHHMM('2.45') },
    { date: '2026-08-16', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 197, durationMinutes: parseHHMM('12.30'), outstationBata: true, permit: 600 },
    { date: '2026-08-17', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 34, durationMinutes: 600 },
    { date: '2026-08-18', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 25, durationMinutes: parseHHMM('10.15') },
    { date: '2026-08-19', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 190, durationMinutes: 780, outstationBata: true },
    { date: '2026-08-20', dayStatus: 'RUN', vehiclePlate: 'KL74 E 3694', usedKm: 50, durationMinutes: 540 },
    { date: '2026-08-21', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 83, durationMinutes: parseHHMM('11.30') },
    { date: '2026-08-22', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 141, durationMinutes: parseHHMM('15.30'), nightBata: true },
    { date: '2026-08-23', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
    { date: '2026-08-24', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 93, durationMinutes: 660 },
    { date: '2026-08-25', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 52, durationMinutes: 240 },
    { date: '2026-08-26', dayStatus: 'HOLIDAY', usedKm: 0, durationMinutes: 0 },
    { date: '2026-08-27', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 22, durationMinutes: 540 },
    { date: '2026-08-28', dayStatus: 'HOLIDAY', usedKm: 0, durationMinutes: 0 },
    { date: '2026-08-29', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 53, durationMinutes: 540 },
    { date: '2026-08-30', dayStatus: 'SUNDAY', usedKm: 0, durationMinutes: 0 },
    { date: '2026-08-31', dayStatus: 'RUN', vehiclePlate: 'KL01 CP 3284', usedKm: 107, durationMinutes: parseHHMM('13.30') },
  ];

  const baseVtlParams: MonthlyFixedContractParams = {
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

  // TEST 1: Rounding changed setting (rounding=nearest -> VTL Aug = 68,663)
  it('Setting test: rounding=down gives ₹68,662, whereas rounding=nearest gives ₹68,663', () => {
    // 1. Default / Contract floor rounding -> ₹68,662
    const resultDown = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', augEntries, {
      ...baseVtlParams,
      roundingMode: 'down',
    });
    expect(resultDown.subtotal).toBe(68662.50);
    expect(resultDown.totalAmount).toBe(68662);
    expect(resultDown.roundOff).toBe(-0.50);
    expect(resultDown.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Sixty Two Only');

    // 2. Changed setting: rounding=nearest -> ₹68,663!
    const resultNearest = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', augEntries, {
      ...baseVtlParams,
      roundingMode: 'nearest',
    });
    expect(resultNearest.subtotal).toBe(68662.50);
    expect(resultNearest.totalAmount).toBe(68663);
    expect(resultNearest.roundOff).toBe(0.50);
    expect(resultNearest.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Sixty Three Only');
  });

  // TEST 2: Extra-hour rounding (30 min block rounding)
  it('Setting test: extra-hour 30-min block rounding calculates correct rounded duration & amount', () => {
    // With 30 min block rounding (ceil):
    // Day 3: 75 min extra (1h 15m) -> rounds up to 90 min (1h 30m)
    // Total extra minutes: 60 + 90 + 60 + 30 + 60 + 210 + 90 = 600 min (10 hours)
    // Extra hours amount: 10 * 150 = ₹1,500
    // Total invoice: 65000 + 1500 + 400 + 600 + 1200 = 68700
    const result30Min = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', augEntries, {
      ...baseVtlParams,
      extraHourBlockMinutes: 30,
      extraHourRoundingDirection: 'ceil',
    });

    expect(result30Min.totalExtraMinutes).toBe(600);
    expect(result30Min.extraHoursDecimal).toBe(10);
    expect(result30Min.extraHoursAmount).toBe(1500);
    expect(result30Min.subtotal).toBe(68700);
    expect(result30Min.totalAmount).toBe(68700);
    expect(result30Min.amountInWords).toBe('Sixty Eight Thousand Seven Hundred Only');
  });

  // TEST 3: Scope Ladder Precedence (vehicle override beats customer override)
  it('Scope Ladder: vehicle override beats customer override (Priority: vehicle 5 > customer 3)', () => {
    const rules: RuleDefinition[] = [
      {
        id: 'customer-km-gap-rule',
        ruleKey: 'KM_GAP_THRESHOLD',
        name: 'VTL Customer Relaxed Gap Threshold',
        scope: 'customer',
        scopeId: 'c0000000-0000-0000-0000-000000000001',
        executionMode: 'auto',
        conditionLogic: 'AND',
        conditions: [],
        action: { type: 'SET_VALUE', targetField: 'thresholdKm', value: 25 },
        inheritedFrom: 'Customer Rule: VTL Custom 25km',
      },
      {
        id: 'vehicle-strict-km-gap-rule',
        ruleKey: 'KM_GAP_THRESHOLD',
        name: 'KL01 CP 3284 Strict Fleet Gap Threshold',
        scope: 'vehicle',
        scopeId: 'KL01 CP 3284',
        executionMode: 'auto',
        conditionLogic: 'AND',
        conditions: [],
        action: { type: 'SET_VALUE', targetField: 'thresholdKm', value: 10 },
        inheritedFrom: 'Vehicle Override: KL01 CP 3284 Strict 10km',
      },
    ];

    const context: RuleEvaluationContext = {
      date: '2026-08-03',
      customerId: 'c0000000-0000-0000-0000-000000000001',
      vehiclePlate: 'KL01 CP 3284',
    };

    const resolved = resolveEffectiveRule('KM_GAP_THRESHOLD', context, rules);

    // Vehicle rule must beat customer rule because scope priority of vehicle (5) > customer (3)
    expect(resolved.scope).toBe('vehicle');
    expect(resolved.effectiveValue).toBe(10);
    expect(resolved.inheritedFrom).toBe('Vehicle Override: KL01 CP 3284 Strict 10km');
  });

  // TEST 4: Effective-date switch applies to the right month
  it('Effective dates: versioned terms apply strictly to the matching month/period', () => {
    const rules: RuleDefinition[] = [
      // 2025 contract version: August 2025 terms
      {
        id: 'vtl-terms-2025',
        ruleKey: 'ROUNDING',
        name: 'VTL 2025 Terms',
        scope: 'contract',
        scopeId: 'vtl-contract',
        effectiveFrom: '2025-08-01',
        effectiveTo: '2025-08-31',
        executionMode: 'auto',
        conditionLogic: 'AND',
        conditions: [],
        action: { type: 'SET_VALUE', targetField: 'roundingMode', value: 'nearest' },
        inheritedFrom: 'Contract: VTL Aug 2025 Renewal Terms',
      },
      // 2026 contract version: August 2026 terms
      {
        id: 'vtl-terms-2026',
        ruleKey: 'ROUNDING',
        name: 'VTL 2026 Terms',
        scope: 'contract',
        scopeId: 'vtl-contract',
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-08-31',
        executionMode: 'auto',
        conditionLogic: 'AND',
        conditions: [],
        action: { type: 'SET_VALUE', targetField: 'roundingMode', value: 'down' },
        inheritedFrom: 'Contract: VTL Aug 2026 Revised Agreement',
      },
    ];

    // Query for August 2025 date -> matches 2025 terms (nearest)
    const ctx2025: RuleEvaluationContext = {
      date: '2025-08-15',
      contractId: 'vtl-contract',
    };
    const res2025 = resolveEffectiveRule('ROUNDING', ctx2025, rules);
    expect(res2025.effectiveValue).toBe('nearest');
    expect(res2025.inheritedFrom).toBe('Contract: VTL Aug 2025 Renewal Terms');

    // Query for August 2026 date -> matches 2026 terms (down)
    const ctx2026: RuleEvaluationContext = {
      date: '2026-08-15',
      contractId: 'vtl-contract',
    };
    const res2026 = resolveEffectiveRule('ROUNDING', ctx2026, rules);
    expect(res2026.effectiveValue).toBe('down');
    expect(res2026.inheritedFrom).toBe('Contract: VTL Aug 2026 Revised Agreement');

    // Query for September 2026 date -> neither is effective, falls back to global default
    const ctx2026Sep: RuleEvaluationContext = {
      date: '2026-09-10',
      contractId: 'vtl-contract',
    };
    const res2026Sep = resolveEffectiveRule('ROUNDING', ctx2026Sep, rules);
    expect(res2026Sep.scope).toBe('global');
    expect(res2026Sep.effectiveValue).toBe('down');
  });

  // TEST 5: Anomaly Engine uses Declarative Rule Builder for Night Bata
  it('Declarative Rule Builder: Night Bata triggers via configurable conditions with inheritedFrom', () => {
    // Custom rule: customer pays night bata for shifts closing after 21:00 (instead of default 22:00)
    const customRules: RuleDefinition[] = [
      {
        id: 'early-night-bata-rule',
        ruleKey: 'NIGHT_BATA',
        name: 'Early Night Bata at 21:00',
        scope: 'customer',
        scopeId: 'c-early',
        executionMode: 'suggest_only',
        conditionLogic: 'OR',
        conditions: [
          { field: 'startTime', op: 'lt', value: '06:00' },
          { field: 'closeTime', op: 'gt', value: '21:00' },
        ],
        action: { type: 'SET_FLAG', targetField: 'nightBata', value: true },
        inheritedFrom: 'Customer Rule: Special Night Bata (after 21:00)',
      },
    ];

    // Trip with close time 21:30 (would not trigger on default 22:00 rule, but triggers on custom rule)
    const testEntries: DayLedgerEntry[] = [
      {
        date: '2026-08-01',
        dayStatus: 'RUN',
        startTime: '08:00',
        closeTime: '21:30',
        nightBata: false,
      },
    ];

    const anomalies = detectLedgerAnomalies(testEntries, {
      customRules,
      context: { customerId: 'c-early' },
    });

    const nbAnomaly = anomalies.find((a) => a.type === 'NIGHT_BATA_MISMATCH');
    expect(nbAnomaly).toBeDefined();
    expect(nbAnomaly?.title).toBe('Night Bata Suggested');
    expect(nbAnomaly?.inheritedFrom).toBe('Customer Rule: Special Night Bata (after 21:00)');
  });
});
