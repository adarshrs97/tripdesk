import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import {
  checkDocumentStatus,
  checkServiceStatus,
  checkEmiStatus,
  checkVehicleCompliance,
  checkDriverCompliance,
  generateFleetComplianceAlerts,
  DEFAULT_COMPLIANCE_SETTINGS,
  ComplianceSettings,
  VehicleComplianceInput,
  DriverComplianceInput,
} from '../engine/compliance';
import { ComplianceService } from '../services/complianceService';
import { ServerComplianceService } from '../services/serverComplianceService';
import { createTestClient, assertTestDatabaseGuard } from './testDbHelper';

describe('Milestone 7b: Fleet Compliance, Document Expiries, EMI & Routine Service Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);

    // Clean service logs in test DB
    await client.query('DELETE FROM vehicle_service_logs');
  });

  afterAll(async () => {
    if (client) {
      await client.query('DELETE FROM vehicle_service_logs');
      await client.end();
    }
  });

  // 1. PURE ENGINE DOCUMENT EXPIRY & ALERT WINDOW TESTS
  describe('1. Document Expiries with 60/30/7 Day Alert Windows', () => {
    const referenceDate = '2026-08-15';

    it('flags EXPIRED when expiry date is in the past (< 0 days)', () => {
      const status = checkDocumentStatus('2026-08-10', 'pollution', referenceDate);
      expect(status.isProvided).toBe(true);
      expect(status.urgency).toBe('expired');
      expect(status.badgeSeverity).toBe('critical');
      expect(status.badgeText).toContain('Expired (5d ago)');
      expect(status.daysRemaining).toBe(-5);
    });

    it('flags CRITICAL_7 when expiry is within 7 days', () => {
      // 2026-08-20 is 5 days away from 2026-08-15
      const status = checkDocumentStatus('2026-08-20', 'insurance', referenceDate);
      expect(status.isProvided).toBe(true);
      expect(status.urgency).toBe('critical_7');
      expect(status.badgeSeverity).toBe('critical');
      expect(status.daysRemaining).toBe(5);
      expect(status.badgeText).toBe('Expires in 5d');
    });

    it('flags WARNING_30 when expiry is between 8 and 30 days', () => {
      // 2026-09-05 is 21 days away from 2026-08-15
      const status = checkDocumentStatus('2026-09-05', 'fitness', referenceDate);
      expect(status.isProvided).toBe(true);
      expect(status.urgency).toBe('warning_30');
      expect(status.badgeSeverity).toBe('warning');
      expect(status.daysRemaining).toBe(21);
      expect(status.badgeText).toBe('Expires in 21d');
    });

    it('flags NOTICE_60 when expiry is between 31 and 60 days', () => {
      // 2026-10-01 is 47 days away from 2026-08-15
      const status = checkDocumentStatus('2026-10-01', 'permit', referenceDate);
      expect(status.isProvided).toBe(true);
      expect(status.urgency).toBe('notice_60');
      expect(status.badgeSeverity).toBe('notice');
      expect(status.daysRemaining).toBe(47);
      expect(status.badgeText).toBe('Expires in 47d');
    });

    it('marks VALID when expiry exceeds 60 days', () => {
      // 2026-12-31 is 138 days away from 2026-08-15
      const status = checkDocumentStatus('2026-12-31', 'rc', referenceDate);
      expect(status.isProvided).toBe(true);
      expect(status.urgency).toBe('valid');
      expect(status.badgeSeverity).toBe('success');
      expect(status.daysRemaining).toBe(138);
      expect(status.badgeText).toBe('Valid');
    });
  });

  // 2. REAL DATA MANDATE: ZERO PHANTOM ALERTS FOR UNPROVIDED DOCUMENTS
  describe('2. Real Data Mandate: Zero Phantom Alerts for Unprovided Documents', () => {
    const referenceDate = '2026-08-15';

    it('marks unprovided documents strictly as "not_provided" without generating expiry alarms', () => {
      const status = checkDocumentStatus(null, 'rc', referenceDate);
      expect(status.isProvided).toBe(false);
      expect(status.urgency).toBe('not_provided');
      expect(status.badgeText).toBe('Not Provided');
      expect(status.badgeSeverity).toBe('neutral');
      expect(status.daysRemaining).toBeNull();
    });

    it('guarantees generateFleetComplianceAlerts produces ZERO expiry alerts for vehicles/drivers with null dates', () => {
      const vehicleWithNulls: VehicleComplianceInput = {
        id: '10000000-0000-0000-0000-000000000001',
        regNo: 'KL01CP3284',
        displayRegNo: 'KL-01-CP-3284',
        vehicleType: 'sedan',
        currentOdometer: 157748,
        rcExpiry: null, // Null / unprovided
        insuranceExpiry: null,
        pollutionExpiry: null,
        permitExpiry: null,
        fitnessExpiry: null,
        isActive: true,
      };

      const driverWithNulls: DriverComplianceInput = {
        id: 'd0000000-0000-0000-0000-000000000001',
        name: 'Hemanth Kumar',
        driverType: 'permanent',
        licenseNo: null,
        licenseExpiry: null,
        policeClearanceDate: null,
        isActive: true,
      };

      const alerts = generateFleetComplianceAlerts([vehicleWithNulls], [driverWithNulls], DEFAULT_COMPLIANCE_SETTINGS, referenceDate);
      // Zero phantom alerts generated!
      expect(alerts.filter(a => a.alertType === 'document_expiry').length).toBe(0);
    });
  });

  // 3. ROUTINE SERVICE AND MAINTENANCE TRACKING
  describe('3. Routine Service & Maintenance Due Tracking', () => {
    const referenceDate = '2026-08-15';

    it('flags routine service due when vehicle is within serviceKmWarningThreshold (300 km remaining)', () => {
      const vehicle: VehicleComplianceInput = {
        id: 'v-01',
        regNo: 'KL01CP3284',
        displayRegNo: 'KL-01-CP-3284',
        vehicleType: 'sedan',
        currentOdometer: 157700,
        lastServiceOdometer: 148000,
        serviceIntervalKm: 10000,
        nextServiceDueKm: 158000, // Due at 158000, remaining = 300 KM (<= 500 KM threshold)
        isActive: true,
      };

      const serviceStatus = checkServiceStatus(vehicle, DEFAULT_COMPLIANCE_SETTINGS, referenceDate);
      expect(serviceStatus.isDue).toBe(true);
      expect(serviceStatus.kmRemaining).toBe(300);
      expect(serviceStatus.severity).toBe('warning');
      expect(serviceStatus.message).toContain('due in 300 KM');
    });

    it('flags critical service overdue when current odometer exceeds due odometer', () => {
      const vehicle: VehicleComplianceInput = {
        id: 'v-01',
        regNo: 'KL01CP3284',
        displayRegNo: 'KL-01-CP-3284',
        vehicleType: 'sedan',
        currentOdometer: 158400, // 400 km overdue!
        nextServiceDueKm: 158000,
        isActive: true,
      };

      const serviceStatus = checkServiceStatus(vehicle, DEFAULT_COMPLIANCE_SETTINGS, referenceDate);
      expect(serviceStatus.isDue).toBe(true);
      expect(serviceStatus.kmRemaining).toBe(-400);
      expect(serviceStatus.severity).toBe('critical');
      expect(serviceStatus.message).toContain('overdue by 400 KM');
    });
  });

  // 4. MONTHLY VEHICLE EMI REMINDER
  describe('4. Monthly Vehicle EMI Reminders', () => {
    it('flags EMI due when current date is within emiDaysWarningThreshold (5 days) of due day', () => {
      // Reference date: August 6. EMI due on 10th. (4 days away <= 5)
      const vehicle: VehicleComplianceInput = {
        id: 'v-01',
        regNo: 'KL01CP3284',
        displayRegNo: 'KL-01-CP-3284',
        vehicleType: 'sedan',
        currentOdometer: 157000,
        monthlyEmiAmount: 18500,
        emiDueDay: 10,
        emiFinancier: 'HDFC Bank',
        isActive: true,
      };

      const emiStatus = checkEmiStatus(vehicle, DEFAULT_COMPLIANCE_SETTINGS, '2026-08-06');
      expect(emiStatus.isDue).toBe(true);
      expect(emiStatus.severity).toBe('warning');
      expect(emiStatus.message).toContain('due in 4 days (Day 10)');
    });

    it('flags critical EMI alert when due day is TODAY', () => {
      const vehicle: VehicleComplianceInput = {
        id: 'v-01',
        regNo: 'KL01CP3284',
        displayRegNo: 'KL-01-CP-3284',
        vehicleType: 'sedan',
        currentOdometer: 157000,
        monthlyEmiAmount: 18500,
        emiDueDay: 10,
        isActive: true,
      };

      const emiStatus = checkEmiStatus(vehicle, DEFAULT_COMPLIANCE_SETTINGS, '2026-08-10');
      expect(emiStatus.isDue).toBe(true);
      expect(emiStatus.message).toContain('DUE TODAY');
    });
  });

  // 5. VEHICLE & DRIVER DOCUMENT CHECKLIST AGGREGATION
  describe('5. Complete Vehicle & Driver Document Checklists', () => {
    const referenceDate = '2026-08-15';

    it('correctly aggregates vehicle checklist document statuses and computes overall status', () => {
      const vehicle: VehicleComplianceInput = {
        id: 'v-01',
        regNo: 'KL01CP3284',
        displayRegNo: 'KL-01-CP-3284',
        vehicleType: 'sedan',
        currentOdometer: 157748,
        rcExpiry: '2028-10-15',      // Valid (>60d)
        insuranceExpiry: '2026-08-20', // Critical_7 (5d)
        pollutionExpiry: '2026-09-10', // Warning_30 (26d)
        permitExpiry: null,          // Missing
        fitnessExpiry: null,         // Missing
        isActive: true,
      };

      const checklist = checkVehicleCompliance(vehicle, DEFAULT_COMPLIANCE_SETTINGS, referenceDate);
      expect(checklist.missingCount).toBe(2); // permit and fitness
      expect(checklist.expiringCount).toBe(2); // insurance (5d) and pollution (26d)
      expect(checklist.expiredCount).toBe(0);
      expect(checklist.overallStatus).toBe('attention_required');
    });

    it('evaluates driver police clearance validity from issue date + validity months', () => {
      // Issued on 2025-09-01. With 12 months validity -> expires 2026-09-01 (17 days from 2026-08-15 -> Warning_30)
      const driver: DriverComplianceInput = {
        id: 'd-01',
        name: 'Hemanth Kumar',
        driverType: 'permanent',
        licenseNo: 'KL-0120150049281',
        licenseExpiry: '2029-05-20', // Valid
        policeClearanceDate: '2025-09-01',
        isActive: true,
      };

      const checklist = checkDriverCompliance(driver, DEFAULT_COMPLIANCE_SETTINGS, referenceDate);
      expect(checklist.documents.license.urgency).toBe('valid');
      expect(checklist.documents.police_clearance.urgency).toBe('warning_30');
      expect(checklist.overallStatus).toBe('attention_required');
    });
  });

  // 6. CONFIGURABLE SETTINGS & DATABASE LOGGING
  describe('6. Configurable Compliance Thresholds & Service Logging', () => {
    it('allows updating compliance alert windows dynamically in database', async () => {
      const customSettings: ComplianceSettings = {
        alertWindowsDays: [90, 45, 15],
        serviceKmWarningThreshold: 800,
        serviceDaysWarningThreshold: 20,
        emiDaysWarningThreshold: 7,
        policeClearanceValidityMonths: 12,
      };

      // Save custom settings
      await ComplianceService.updateSettings(customSettings);
      const loaded = await ComplianceService.getSettings();
      expect(loaded.alertWindowsDays).toEqual([90, 45, 15]);
      expect(loaded.serviceKmWarningThreshold).toBe(800);

      // Verify custom window: 2026-10-15 is 61 days away from 2026-08-15
      // Under default (60, 30, 7), 61 days would be 'valid'.
      // Under custom (90, 45, 15), 61 days is 'notice_60' (within 90 days)!
      const status = checkDocumentStatus('2026-10-15', 'rc', '2026-08-15', loaded.alertWindowsDays);
      expect(status.urgency).toBe('notice_60');
      expect(status.badgeText).toBe('Expires in 61d');

      // Restore default settings
      await ComplianceService.updateSettings(DEFAULT_COMPLIANCE_SETTINGS);
    });

    it('logs vehicle maintenance in database and recalibrates next service due', async () => {
      const serviceLog = await ServerComplianceService.logVehicleService({
        vehicleId: '10000000-0000-0000-0000-000000000001',
        serviceDate: '2026-08-16',
        odometerReading: 157800,
        serviceType: 'periodic',
        workshopName: 'Popular Maruti, Trivandrum',
        billAmount: 5200,
        notes: 'Oil changed, air filter replaced, brake pads inspected.',
      });

      expect(serviceLog.id).toBeDefined();

      // Verify log in test database
      const dbRes = await client.query('SELECT * FROM vehicle_service_logs WHERE id = $1', [serviceLog.id]);
      expect(dbRes.rows.length).toBe(1);
      expect(dbRes.rows[0].workshop_name).toBe('Popular Maruti, Trivandrum');
      expect(Number(dbRes.rows[0].odometer_reading)).toBe(157800);
    });

    it('recalculates next service due using custom per-vehicle service_interval_km (e.g. 7,500 km)', async () => {
      const vehicleId = '10000000-0000-0000-0000-000000000002'; // KL 82 4889

      // Set custom service interval of 7,500 km (instead of default 10,000 km)
      await client.query('UPDATE vehicles SET service_interval_km = 7500 WHERE id = $1', [vehicleId]);

      await ServerComplianceService.logVehicleService({
        vehicleId,
        serviceDate: '2026-08-16',
        odometerReading: 130000,
        serviceType: 'oil_change',
        workshopName: 'Maruti Authorized Service, Kazhakuttom',
        billAmount: 3800,
        notes: 'Synthetic oil 0W-20 & filter change.',
      });

      const vRow = await client.query('SELECT current_odometer, service_interval_km, next_service_due_km FROM vehicles WHERE id = $1', [vehicleId]);
      expect(Number(vRow.rows[0].current_odometer)).toBe(130000);
      expect(Number(vRow.rows[0].service_interval_km)).toBe(7500);
      // next_service_due_km must be 130000 + 7500 = 137500, NOT 140000
      expect(Number(vRow.rows[0].next_service_due_km)).toBe(137500);

      // Verify checkServiceStatus warning triggers based on 7,500 km interval
      const vehicleInput: VehicleComplianceInput = {
        id: vehicleId,
        regNo: 'KL824889',
        displayRegNo: 'KL-82-4889',
        vehicleType: 'ertiga',
        currentOdometer: 137200, // 300 km before 137500 -> within 500 km warning threshold
        serviceIntervalKm: 7500,
        nextServiceDueKm: 137500,
        isActive: true,
      };

      const status = checkServiceStatus(vehicleInput, DEFAULT_COMPLIANCE_SETTINGS);
      expect(status.isDue).toBe(true);
      expect(status.severity).toBe('warning');
      expect(status.kmRemaining).toBe(300);
    });
  });
});
