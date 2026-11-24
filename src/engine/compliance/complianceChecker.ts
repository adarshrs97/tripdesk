import {
  DocumentType,
  DocumentStatus,
  ComplianceAlert,
  ComplianceSettings,
  VehicleComplianceInput,
  DriverComplianceInput,
  VehicleChecklistResult,
  DriverChecklistResult,
} from './types';

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettings = {
  alertWindowsDays: [60, 30, 7],
  serviceKmWarningThreshold: 500,
  serviceDaysWarningThreshold: 14,
  emiDaysWarningThreshold: 5,
  policeClearanceValidityMonths: 12,
};

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  rc: 'Registration Certificate (RC)',
  insurance: 'Commercial Insurance',
  pollution: 'Pollution Certificate (PUCC)',
  permit: 'Contract Carriage Permit',
  fitness: 'Vehicle Fitness Certificate (FC)',
  license: 'Driving Licence',
  police_clearance: 'Police Clearance Certificate',
};

/**
 * Evaluates document status against reference date.
 * IMPORTANT: If date is null / unprovided, urgency is 'not_provided' and NEVER raises an expiry alert.
 */
export function checkDocumentStatus(
  dateStr: string | null | undefined,
  documentType: DocumentType,
  referenceDateStr: string = new Date().toISOString().split('T')[0],
  alertWindows: number[] = [60, 30, 7]
): DocumentStatus {
  const label = DOCUMENT_LABELS[documentType] || documentType.toUpperCase();

  if (!dateStr || dateStr.trim() === '') {
    return {
      documentType,
      label,
      isProvided: false,
      expiryDate: null,
      daysRemaining: null,
      urgency: 'not_provided',
      badgeText: 'Not Provided',
      badgeSeverity: 'neutral',
    };
  }

  const refDate = new Date(referenceDateStr + 'T00:00:00');
  const expDate = new Date(dateStr + 'T00:00:00');
  const diffMs = expDate.getTime() - refDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Determine windows sorted descending [60, 30, 7]
  const sortedWindows = [...alertWindows].sort((a, b) => b - a);
  const w60 = sortedWindows[0] ?? 60;
  const w30 = sortedWindows[1] ?? 30;
  const w7 = sortedWindows[2] ?? 7;

  if (diffDays < 0) {
    return {
      documentType,
      label,
      isProvided: true,
      expiryDate: dateStr,
      daysRemaining: diffDays,
      urgency: 'expired',
      badgeText: `Expired (${Math.abs(diffDays)}d ago)`,
      badgeSeverity: 'critical',
    };
  }

  if (diffDays <= w7) {
    return {
      documentType,
      label,
      isProvided: true,
      expiryDate: dateStr,
      daysRemaining: diffDays,
      urgency: 'critical_7',
      badgeText: `Expires in ${diffDays}d`,
      badgeSeverity: 'critical',
    };
  }

  if (diffDays <= w30) {
    return {
      documentType,
      label,
      isProvided: true,
      expiryDate: dateStr,
      daysRemaining: diffDays,
      urgency: 'warning_30',
      badgeText: `Expires in ${diffDays}d`,
      badgeSeverity: 'warning',
    };
  }

  if (diffDays <= w60) {
    return {
      documentType,
      label,
      isProvided: true,
      expiryDate: dateStr,
      daysRemaining: diffDays,
      urgency: 'notice_60',
      badgeText: `Expires in ${diffDays}d`,
      badgeSeverity: 'notice',
    };
  }

  return {
    documentType,
    label,
    isProvided: true,
    expiryDate: dateStr,
    daysRemaining: diffDays,
    urgency: 'valid',
    badgeText: 'Valid',
    badgeSeverity: 'success',
  };
}

/**
 * Checks routine service status for a vehicle
 */
