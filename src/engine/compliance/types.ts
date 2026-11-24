export type DocumentType =
  | 'rc'
  | 'insurance'
  | 'pollution'
  | 'permit'
  | 'fitness'
  | 'license'
  | 'police_clearance';

export type ExpiryUrgency =
  | 'expired'
  | 'critical_7'
  | 'warning_30'
  | 'notice_60'
  | 'valid'
  | 'not_provided';

export interface DocumentStatus {
  documentType: DocumentType;
  label: string;
  isProvided: boolean;
  expiryDate: string | null;
  daysRemaining: number | null;
  urgency: ExpiryUrgency;
  badgeText: string;
  badgeSeverity: 'critical' | 'warning' | 'notice' | 'success' | 'neutral';
}

export type ComplianceAlertSeverity = 'critical' | 'warning' | 'notice' | 'info';

export interface ComplianceAlert {
  id: string;
  targetType: 'vehicle' | 'driver';
  targetId: string;
  targetIdentifier: string; // e.g. 'KL-01-CP-3284' or 'Hemanth Kumar'
  alertType: 'document_expiry' | 'service_due' | 'emi_due' | 'missing_document';
  documentType?: DocumentType;
  severity: ComplianceAlertSeverity;
  expiryDate?: string;
  daysRemaining?: number;
  message: string;
  actionRequired: string;
}

export interface ComplianceSettings {
  id?: string;
  alertWindowsDays: number[]; // default [60, 30, 7]
  serviceKmWarningThreshold: number; // default 500 km
  serviceDaysWarningThreshold: number; // default 14 days
  emiDaysWarningThreshold: number; // default 5 days
  policeClearanceValidityMonths: number; // default 12 months
}

export interface VehicleComplianceInput {
  id: string;
  regNo: string;
  displayRegNo: string;
  vehicleType: string;
  makeModel?: string | null;
  currentOdometer: number;
  rcExpiry?: string | null;
  insuranceExpiry?: string | null;
  pollutionExpiry?: string | null;
  permitExpiry?: string | null;
  fitnessExpiry?: string | null;
  monthlyEmiAmount?: number | null;
  emiDueDay?: number | null;
  emiFinancier?: string | null;
  emiAccountNo?: string | null;
  lastServiceOdometer?: number | null;
  lastServiceDate?: string | null;
  serviceIntervalKm?: number | null;
  nextServiceDueKm?: number | null;
  nextServiceDueDate?: string | null;
  isActive: boolean;
}

export interface DriverComplianceInput {
  id: string;
  name: string;
  phone?: string | null;
  driverType: string;
  licenseNo?: string | null;
  licenseExpiry?: string | null;
  policeClearanceDate?: string | null;
  isActive: boolean;
}

export interface VehicleChecklistResult {
  vehicleId: string;
  regNo: string;
  displayRegNo: string;
  documents: Record<'rc' | 'insurance' | 'pollution' | 'permit' | 'fitness', DocumentStatus>;
  overallStatus: 'compliant' | 'attention_required' | 'critical';
  missingCount: number;
  expiringCount: number;
  expiredCount: number;
  serviceDue: {
    isDue: boolean;
    dueKm?: number;
    kmRemaining?: number;
    dueDate?: string;
    message?: string;
    severity?: ComplianceAlertSeverity;
  };
  emiDue: {
    isDue: boolean;
    dueDay?: number;
    monthlyAmount?: number;
    financier?: string;
    message?: string;
    severity?: ComplianceAlertSeverity;
  };
}

export interface DriverChecklistResult {
  driverId: string;
  name: string;
  documents: Record<'license' | 'police_clearance', DocumentStatus>;
  overallStatus: 'compliant' | 'attention_required' | 'critical';
  missingCount: number;
  expiringCount: number;
  expiredCount: number;
}
