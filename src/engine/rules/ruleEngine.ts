// Declarative Rule Engine with Scope Ladder & Effective Dates
import {
  RuleDefinition,
  RuleEvaluationContext,
  RuleKey,
  RuleScope,
  ResolvedRule,
  RuleCondition,
} from './types';
import { parseTimeString } from '../duration';

export const SCOPE_PRIORITY: Record<RuleScope, number> = {
  global: 1,
  supplier: 2,
  customer: 3,
  contract: 4,
  vehicle: 5,
  driver: 6,
  row: 7,
};

/**
 * Standard System Default Rules
 */
export const DEFAULT_SYSTEM_RULES: RuleDefinition[] = [
  {
    id: 'default-night-bata',
    ruleKey: 'NIGHT_BATA',
    name: 'Standard Night Bata Trigger',
    description: 'Suggests Night Bata when shift starts before 06:00 or closes after 22:00',
    scope: 'global',
    executionMode: 'suggest_only', // Office toggle with auto-suggestion
    conditionLogic: 'OR',
    conditions: [
      { field: 'startTime', op: 'lt', value: '06:00' },
      { field: 'closeTime', op: 'gt', value: '22:00' },
    ],
    action: {
      type: 'SET_FLAG',
      targetField: 'nightBata',
      value: true,
    },
    inheritedFrom: 'Global System Default',
  },
  {
    id: 'default-extra-day',
    ruleKey: 'EXTRA_DAY',
    name: 'Sunday / Holiday Run Rate',
    description: 'Sunday or statutory holiday run charged only if contract has extra_day_rate',
    scope: 'global',
    executionMode: 'suggest_only',
    conditionLogic: 'OR',
    conditions: [
      { field: 'isSunday', op: 'eq', value: true },
      { field: 'isHoliday', op: 'eq', value: true },
    ],
    action: {
      type: 'APPLY_RATE',
      targetField: 'extraDayAmount',
      value: 0,
    },
    inheritedFrom: 'Global System Default',
  },
  {
    id: 'default-rounding',
    ruleKey: 'ROUNDING',
    name: 'Invoice Rupee Rounding',
    description: 'Default invoice total rounding to whole rupee',
    scope: 'global',
    executionMode: 'auto',
    conditionLogic: 'AND',
    conditions: [],
    action: {
      type: 'SET_VALUE',
      targetField: 'roundingMode',
      value: 'down', // Default floor per contract agreement
    },
    inheritedFrom: 'Global System Default',
  },
  {
    id: 'default-extra-hour-rounding',
    ruleKey: 'EXTRA_HOUR_ROUNDING',
    name: 'Extra Hour Precision',
    description: 'Pro-rata per minute by default',
    scope: 'global',
    executionMode: 'auto',
    conditionLogic: 'AND',
    conditions: [],
    action: {
      type: 'SET_VALUE',
      targetField: 'blockMinutes',
      value: 1, // 1 min pro-rata
    },
    inheritedFrom: 'Global System Default',
  },
  {
    id: 'default-km-gap-threshold',
    ruleKey: 'KM_GAP_THRESHOLD',
    name: 'KM Continuity Gap Threshold',
    description: 'Default allowable gap between consecutive trips',
    scope: 'global',
    executionMode: 'auto',
    conditionLogic: 'AND',
    conditions: [],
    action: {
      type: 'SET_VALUE',
      targetField: 'thresholdKm',
      value: 15,
    },
    inheritedFrom: 'Global System Default',
  },
];

/**
 * Evaluates whether a rule's effective date range covers the given trip date
 */
export function isRuleDateEffective(rule: RuleDefinition, tripDate: string): boolean {
  if (rule.effectiveFrom && tripDate < rule.effectiveFrom) {
    return false;
  }
  if (rule.effectiveTo && tripDate > rule.effectiveTo) {
    return false;
  }
  return true;
}

/**
 * Checks if a rule applies to the given context scope
 */
export function doesRuleScopeMatch(rule: RuleDefinition, context: RuleEvaluationContext): boolean {
  switch (rule.scope) {
    case 'global':
      return true;
    case 'supplier':
      return !rule.scopeId || rule.scopeId === context.supplierId;
    case 'customer':
      return !rule.scopeId || rule.scopeId === context.customerId;
    case 'contract':
      return !rule.scopeId || rule.scopeId === context.contractId;
    case 'vehicle':
      return Boolean(
        !rule.scopeId ||
        rule.scopeId === context.vehicleId ||
        (rule.scopeId && context.vehiclePlate && rule.scopeId.toUpperCase() === context.vehiclePlate.toUpperCase())
      );
    case 'driver':
      return !rule.scopeId || rule.scopeId === context.driverId;
    case 'row':
      return Boolean(context.rowOverrides && context.rowOverrides[rule.ruleKey] !== undefined);
    default:
      return false;
  }
}

