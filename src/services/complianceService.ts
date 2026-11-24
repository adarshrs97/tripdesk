import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  ComplianceSettings,
  ComplianceAlert,
  DEFAULT_COMPLIANCE_SETTINGS,
  VehicleComplianceInput,
  DriverComplianceInput,
  VehicleChecklistResult,
  DriverChecklistResult,
  checkVehicleCompliance,
  checkDriverCompliance,
  generateFleetComplianceAlerts,
} from '../engine/compliance';
import { MastersService } from './mastersService';

export interface VehicleServiceLogInput {
  vehicleId: string;
  serviceDate: string;
  odometerReading: number;
  serviceType: 'periodic' | 'oil_change' | 'brake_pad' | 'tyres' | 'accidental' | 'general';
  workshopName: string;
  billAmount: number;
  billPhotoUrl?: string;
  notes?: string;
}

export class ComplianceService {
  private static localSettings: ComplianceSettings = { ...DEFAULT_COMPLIANCE_SETTINGS };
  private static localServiceLogs: any[] = [];

  /**
   * Fetches configurable compliance alert thresholds
   */
  public static async getSettings(): Promise<ComplianceSettings> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('compliance_settings')
          .select('*')
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            alertWindowsDays: data.alert_windows_days || [60, 30, 7],
            serviceKmWarningThreshold: data.service_km_warning_threshold ?? 500,
            serviceDaysWarningThreshold: data.service_days_warning_threshold ?? 14,
            emiDaysWarningThreshold: data.emi_days_warning_threshold ?? 5,
            policeClearanceValidityMonths: data.police_clearance_validity_months ?? 12,
          };
        }
      } catch (err) {
        console.warn('Falling back to local compliance settings:', err);
      }
    }
    return this.localSettings;
  }

  /**
   * Updates compliance alert settings (Admin only)
   */
  public static async updateSettings(settings: ComplianceSettings): Promise<ComplianceSettings> {
    this.localSettings = settings;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('compliance_settings')
          .upsert({
            id: settings.id || 'e0000000-0000-0000-0000-000000000001',
            alert_windows_days: settings.alertWindowsDays,
            service_km_warning_threshold: settings.serviceKmWarningThreshold,
            service_days_warning_threshold: settings.serviceDaysWarningThreshold,
            emi_days_warning_threshold: settings.emiDaysWarningThreshold,
            police_clearance_validity_months: settings.policeClearanceValidityMonths,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            alertWindowsDays: data.alert_windows_days,
            serviceKmWarningThreshold: data.service_km_warning_threshold,
            serviceDaysWarningThreshold: data.service_days_warning_threshold,
            emiDaysWarningThreshold: data.emi_days_warning_threshold,
            policeClearanceValidityMonths: data.police_clearance_validity_months,
          };
        }
      } catch (err) {
        console.warn('Failed saving compliance settings to Supabase, using local:', err);
      }
    }
    return settings;
  }

  /**
   * Generates fleet checklists and compliance alerts for vehicles and drivers
   */
  public static async getFleetComplianceOverview(
    referenceDateStr: string = new Date().toISOString().split('T')[0]
  ): Promise<{
    settings: ComplianceSettings;
    vehicleChecklists: VehicleChecklistResult[];
    driverChecklists: DriverChecklistResult[];
    alerts: ComplianceAlert[];
    metrics: {
      totalVehicles: number;
      totalDrivers: number;
      criticalAlerts: number;
      warningAlerts: number;
      noticeAlerts: number;
      missingDocsCount: number;
    };
  }> {
    const settings = await this.getSettings();
    const rawVehicles = await MastersService.getVehicles();
    const rawDrivers = await MastersService.getDrivers();

    const vehicles: VehicleComplianceInput[] = rawVehicles.map((v: any) => ({
      id: v.id,
      regNo: v.regNo,
      displayRegNo: v.displayRegNo || v.regNo,
      vehicleType: v.vehicleType,
      makeModel: v.makeModel,
      currentOdometer: v.currentOdometer || 0,
      rcExpiry: v.rcExpiry,
      insuranceExpiry: v.insuranceExpiry,
      pollutionExpiry: v.pollutionExpiry,
      permitExpiry: v.permitExpiry,
      fitnessExpiry: v.fitnessExpiry,
      monthlyEmiAmount: v.monthlyEmiAmount ? parseFloat(v.monthlyEmiAmount) : null,
      emiDueDay: v.emiDueDay,
      emiFinancier: v.emiFinancier,
      emiAccountNo: v.emiAccountNo,
      lastServiceOdometer: v.lastServiceOdometer,
      lastServiceDate: v.lastServiceDate,
      serviceIntervalKm: v.serviceIntervalKm || 10000,
      nextServiceDueKm: v.nextServiceDueKm,
      nextServiceDueDate: v.nextServiceDueDate,
      isActive: v.isActive ?? true,
    }));

    const drivers: DriverComplianceInput[] = rawDrivers.map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      driverType: d.driverType,
      licenseNo: d.licenseNo,
      licenseExpiry: d.licenseExpiry,
      policeClearanceDate: d.policeClearanceDate,
      isActive: d.isActive ?? true,
    }));

    const vehicleChecklists = vehicles.map(v => checkVehicleCompliance(v, settings, referenceDateStr));
    const driverChecklists = drivers.map(d => checkDriverCompliance(d, settings, referenceDateStr));
    const alerts = generateFleetComplianceAlerts(vehicles, drivers, settings, referenceDateStr);

    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
    const noticeAlerts = alerts.filter(a => a.severity === 'notice').length;

    const missingDocsCount = vehicleChecklists.reduce((acc, c) => acc + c.missingCount, 0) +
      driverChecklists.reduce((acc, c) => acc + c.missingCount, 0);

    return {
      settings,
      vehicleChecklists,
      driverChecklists,
      alerts,
      metrics: {
        totalVehicles: vehicles.length,
        totalDrivers: drivers.length,
        criticalAlerts,
        warningAlerts,
        noticeAlerts,
        missingDocsCount,
      },
    };
  }

  /**
   * Logs a vehicle service / maintenance event and recalibrates next service due
   */
  public static async logVehicleService(input: VehicleServiceLogInput): Promise<any> {
    const record = {
      id: crypto.randomUUID(),
      vehicle_id: input.vehicleId,
      service_date: input.serviceDate,
      odometer_reading: input.odometerReading,
      service_type: input.serviceType,
      workshop_name: input.workshopName,
      bill_amount: input.billAmount,
      bill_photo_url: input.billPhotoUrl || null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('vehicle_service_logs').insert(record);

        // Fetch vehicle service interval if set
        const { data: vData } = await supabase
          .from('vehicles')
          .select('service_interval_km')
          .eq('id', input.vehicleId)
          .single();
        const interval = vData?.service_interval_km || 10000;

        // Update vehicle odometer and service due
        await supabase
          .from('vehicles')
          .update({
            last_service_odometer: input.odometerReading,
            last_service_date: input.serviceDate,
            current_odometer: input.odometerReading,
            next_service_due_km: input.odometerReading + interval,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.vehicleId);
      } catch (err) {
        console.warn('Failed saving service log to Supabase:', err);
      }
    }

    this.localServiceLogs.unshift(record);
    return record;
  }
}
