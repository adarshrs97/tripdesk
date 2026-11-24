import { Client } from 'pg';
import { VehicleServiceLogInput } from './complianceService';
import { TEST_PG_CONFIG } from '../test/testDbHelper';

export class ServerComplianceService {
  public static pgConfig = {
    host: TEST_PG_CONFIG.host as string,
    port: TEST_PG_CONFIG.port as number,
    user: TEST_PG_CONFIG.user as string,
    password: TEST_PG_CONFIG.password as string,
    database: 'test',
  };

  public static async logVehicleService(input: VehicleServiceLogInput) {
    const client = new Client(this.pgConfig);
    await client.connect();

    try {
      const recordId = crypto.randomUUID();
      await client.query(
        `INSERT INTO vehicle_service_logs (
          id, vehicle_id, service_date, odometer_reading, service_type,
          workshop_name, bill_amount, bill_photo_url, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          recordId,
          input.vehicleId,
          input.serviceDate,
          input.odometerReading,
          input.serviceType,
          input.workshopName,
          input.billAmount,
          input.billPhotoUrl || null,
          input.notes || null,
        ]
      );

      await client.query(
        `UPDATE vehicles SET
          last_service_odometer = $1,
          last_service_date = $2,
          current_odometer = $1,
          next_service_due_km = $1 + COALESCE(service_interval_km, 10000),
          updated_at = NOW()
        WHERE id = $3`,
        [input.odometerReading, input.serviceDate, input.vehicleId]
      );

      return { id: recordId, ...input };
    } finally {
      await client.end();
    }
  }
}