export function checkServiceStatus(
  vehicle: VehicleComplianceInput,
  settings: ComplianceSettings,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
) {
  const currentOdo = vehicle.currentOdometer || 0;
  const interval = vehicle.serviceIntervalKm || 10000;
  const dueKm = vehicle.nextServiceDueKm ?? (vehicle.lastServiceOdometer ? vehicle.lastServiceOdometer + interval : null);

  let kmRemaining: number | undefined;
  let isDueByKm = false;
  let kmSeverity: 'critical' | 'warning' | undefined;

  if (dueKm !== null) {
    kmRemaining = dueKm - currentOdo;
    if (kmRemaining <= 0) {
      isDueByKm = true;
      kmSeverity = 'critical';
    } else if (kmRemaining <= settings.serviceKmWarningThreshold) {
      isDueByKm = true;
      kmSeverity = 'warning';
    }
  }

  let isDueByDate = false;
  let dateSeverity: 'critical' | 'warning' | undefined;
  let daysToServiceDate: number | undefined;

  if (vehicle.nextServiceDueDate) {
    const refDate = new Date(referenceDateStr + 'T00:00:00');
    const dueDate = new Date(vehicle.nextServiceDueDate + 'T00:00:00');
    daysToServiceDate = Math.ceil((dueDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysToServiceDate <= 0) {
      isDueByDate = true;
      dateSeverity = 'critical';
    } else if (daysToServiceDate <= settings.serviceDaysWarningThreshold) {
      isDueByDate = true;
      dateSeverity = 'warning';
    }
  }

  const isDue = isDueByKm || isDueByDate;
  const severity: 'critical' | 'warning' = (kmSeverity === 'critical' || dateSeverity === 'critical') ? 'critical' : 'warning';

  let message: string | undefined;
  if (isDueByKm && kmRemaining !== undefined) {
    message = kmRemaining <= 0
      ? `Routine service overdue by ${Math.abs(kmRemaining)} KM (due at ${dueKm} KM, current ${currentOdo} KM)`
      : `Routine service due in ${kmRemaining} KM (due at ${dueKm} KM)`;
  } else if (isDueByDate && daysToServiceDate !== undefined) {
    message = daysToServiceDate <= 0
      ? `Routine periodic service overdue by ${Math.abs(daysToServiceDate)} days`
      : `Routine service due in ${daysToServiceDate} days (${vehicle.nextServiceDueDate})`;
  }

  return {
    isDue,
    dueKm: dueKm ?? undefined,
    kmRemaining,
    dueDate: vehicle.nextServiceDueDate ?? undefined,
    message,
    severity: isDue ? severity : undefined,
  };
}

/**
 * Checks monthly EMI payment due status
 */
export function checkEmiStatus(
  vehicle: VehicleComplianceInput,
  settings: ComplianceSettings,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
) {
  if (!vehicle.monthlyEmiAmount || !vehicle.emiDueDay) {
    return { isDue: false };
  }

  const refDate = new Date(referenceDateStr + 'T00:00:00');
  const currentDay = refDate.getDate();
  const dueDay = vehicle.emiDueDay;

  // Days until due day this month
  const daysUntilDue = dueDay - currentDay;
  const isDue = daysUntilDue >= 0 && daysUntilDue <= settings.emiDaysWarningThreshold;
  const isOverdue = daysUntilDue < 0 && daysUntilDue >= -3; // 3-day grace period

  let message: string | undefined;
  let severity: 'critical' | 'warning' | undefined;

  if (isOverdue) {
    message = `Monthly EMI of ₹${vehicle.monthlyEmiAmount.toLocaleString('en-IN')} was due on day ${dueDay}!`;
    severity = 'critical';
  } else if (isDue) {
    message = daysUntilDue === 0
      ? `Monthly EMI of ₹${vehicle.monthlyEmiAmount.toLocaleString('en-IN')} is DUE TODAY (Day ${dueDay})!`
      : `Monthly EMI of ₹${vehicle.monthlyEmiAmount.toLocaleString('en-IN')} due in ${daysUntilDue} days (Day ${dueDay})`;
    severity = 'warning';
  }

  return {
    isDue: isDue || isOverdue,
    dueDay,
    monthlyAmount: vehicle.monthlyEmiAmount,
    financier: vehicle.emiFinancier ?? undefined,
    message,
    severity,
  };
}

/**
 * Generates vehicle compliance checklist
 */
export function checkVehicleCompliance(
  vehicle: VehicleComplianceInput,
  settings: ComplianceSettings = DEFAULT_COMPLIANCE_SETTINGS,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
): VehicleChecklistResult {
  const windows = settings.alertWindowsDays || [60, 30, 7];

  const rc = checkDocumentStatus(vehicle.rcExpiry, 'rc', referenceDateStr, windows);
  const insurance = checkDocumentStatus(vehicle.insuranceExpiry, 'insurance', referenceDateStr, windows);
  const pollution = checkDocumentStatus(vehicle.pollutionExpiry, 'pollution', referenceDateStr, windows);
  const permit = checkDocumentStatus(vehicle.permitExpiry, 'permit', referenceDateStr, windows);
  const fitness = checkDocumentStatus(vehicle.fitnessExpiry, 'fitness', referenceDateStr, windows);

  const docs = [rc, insurance, pollution, permit, fitness];
  const missingCount = docs.filter(d => !d.isProvided).length;
  const expiredCount = docs.filter(d => d.urgency === 'expired').length;
  const expiringCount = docs.filter(d => d.urgency === 'critical_7' || d.urgency === 'warning_30' || d.urgency === 'notice_60').length;

  const serviceDue = checkServiceStatus(vehicle, settings, referenceDateStr);
  const emiDue = checkEmiStatus(vehicle, settings, referenceDateStr);

  let overallStatus: 'compliant' | 'attention_required' | 'critical' = 'compliant';
  if (expiredCount > 0 || serviceDue.severity === 'critical' || emiDue.severity === 'critical') {
    overallStatus = 'critical';
  } else if (expiringCount > 0 || missingCount > 0 || serviceDue.isDue || emiDue.isDue) {
    overallStatus = 'attention_required';
  }

  return {
    vehicleId: vehicle.id,
    regNo: vehicle.regNo,
    displayRegNo: vehicle.displayRegNo || vehicle.regNo,
    documents: { rc, insurance, pollution, permit, fitness },
    overallStatus,
    missingCount,
    expiringCount,
    expiredCount,
    serviceDue,
    emiDue,
  };
}

/**
 * Generates driver compliance checklist
 */
export function checkDriverCompliance(
  driver: DriverComplianceInput,
  settings: ComplianceSettings = DEFAULT_COMPLIANCE_SETTINGS,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
): DriverChecklistResult {
  const windows = settings.alertWindowsDays || [60, 30, 7];

  const license = checkDocumentStatus(driver.licenseExpiry, 'license', referenceDateStr, windows);

  // Police clearance is evaluated from issuance date + validity months
  let policeClearanceExpiry: string | null = null;
  if (driver.policeClearanceDate) {
    const pDate = new Date(driver.policeClearanceDate + 'T00:00:00');
    pDate.setMonth(pDate.getMonth() + (settings.policeClearanceValidityMonths || 12));
    policeClearanceExpiry = pDate.toISOString().split('T')[0];
  }

  const policeClearance = checkDocumentStatus(policeClearanceExpiry, 'police_clearance', referenceDateStr, windows);

  const docs = [license, policeClearance];
  const missingCount = docs.filter(d => !d.isProvided).length;
  const expiredCount = docs.filter(d => d.urgency === 'expired').length;
  const expiringCount = docs.filter(d => d.urgency === 'critical_7' || d.urgency === 'warning_30' || d.urgency === 'notice_60').length;

  let overallStatus: 'compliant' | 'attention_required' | 'critical' = 'compliant';
  if (expiredCount > 0) {
    overallStatus = 'critical';
  } else if (expiringCount > 0 || missingCount > 0) {
    overallStatus = 'attention_required';
  }

  return {
    driverId: driver.id,
    name: driver.name,
    documents: { license, police_clearance: policeClearance },
    overallStatus,
    missingCount,
    expiringCount,
    expiredCount,
  };
}

/**
 * Aggregates all actionable compliance alerts across vehicles and drivers.
 * Strictly adheres to rule: Alerts generated ONLY from real entered data.
 */
export function generateFleetComplianceAlerts(
  vehicles: VehicleComplianceInput[],
  drivers: DriverComplianceInput[],
  settings: ComplianceSettings = DEFAULT_COMPLIANCE_SETTINGS,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];

  for (const v of vehicles) {
    if (!v.isActive) continue;
    const checklist = checkVehicleCompliance(v, settings, referenceDateStr);

    // Document Expiry Alerts (Only for real entered dates)
    for (const doc of Object.values(checklist.documents)) {
      if (!doc.isProvided || doc.urgency === 'valid' || doc.urgency === 'not_provided') continue;

      let severity: 'critical' | 'warning' | 'notice' = 'notice';
      if (doc.urgency === 'expired' || doc.urgency === 'critical_7') severity = 'critical';
      else if (doc.urgency === 'warning_30') severity = 'warning';

      alerts.push({
        id: `alert-doc-${v.id}-${doc.documentType}`,
        targetType: 'vehicle',
        targetId: v.id,
        targetIdentifier: checklist.displayRegNo,
        alertType: 'document_expiry',
        documentType: doc.documentType,
        severity,
        expiryDate: doc.expiryDate ?? undefined,
        daysRemaining: doc.daysRemaining ?? undefined,
        message: `${doc.label} for vehicle ${checklist.displayRegNo} ${doc.urgency === 'expired' ? 'EXPIRED' : 'expires in ' + doc.daysRemaining + ' days'} (${doc.expiryDate}).`,
        actionRequired: `Renew ${doc.label} before vehicle dispatch.`,
      });
    }

    // Service Alerts
    if (checklist.serviceDue.isDue && checklist.serviceDue.message) {
      alerts.push({
        id: `alert-service-${v.id}`,
        targetType: 'vehicle',
        targetId: v.id,
        targetIdentifier: checklist.displayRegNo,
        alertType: 'service_due',
        severity: checklist.serviceDue.severity || 'warning',
        message: `Vehicle ${checklist.displayRegNo}: ${checklist.serviceDue.message}`,
        actionRequired: 'Schedule maintenance and update service logs.',
      });
    }

    // EMI Alerts
    if (checklist.emiDue.isDue && checklist.emiDue.message) {
      alerts.push({
        id: `alert-emi-${v.id}`,
        targetType: 'vehicle',
        targetId: v.id,
        targetIdentifier: checklist.displayRegNo,
        alertType: 'emi_due',
        severity: checklist.emiDue.severity || 'warning',
        message: `Vehicle ${checklist.displayRegNo}: ${checklist.emiDue.message}`,
        actionRequired: 'Ensure bank balance is funded for auto-debit.',
      });
    }
  }

  for (const d of drivers) {
    if (!d.isActive) continue;
    const checklist = checkDriverCompliance(d, settings, referenceDateStr);

    for (const doc of Object.values(checklist.documents)) {
      if (!doc.isProvided || doc.urgency === 'valid' || doc.urgency === 'not_provided') continue;

      let severity: 'critical' | 'warning' | 'notice' = 'notice';
      if (doc.urgency === 'expired' || doc.urgency === 'critical_7') severity = 'critical';
      else if (doc.urgency === 'warning_30') severity = 'warning';

      alerts.push({
        id: `alert-doc-${d.id}-${doc.documentType}`,
        targetType: 'driver',
        targetId: d.id,
        targetIdentifier: d.name,
        alertType: 'document_expiry',
        documentType: doc.documentType,
        severity,
        expiryDate: doc.expiryDate ?? undefined,
        daysRemaining: doc.daysRemaining ?? undefined,
        message: `${doc.label} for driver ${d.name} ${doc.urgency === 'expired' ? 'EXPIRED' : 'expires in ' + doc.daysRemaining + ' days'} (${doc.expiryDate}).`,
        actionRequired: `Verify valid driving credentials before assigning trips.`,
      });
    }
  }

  // Sort alerts by severity (critical first)
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, notice: 2, info: 3 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
