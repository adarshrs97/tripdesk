import { Client } from 'pg';
import {
  FuelLogInput,
  validateFuelEntry,
  DEFAULT_VEHICLE_FUEL_SETTINGS,
} from '../engine/expenses';

export interface ServerFuelLogResult {
  id: string;
  totalAmount: number;
  kmPerLitre?: number;
  status: string;
  anomalies: any[];
}

export class ServerExpenseService {
  public static pgConfig = {
    host: '127.0.0.1',
    port: 5439,
    user: 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    database: 'starciti',
  };

  /**
   * Submits a fuel log with database anomaly checks
   */
  public static async submitFuelLog(
    input: FuelLogInput,
    authClaims?: { sub: string }
  ): Promise<ServerFuelLogResult> {
    const client = new Client(this.pgConfig);
    await client.connect();

    try {
      if (authClaims) {
        await client.query('SET ROLE starciti_app');
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(authClaims)]);
      }

      // Fetch vehicle settings
      const settingsRes = await client.query(
        'SELECT * FROM vehicle_fuel_settings WHERE vehicle_type = $1',
        [input.vehicleType]
      );
      const settings = settingsRes.rows[0]
        ? {
            vehicleType: settingsRes.rows[0].vehicle_type,
            minKml: parseFloat(settingsRes.rows[0].min_kml),
            maxKml: parseFloat(settingsRes.rows[0].max_kml),
            targetKml: parseFloat(settingsRes.rows[0].target_kml),
            fuelType: settingsRes.rows[0].fuel_type,
            receiptPhotoMandatory: settingsRes.rows[0].receipt_photo_mandatory,
            duplicateWindowDays: settingsRes.rows[0].duplicate_window_days,
          }
        : DEFAULT_VEHICLE_FUEL_SETTINGS[input.vehicleType] || DEFAULT_VEHICLE_FUEL_SETTINGS.sedan;

      // Fetch previous odometer reading for this vehicle
      const prevOdoRes = await client.query(
        `SELECT odometer_reading FROM fuel_expenses 
         WHERE vehicle_id = $1 
         ORDER BY entry_date DESC, created_at DESC 
         LIMIT 1`,
        [input.vehicleId]
      );
      const prevOdometer = input.previousOdometer ?? (prevOdoRes.rows[0] ? parseFloat(prevOdoRes.rows[0].odometer_reading) : undefined);

      // Fetch existing entries and history for duplicate and full-tank calculation
      const existingRes = await client.query(
        `SELECT vehicle_id, entry_date, odometer_reading, fuel_litres, rate_per_litre, total_amount, 
                receipt_hash, receipt_number, perceptual_hash, is_full_tank, fuel_station
         FROM fuel_expenses 
         WHERE vehicle_id = $1 
         ORDER BY odometer_reading ASC`,
        [input.vehicleId]
      );
      const existingEntries = existingRes.rows.map((r) => ({
        driverId: input.driverId,
        vehicleId: r.vehicle_id,
        vehicleType: input.vehicleType,
        entryDate: r.entry_date,
        odometerReading: parseFloat(r.odometer_reading),
        fuelLitres: parseFloat(r.fuel_litres),
        ratePerLitre: parseFloat(r.rate_per_litre || '0'),
        totalAmount: parseFloat(r.total_amount),
        fuelStation: r.fuel_station,
        isFullTank: !!r.is_full_tank,
        receiptNumber: r.receipt_number,
        receiptHash: r.receipt_hash,
        perceptualHash: r.perceptual_hash,
      }));

      // Validate via engine (full-tank method & duplicate rules)
      const validation = validateFuelEntry(input, prevOdometer, settings, existingEntries);

      const insertRes = await client.query(
        `INSERT INTO fuel_expenses (
          driver_id, vehicle_id, entry_date, odometer_reading, previous_odometer,
          fuel_litres, rate_per_litre, total_amount, fuel_station, is_full_tank,
          receipt_number, receipt_photo_url, receipt_hash, perceptual_hash,
          km_per_litre, status, anomalies, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'submitted', $16, $17
        ) RETURNING id, total_amount, km_per_litre, status, anomalies`,
        [
          input.driverId,
          input.vehicleId,
          input.entryDate,
          input.odometerReading,
          prevOdometer || null,
          input.fuelLitres,
          input.ratePerLitre,
          validation.totalAmount,
          input.fuelStation || null,
          !!input.isFullTank,
          input.receiptNumber || null,
          input.receiptPhotoUrl || null,
          input.receiptHash || null,
          input.perceptualHash || null,
          validation.kmPerLitre || null,
          JSON.stringify(validation.anomalies),
          input.notes || null,
        ]
      );

      const row = insertRes.rows[0];
      return {
        id: row.id,
        totalAmount: parseFloat(row.total_amount),
        kmPerLitre: row.km_per_litre ? parseFloat(row.km_per_litre) : undefined,
        status: row.status,
        anomalies: row.anomalies,
      };
    } finally {
      await client.end();
    }
  }

  /**
   * Reviews a fuel expense with mandatory justification for held_from_settlement
   */
  public static async reviewFuelLog(
    id: string,
    action: 'approve' | 'hold' | 'reject',
    reviewedByUserId: string,
    heldReason?: string,
    authClaims?: { sub: string }
  ): Promise<{ id: string; status: string; heldReason?: string }> {
    if (action === 'hold' && (!heldReason || heldReason.trim() === '')) {
      throw new Error('Mandatory justification reason is required to hold an expense from driver settlement.');
    }

    const nextStatus =
      action === 'approve'
        ? 'approved'
        : action === 'hold'
        ? 'held_from_settlement'
        : 'rejected';

    const client = new Client(this.pgConfig);
    await client.connect();

    try {
      if (authClaims) {
        await client.query('SET ROLE starciti_app');
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(authClaims)]);
      }

      const res = await client.query(
        `UPDATE fuel_expenses 
         SET status = $1, held_reason = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $4
         RETURNING id, status, held_reason`,
        [nextStatus, heldReason || null, reviewedByUserId, id]
      );

      if (res.rows.length === 0) {
        throw new Error(`Fuel log not found with ID: ${id}`);
      }

      return {
        id: res.rows[0].id,
        status: res.rows[0].status,
        heldReason: res.rows[0].held_reason,
      };
    } finally {
      await client.end();
    }
  }
}
