export type FlagSeverity = 'note' | 'caution' | 'avoid';

export type FlagEntityType = 'driver' | 'vehicle' | 'hotel' | 'vendor' | 'customer';

export interface InternalFlag {
  id: string;
  entityType: FlagEntityType;
  entityId: string;
  severity: FlagSeverity;
  title: string;
  description: string;
  isActive: boolean;
  createdBy?: string | null;
  createdByUserId?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  adminOverrideReason?: string | null;
  overriddenBy?: string | null;
  overriddenAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  retentionMonths?: number;
  viewAudit?: Array<{ user: string; role: string; viewedAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface InternalFlagInput {
  entityType: FlagEntityType;
  entityId: string;
  severity: FlagSeverity;
  title: string;
  description: string;
  retentionMonths?: number;
  createdBy?: string;
  createdByUserId?: string;
}

export interface AdminOverrideInput {
  reason: string;
  user: string;
}

export interface DispatchSuitabilityResult {
  isAllowed: boolean;
  hasAvoid: boolean;
  hasCaution: boolean;
  requiresAdminOverride: boolean;
  isOverridden: boolean;
  overrideNotice?: string;
  driverFlags: InternalFlag[];
  vehicleFlags: InternalFlag[];
  blockReasons: string[];
  warningMessages: string[];
  operationalNotes: string[];
}
