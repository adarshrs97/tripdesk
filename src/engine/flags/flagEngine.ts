import {
  InternalFlag,
  FlagEntityType,
  AdminOverrideInput,
  DispatchSuitabilityResult,
} from './types';

/**
 * Filters flags for a specific entity that are currently active
 */
export function filterActiveFlags(
  flags: InternalFlag[],
  entityType?: FlagEntityType,
  entityId?: string
): InternalFlag[] {
  return flags.filter((f) => {
    if (!f.isActive || f.deletedAt) return false;
    if (entityType && f.entityType !== entityType) return false;
    if (entityId && f.entityId !== entityId) return false;
    return true;
  });
}

/**
 * Checks if any flag has 'avoid' severity (critical block)
 */
export function hasAvoidFlag(flags: InternalFlag[]): boolean {
  return flags.some((f) => f.isActive && !f.deletedAt && f.severity === 'avoid');
}

/**
 * Checks if any flag has 'caution' severity (warning)
 */
export function hasCautionFlag(flags: InternalFlag[]): boolean {
  return flags.some((f) => f.isActive && !f.deletedAt && f.severity === 'caution');
}

/**
 * Evaluates operational suitability when assigning a driver and vehicle to a trip:
 * - 'avoid' flag on driver or vehicle requires Administrator override with a written justification.
 *   It is NOT an unconditional block: if valid admin override reason is provided, assignment is permitted.
 * - 'caution' produces prominent warning messages that staff must acknowledge.
 * - 'note' surfaces operational guidance.
 */
export function evaluateDispatchSuitability(
  driverFlags: InternalFlag[] = [],
  vehicleFlags: InternalFlag[] = [],
  adminOverride?: AdminOverrideInput
): DispatchSuitabilityResult {
  const activeDriverFlags = driverFlags.filter((f) => f.isActive && !f.deletedAt);
  const activeVehicleFlags = vehicleFlags.filter((f) => f.isActive && !f.deletedAt);

  const blockReasons: string[] = [];
  const warningMessages: string[] = [];
  const operationalNotes: string[] = [];

  for (const f of activeDriverFlags) {
    if (f.severity === 'avoid') {
      blockReasons.push(`DRIVER AVOID: ${f.title} - ${f.description}`);
    } else if (f.severity === 'caution') {
      warningMessages.push(`DRIVER CAUTION: ${f.title} - ${f.description}`);
    } else {
      operationalNotes.push(`DRIVER NOTE: ${f.title} - ${f.description}`);
    }
  }

  for (const f of activeVehicleFlags) {
    if (f.severity === 'avoid') {
      blockReasons.push(`VEHICLE AVOID: ${f.title} - ${f.description}`);
    } else if (f.severity === 'caution') {
      warningMessages.push(`VEHICLE CAUTION: ${f.title} - ${f.description}`);
    } else {
      operationalNotes.push(`VEHICLE NOTE: ${f.title} - ${f.description}`);
    }
  }

  const hasAvoid = blockReasons.length > 0;
  const hasCaution = warningMessages.length > 0;

  // Admin Override Evaluation
  let isAllowed = !hasAvoid;
  let isOverridden = false;
  let overrideNotice: string | undefined;

  if (hasAvoid) {
    if (adminOverride && adminOverride.reason && adminOverride.reason.trim().length >= 5) {
      isAllowed = true;
      isOverridden = true;
      overrideNotice = `Overridden by Administrator (${adminOverride.user}): "${adminOverride.reason.trim()}". Assignment permitted with operational audit log.`;
    } else {
      blockReasons.push('Action required: Administrator override with written justification is mandatory to proceed.');
    }
  }

  return {
    isAllowed,
    hasAvoid,
    hasCaution,
    requiresAdminOverride: hasAvoid && !isOverridden,
    isOverridden,
    overrideNotice,
    driverFlags: activeDriverFlags,
    vehicleFlags: activeVehicleFlags,
    blockReasons,
    warningMessages,
    operationalNotes,
  };
}

/**
 * ZERO-LEAKAGE GUARANTEE:
 * Recursively inspects any payload intended for customer or driver presentation
 * and ensures that no internal flags, operational cautions, or avoid markers leak out.
 */
export function sanitizeCustomerPayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeCustomerPayload(item)) as unknown as T;
  }

  const clone: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload as Record<string, any>)) {
    // Prohibit internal flag fields
    if (
      key === 'internal_flags' ||
      key === 'internalFlags' ||
      key === 'avoid_flags' ||
      key === 'caution_flags' ||
      key === 'operational_notes'
    ) {
      continue; // Strip completely
    }

    if (value && typeof value === 'object') {
      clone[key] = sanitizeCustomerPayload(value);
    } else {
      clone[key] = value;
    }
  }

  return clone as T;
}
