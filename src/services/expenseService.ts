import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  FuelLogInput,
  FuelLogRecord,
  OtherExpenseInput,
  OtherExpenseRecord,
  VehicleFuelSettings,
  VehicleCategory,
  DEFAULT_VEHICLE_FUEL_SETTINGS,
  validateFuelEntry,
} from '../engine/expenses';

export interface ReviewActionParams {
  id: string;
  action: 'approve' | 'hold' | 'reject';
  heldReason?: string;
  reviewedBy: string;
}

export class ExpenseService {
  private static mockFuelLogs: FuelLogRecord[] = [];
  private static mockOtherExpenses: OtherExpenseRecord[] = [];
  private static mockFuelSettings: Record<VehicleCategory, VehicleFuelSettings> = {
    ...DEFAULT_VEHICLE_FUEL_SETTINGS,
  };

  /**
   * Fetches fuel efficiency threshold settings per vehicle type
   */
  public static async getFuelSettings(): Promise<VehicleFuelSettings[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vehicle_fuel_settings')
          .select('*')
          .order('vehicle_type', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            vehicleType: d.vehicle_type as VehicleCategory,
            minKml: parseFloat(d.min_kml),
            maxKml: parseFloat(d.max_kml),
            targetKml: parseFloat(d.target_kml),
            fuelType: d.fuel_type,
            unit: d.unit || 'km/L',
            receiptPhotoMandatory: d.receipt_photo_mandatory,
            duplicateWindowDays: d.duplicate_window_days,
            isDefaultAssumption: d.is_default_assumption ?? true,
            note: d.note || 'default assumption (editable)',
          }));
        }
      } catch (err) {
        console.warn('Falling back to local fuel settings:', err);
      }
    }
    return Object.values(this.mockFuelSettings);
  }

  /**
   * Updates vehicle fuel threshold settings (Admin only)
   */
  public static async updateFuelSettings(
    settings: VehicleFuelSettings
  ): Promise<VehicleFuelSettings> {
    this.mockFuelSettings[settings.vehicleType] = settings;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('vehicle_fuel_settings')
          .upsert({
            vehicle_type: settings.vehicleType,
            min_kml: settings.minKml,
            max_kml: settings.maxKml,
            target_kml: settings.targetKml,
            fuel_type: settings.fuelType,
            unit: settings.unit || 'km/L',
            receipt_photo_mandatory: settings.receiptPhotoMandatory,
            duplicate_window_days: settings.duplicateWindowDays,
            is_default_assumption: settings.isDefaultAssumption ?? false,
            note: settings.note || null,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            vehicleType: data.vehicle_type,
            minKml: parseFloat(data.min_kml),
            maxKml: parseFloat(data.max_kml),
            targetKml: parseFloat(data.target_kml),
            fuelType: data.fuel_type,
            unit: data.unit || 'km/L',
            receiptPhotoMandatory: data.receipt_photo_mandatory,
            duplicateWindowDays: data.duplicate_window_days,
            isDefaultAssumption: data.is_default_assumption ?? true,
            note: data.note || 'default assumption (editable)',
          };
        }
      } catch (err) {
        console.warn('Fallback saving local fuel settings:', err);
      }
    }
    return settings;
  }

  /**
   * Submits a new fuel log entry by a driver
   */
  public static async submitFuelEntry(input: FuelLogInput): Promise<FuelLogRecord> {
    const settingsList = await this.getFuelSettings();
    const setting = settingsList.find((s) => s.vehicleType === input.vehicleType) || DEFAULT_VEHICLE_FUEL_SETTINGS.sedan;

    // Fetch existing entries for duplicate detection
    const existingLogs = await this.getFuelLogs('all');
    const prevOdo = input.previousOdometer;

    const validation = validateFuelEntry(input, prevOdo, setting, existingLogs);

    const record: FuelLogRecord = {
      ...input,
      id: crypto.randomUUID(),
      isFullTank: !!input.isFullTank,
      receiptNumber: input.receiptNumber,
      perceptualHash: input.perceptualHash,
      totalAmount: validation.totalAmount,
      kmPerLitre: validation.kmPerLitre ?? undefined,
      status: 'submitted',
      anomalies: validation.anomalies,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('fuel_expenses')
          .insert({
            id: record.id,
            driver_id: record.driverId,
            vehicle_id: record.vehicleId,
            entry_date: record.entryDate,
            odometer_reading: record.odometerReading,
            previous_odometer: record.previousOdometer || null,
            fuel_litres: record.fuelLitres,
            rate_per_litre: record.ratePerLitre,
            total_amount: record.totalAmount,
            fuel_station: record.fuelStation || null,
            is_full_tank: record.isFullTank,
            receipt_number: record.receiptNumber || null,
            receipt_photo_url: record.receiptPhotoUrl || null,
            receipt_hash: record.receiptHash || null,
            perceptual_hash: record.perceptualHash || null,
            km_per_litre: record.kmPerLitre || null,
            status: record.status,
            anomalies: JSON.stringify(record.anomalies),
            notes: record.notes || null,
          })
          .select()
          .single();

        if (!error && data) {
          record.id = data.id;
        }
      } catch (err) {
        console.warn('Fallback saving fuel log to local mock:', err);
      }
    }

    this.mockFuelLogs.unshift(record);
    return record;
  }

  /**
   * Retrieves fuel logs filtered by status
   */
  public static async getFuelLogs(
    filter: 'all' | 'pending' | 'held' | 'approved' = 'all'
  ): Promise<FuelLogRecord[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('fuel_expenses').select('*').order('entry_date', { ascending: false });
        if (filter === 'pending') query = query.eq('status', 'submitted');
        if (filter === 'held') query = query.eq('status', 'held_from_settlement');
        if (filter === 'approved') query = query.eq('status', 'approved');

        const { data, error } = await query;
        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            driverId: d.driver_id,
            vehicleId: d.vehicle_id,
            vehicleType: 'sedan',
            entryDate: d.entry_date,
            odometerReading: parseFloat(d.odometer_reading),
            previousOdometer: d.previous_odometer ? parseFloat(d.previous_odometer) : undefined,
            fuelLitres: parseFloat(d.fuel_litres),
            ratePerLitre: parseFloat(d.rate_per_litre),
            totalAmount: parseFloat(d.total_amount),
            fuelStation: d.fuel_station,
            isFullTank: !!d.is_full_tank,
            receiptNumber: d.receipt_number,
            receiptPhotoUrl: d.receipt_photo_url,
            receiptHash: d.receipt_hash,
            perceptualHash: d.perceptual_hash,
            kmPerLitre: d.km_per_litre ? parseFloat(d.km_per_litre) : undefined,
            status: d.status,
            heldReason: d.held_reason,
            anomalies: typeof d.anomalies === 'string' ? JSON.parse(d.anomalies) : d.anomalies || [],
            reviewedBy: d.reviewed_by,
            reviewedAt: d.reviewed_at,
            notes: d.notes,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {
        console.warn('Fallback to local mock fuel logs:', err);
      }
    }

    if (filter === 'pending') return this.mockFuelLogs.filter((l) => l.status === 'submitted');
    if (filter === 'held') return this.mockFuelLogs.filter((l) => l.status === 'held_from_settlement');
    if (filter === 'approved') return this.mockFuelLogs.filter((l) => l.status === 'approved');
    return this.mockFuelLogs;
  }

  /**
   * Reviews a fuel expense: approve, hold from settlement, or reject
   */
  public static async reviewFuelEntry(params: ReviewActionParams): Promise<FuelLogRecord> {
    if (params.action === 'hold' && (!params.heldReason || params.heldReason.trim() === '')) {
      throw new Error('Mandatory justification reason is required to hold an expense from driver settlement.');
    }

    const nextStatus =
      params.action === 'approve'
        ? 'approved'
        : params.action === 'hold'
        ? 'held_from_settlement'
        : 'rejected';

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('fuel_expenses')
          .update({
            status: nextStatus,
            held_reason: params.heldReason || null,
            reviewed_by: params.reviewedBy,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            driverId: data.driver_id,
            vehicleId: data.vehicle_id,
            vehicleType: 'sedan',
            entryDate: data.entry_date,
            odometerReading: parseFloat(data.odometer_reading),
            fuelLitres: parseFloat(data.fuel_litres),
            ratePerLitre: parseFloat(data.rate_per_litre),
            totalAmount: parseFloat(data.total_amount),
            isFullTank: !!data.is_full_tank,
            status: data.status,
            heldReason: data.held_reason,
            anomalies: typeof data.anomalies === 'string' ? JSON.parse(data.anomalies) : data.anomalies || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn('Fallback updating local fuel log mock:', err);
      }
    }

    const log = this.mockFuelLogs.find((l) => l.id === params.id);
    if (!log) {
      throw new Error(`Fuel log entry not found: ${params.id}`);
    }

    log.status = nextStatus;
    log.heldReason = params.heldReason;
    log.reviewedBy = params.reviewedBy;
    log.reviewedAt = new Date().toISOString();
    log.updatedAt = new Date().toISOString();

    return log;
  }

  /**
   * Submits a non-fuel driver expense (toll, parking, etc.)
   */
  public static async submitOtherExpense(input: OtherExpenseInput): Promise<OtherExpenseRecord> {
    const record: OtherExpenseRecord = {
      ...input,
      id: crypto.randomUUID(),
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('driver_other_expenses')
          .insert({
            id: record.id,
            driver_id: record.driverId,
            vehicle_id: record.vehicleId,
            trip_id: record.tripId || null,
            expense_date: record.expenseDate,
            category: record.category,
            amount: record.amount,
            description: record.description || null,
            receipt_photo_url: record.receiptPhotoUrl || null,
            status: record.status,
          })
          .select()
          .single();

        if (!error && data) {
          record.id = data.id;
        }
      } catch (err) {
        console.warn('Fallback saving other expense to local mock:', err);
      }
    }

    this.mockOtherExpenses.unshift(record);
    return record;
  }
}