/**
 * Resolves the effective rule using the Scope Ladder:
 * row (7) > driver (6) > vehicle (5) > contract (4) > customer (3) > supplier (2) > global (1)
 */
export function resolveEffectiveRule(
  ruleKey: RuleKey,
  context: RuleEvaluationContext,
  customRules: RuleDefinition[] = []
): ResolvedRule {
  const allRules = [...customRules, ...DEFAULT_SYSTEM_RULES].filter((r) => r.ruleKey === ruleKey);

  // Filter rules by date effectiveness and scope matching
  const matchingRules = allRules.filter((r) => {
    return isRuleDateEffective(r, context.date) && doesRuleScopeMatch(r, context);
  });

  // Sort by scope ladder priority descending
  matchingRules.sort((a, b) => {
    return SCOPE_PRIORITY[b.scope] - SCOPE_PRIORITY[a.scope];
  });

  const winner = matchingRules[0] || DEFAULT_SYSTEM_RULES.find((r) => r.ruleKey === ruleKey);

  if (!winner) {
    throw new Error(`No rule found for ${ruleKey}`);
  }

  // Row overrides beat all
  if (context.rowOverrides && context.rowOverrides[ruleKey] !== undefined) {
    return {
      rule: winner,
      scope: 'row',
      inheritedFrom: 'Row-level Manual Override',
      effectiveValue: context.rowOverrides[ruleKey],
      executionMode: 'auto',
    };
  }

  const scopeLabel =
    winner.scope === 'global'
      ? 'Global System Default'
      : `${winner.scope.toUpperCase()}: ${winner.scopeId || winner.name}`;

  return {
    rule: winner,
    scope: winner.scope,
    inheritedFrom: winner.inheritedFrom || scopeLabel,
    effectiveValue: winner.action.value,
    executionMode: winner.executionMode,
  };
}

/**
 * Evaluates individual condition comparison
 */
export function evaluateCondition(condition: RuleCondition, data: Record<string, any>): boolean {
  const actual = data[condition.field];
  const expected = condition.value;

  if (actual === undefined || actual === null) {
    return false;
  }

  // Handle time strings (e.g. '05:00' < '06:00')
  if (typeof actual === 'string' && typeof expected === 'string' && actual.includes(':') && expected.includes(':')) {
    const actualMins = parseTimeString(actual);
    const expectedMins = parseTimeString(expected);
    if (actualMins !== null && expectedMins !== null) {
      switch (condition.op) {
        case 'eq': return actualMins === expectedMins;
        case 'neq': return actualMins !== expectedMins;
        case 'lt': return actualMins < expectedMins;
        case 'lte': return actualMins <= expectedMins;
        case 'gt': return actualMins > expectedMins;
        case 'gte': return actualMins >= expectedMins;
      }
    }
  }

  switch (condition.op) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return actual > expected;
    case 'gte': return actual >= expected;
    case 'lt': return actual < expected;
    case 'lte': return actual <= expected;
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'contains': return String(actual).toLowerCase().includes(String(expected).toLowerCase());
    default: return false;
  }
}

/**
 * Evaluates rule conditions against entry data
 */
export function testRuleConditions(rule: RuleDefinition, data: Record<string, any>): boolean {
  if (!rule.conditions || rule.conditions.length === 0) {
    return true;
  }

  if (rule.conditionLogic === 'OR') {
    return rule.conditions.some((c) => evaluateCondition(c, data));
  } else {
    return rule.conditions.every((c) => evaluateCondition(c, data));
  }
}

/**
 * Helper to apply rounding mode
 */
export function applyConfiguredRounding(amount: number, roundingMode: 'down' | 'nearest' | 'up' | 'none'): number {
  switch (roundingMode) {
    case 'down':
      return Math.floor(amount);
    case 'nearest':
      return Math.round(amount);
    case 'up':
      return Math.ceil(amount);
    case 'none':
    default:
      return Number(amount.toFixed(2));
  }
}

/**
 * Helper to round extra minutes to specified block (e.g. 30 min blocks)
 */
export function applyExtraHourRounding(
  extraMinutes: number,
  blockMinutes: number,
  direction: 'ceil' | 'nearest' | 'floor' = 'ceil'
): number {
  if (!blockMinutes || blockMinutes <= 1) {
    return extraMinutes; // pro-rata per minute
  }

  const quotient = extraMinutes / blockMinutes;
  let roundedBlocks: number;

  switch (direction) {
    case 'ceil':
      roundedBlocks = Math.ceil(quotient);
      break;
    case 'nearest':
      roundedBlocks = Math.round(quotient);
      break;
    case 'floor':
      roundedBlocks = Math.floor(quotient);
      break;
  }

  return roundedBlocks * blockMinutes;
}
