// Validation & Anomaly Detection Engine for Starciti Daily Trip Ledger
import { DayLedgerEntry } from './types';
import {
  resolveEffectiveRule,
  testRuleConditions,
  RuleDefinition,
  RuleEvaluationContext,
} from './rules';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export type AnomalyType =
  | 'KM_GAP'
  | 'KM_NEGATIVE'
  | 'EXCESSIVE_HOURS'
  | 'HOLIDAY_RUN'
  | 'NIGHT_BATA_MISMATCH'
  | 'OVERNIGHT_CROSSING'
  | 'MISSING_DRIVER';

export interface LedgerAnomaly {
  id: string;
  entryDate: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  details?: Record<string, any>;
  inheritedFrom?: string;
  isAcknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface AnomalyConfig {
  kmGapThreshold?: number;       // Default: 15 km
  maxDailyHours?: number;        // Default: 16 hours (960 minutes)
  nightBataStartHour?: number;   // Default: 22 (10:00 PM)
  nightBataEndHour?: number;     // Default: 6 (06:00 AM)
  keralaHolidays?: string[];     // E.g. ['2026-08-26', '2026-08-28'] (Onam)
  defaultVehiclePlate?: string;  // Default: 'KL01 CP 3284'
  customRules?: RuleDefinition[];// Declarative rule definitions
  context?: Partial<RuleEvaluationContext>;
}

const DEFAULT_CONFIG: Required<Omit<AnomalyConfig, 'customRules' | 'context'>> & {
  customRules: RuleDefinition[];
  context: Partial<RuleEvaluationContext>;
} = {
  kmGapThreshold: 15,
  maxDailyHours: 16,
  nightBataStartHour: 22,
  nightBataEndHour: 6,
  keralaHolidays: ['2026-08-26', '2026-08-28'], // Onam holidays in August 2026
  defaultVehiclePlate: 'KL01 CP 3284',
  customRules: [],
  context: {},
};

/**
 * Pure function: runs comprehensive anomaly & validation checks on daily ledger entries.
 * Evaluates rules through the Declarative Scope Ladder (row > driver > vehicle > contract > customer > supplier > global).
 */
export function detectLedgerAnomalies(
  entries: DayLedgerEntry[],
  userConfig: AnomalyConfig = {}
): LedgerAnomaly[] {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const anomalies: LedgerAnomaly[] = [];

  // Sort entries chronologically
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Per-vehicle odometer tracker: Map<vehiclePlate, { closeKm, date }>
  const lastCloseByVehicle = new Map<string, { closeKm: number; date: string }>();

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const isRun = entry.dayStatus === 'RUN' || entry.dayStatus === 'SUBSTITUTE';
    const vehicleKey = (entry.vehiclePlate || config.defaultVehiclePlate).trim().toUpperCase();

    // Build evaluation context for the scope ladder
    const evalContext: RuleEvaluationContext = {
      date: entry.date,
      vehiclePlate: vehicleKey,
      ...config.context,
      rowOverrides: entry.extra?.ruleOverrides,
    };

    // 1. Check Negative KM (Hard Error)
    if (entry.startKm !== null && entry.startKm !== undefined &&
        entry.closeKm !== null && entry.closeKm !== undefined) {
      if (entry.closeKm < entry.startKm) {
        anomalies.push({
          id: `anomaly-${entry.date}-km-neg`,
          entryDate: entry.date,
          type: 'KM_NEGATIVE',
          severity: 'critical',
          title: 'Negative Kilometres',
          description: `Close KM (${entry.closeKm}) is less than Start KM (${entry.startKm}).`,
          details: { startKm: entry.startKm, closeKm: entry.closeKm, vehiclePlate: vehicleKey },
        });
      }
    }

    // 2. Check KM Continuity Gap against previous Close KM of the SAME vehicle
    // Resolve gap threshold via Scope Ladder (vehicle override beats customer/global)
    const effectiveGapRule = resolveEffectiveRule('KM_GAP_THRESHOLD', evalContext, config.customRules);
    const effectiveThreshold =
      userConfig.kmGapThreshold !== undefined
        ? userConfig.kmGapThreshold
        : Number(effectiveGapRule.effectiveValue) || config.kmGapThreshold;

    if (isRun && entry.startKm !== null && entry.startKm !== undefined) {
      const prev = lastCloseByVehicle.get(vehicleKey);
      if (prev && prev.closeKm !== null && prev.closeKm !== undefined) {
        const gap = entry.startKm - prev.closeKm;
        if (gap > effectiveThreshold) {
          anomalies.push({
            id: `anomaly-${entry.date}-km-gap`,
            entryDate: entry.date,
            type: 'KM_GAP',
            severity: 'warning',
            title: `Unaccounted KM Gap (${gap} km)`,
            description: `Start KM (${entry.startKm}) on ${vehicleKey} has a ${gap} km gap from preceding Close KM (${prev.closeKm} on ${prev.date}). Exceeds ${effectiveThreshold} km threshold.`,
            inheritedFrom: effectiveGapRule.inheritedFrom,
            details: {
              gap,
              startKm: entry.startKm,
              previousCloseKm: prev.closeKm,
              previousDate: prev.date,
              threshold: effectiveThreshold,
              vehiclePlate: vehicleKey,
            },
          });
        }
      }

      // Update previous close KM for this vehicle
      if (entry.closeKm !== null && entry.closeKm !== undefined) {
        lastCloseByVehicle.set(vehicleKey, { closeKm: entry.closeKm, date: entry.date });
      }
    }

    // 3. Check Excessive Hours
    if (isRun && entry.durationMinutes !== null && entry.durationMinutes !== undefined) {
      const maxMinutes = config.maxDailyHours * 60;
      if (entry.durationMinutes > maxMinutes) {
        const durationHours = Math.round((entry.durationMinutes / 60) * 10) / 10;
        anomalies.push({
          id: `anomaly-${entry.date}-hours`,
          entryDate: entry.date,
          type: 'EXCESSIVE_HOURS',
          severity: 'warning',
          title: `Excessive Duty Hours (${durationHours}h)`,
          description: `Vehicle ran for ${durationHours} hours (${entry.durationMinutes} mins), exceeding the ${config.maxDailyHours} hour daily safety limit.`,
          details: { durationMinutes: entry.durationMinutes, maxHours: config.maxDailyHours },
        });
      }
    }

    // 4. Check Sunday / Holiday Run Flags via Declarative EXTRA_DAY Rule
    if (isRun) {
      const parsedDate = new Date(entry.date);
      const isSunday = parsedDate.getDay() === 0;
      const isKeralaHoliday = config.keralaHolidays.includes(entry.date);

      const extraDayRule = resolveEffectiveRule('EXTRA_DAY', evalContext, config.customRules);
      const isExtraDay = testRuleConditions(extraDayRule.rule, {
        isSunday,
        isHoliday: isKeralaHoliday,
      });

      if (isExtraDay) {
        const reason = isSunday ? 'Sunday run' : 'Kerala statutory holiday run';
        anomalies.push({
          id: `anomaly-${entry.date}-holiday-run`,
          entryDate: entry.date,
          type: 'HOLIDAY_RUN',
          severity: 'info',
          title: isSunday ? 'Sunday Run' : 'Holiday Run',
          description: `Trip performed on a ${reason}. Charged only if contract has extra_day_rate; otherwise ₹0 and flagged.`,
          inheritedFrom: extraDayRule.inheritedFrom,
          details: { isSunday, isKeralaHoliday, rate: extraDayRule.effectiveValue },
        });
      }
    }

    // 5. Check Night Bata Rule via Declarative NIGHT_BATA Rule & Scope Ladder
    if (isRun && entry.startTime && entry.closeTime) {
      try {
        const nightBataRule = resolveEffectiveRule('NIGHT_BATA', evalContext, config.customRules);

        // Evaluate rule conditions dynamically against entry fields
        const qualifiesForNightBata = testRuleConditions(nightBataRule.rule, {
          startTime: entry.startTime,
          closeTime: entry.closeTime,
          endsNextDay: Boolean(entry.endsNextDay),
        });

        if (qualifiesForNightBata && !entry.nightBata) {
          anomalies.push({
            id: `anomaly-${entry.date}-night-bata-missing`,
            entryDate: entry.date,
            type: 'NIGHT_BATA_MISMATCH',
            severity: 'info',
            title: 'Night Bata Suggested',
            description: `Shift hours (${entry.startTime} to ${entry.closeTime}) qualify for Night Bata (${nightBataRule.rule.description || 'rule condition met'}), but toggle is currently OFF.`,
            inheritedFrom: nightBataRule.inheritedFrom,
            details: { startTime: entry.startTime, closeTime: entry.closeTime, nightBata: false },
          });
        } else if (!qualifiesForNightBata && entry.nightBata) {
          anomalies.push({
            id: `anomaly-${entry.date}-night-bata-unusual`,
            entryDate: entry.date,
            type: 'NIGHT_BATA_MISMATCH',
            severity: 'info',
            title: 'Office Night Bata Override',
            description: `Night Bata is manually enabled for daytime hours (${entry.startTime} to ${entry.closeTime}).`,
            inheritedFrom: nightBataRule.inheritedFrom,
            details: { startTime: entry.startTime, closeTime: entry.closeTime, nightBata: true },
          });
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  return anomalies;
}
