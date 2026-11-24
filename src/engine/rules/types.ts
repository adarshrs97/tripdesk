// Declarative Rule Builder Types & Scope Ladder
export type RuleScope = 'global' | 'supplier' | 'customer' | 'contract' | 'vehicle' | 'driver' | 'row';

export type RuleKey =
  | 'NIGHT_BATA'
  | 'EXTRA_DAY'
  | 'ROUNDING'
  | 'EXTRA_HOUR_ROUNDING'
  | 'KM_GAP_THRESHOLD'
  | 'OUTSTATION_BATA'
  | 'CUSTOM_RULE';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'contains';

export interface RuleCondition {
  field: string;
  op: ConditionOperator;
  value: any;
}

export type ActionType = 'SET_FLAG' | 'APPLY_RATE' | 'SET_VALUE' | 'SUGGEST_ANOMALY';

export interface RuleAction {
  type: ActionType;
  targetField: string;
  value: any;
}

export interface RuleDefinition {
  id: string;
  ruleKey: RuleKey;
  name: string;
  description?: string;
  scope: RuleScope;
  scopeId?: string; // e.g. customer_id, vehicle_id, contract_id
  effectiveFrom?: string; // YYYY-MM-DD
  effectiveTo?: string; // YYYY-MM-DD
  executionMode: 'auto' | 'suggest_only';
  conditionLogic: 'AND' | 'OR';
  conditions: RuleCondition[];
  action: RuleAction;
  inheritedFrom?: string;
}

export interface RuleEvaluationContext {
  date: string; // YYYY-MM-DD
  supplierId?: string;
  customerId?: string;
  contractId?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  driverId?: string;
  rowOverrides?: Record<string, any>;
  [key: string]: any;
}

export interface ResolvedRule {
  rule: RuleDefinition;
  scope: RuleScope;
  inheritedFrom: string;
  effectiveValue: any;
  executionMode: 'auto' | 'suggest_only';
}
