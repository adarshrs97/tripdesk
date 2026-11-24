import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import {
  calculateFullTankEconomy,
  detectOdometerRollback,
  detectKmlOutlier,
  detectDuplicateReceipt,
  detectMissingReceipt,
  validateFuelEntry,
  computeHammingDistance,
  getFuelUnit,
  getFuelQuantityUnit,
  calibrateVehicleThresholds,
  DEFAULT_VEHICLE_FUEL_SETTINGS,
} from '../engine/expenses';
import { ServerExpenseService } from '../services/serverExpenseService';
import { createTestClient, assertTestDatabaseGuard, TEST_PG_CONFIG } from './testDbHelper';

describe('Milestone 7a: Driver Expenses, Fuel Checks & Test Hygiene', () => {
  let client: Client;

  // Real seeded IDs
  const sedanVehicleId = '10000000-0000-0000-0000-000000000001'; // KL 01 CP 3284
  const driverHemanthId = 'd0000000-0000-0000-0000-000000000001'; // Driver Hemanth Kumar
  const hemanthUserId = 'c0000000-0000-0000-0000-000000000003';
  const afzalUserId = 'c0000000-0000-0000-0000-000000000005';
  const driverFayazId = 'd0000000-0000-0000-0000-000000000002'; // Driver Fayaz
  const staffUserId = 'c0000000-0000-0000-0000-000000000002'; // Staff

  beforeAll(async () => {
    // 1. Connect exclusively to the isolated test database
    client = await createTestClient();
    await assertTestDatabaseGuard(client);

    // 2. Point ServerExpenseService to the verified test database
    ServerExpenseService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'test',
    };

    // 3. Clean test database table
    await client.query('DELETE FROM fuel_expenses');
  });

  afterAll(async () => {
    if (client) {
      await client.query('DELETE FROM fuel_expenses');
      await client.end();
    }
  });

  // 0. MANDATORY TEST HYGIENE & SAFETY GUARD
  describe('0. Test Hygiene & Safety Guard', () => {
    it('safety guard strictly refuses to run tests against databases not named "test"', async () => {
      const mockDangerousClient = {
        query: async (sql: string) => {
          if (sql.includes('current_database')) {
            return { rows: [{ db_name: 'starciti_production' }] };
          }
          return { rows: [] };
        },
      } as any;

      await expect(assertTestDatabaseGuard(mockDangerousClient)).rejects.toThrow(
        /FATAL SAFETY VIOLATION: Refusing to run tests against database "starciti_production"/
      );
    });

    it('confirms the active test suite is running against an isolated test database', async () => {
      const res = await client.query('SELECT current_database() as db_name');
      expect(res.rows[0].db_name.toLowerCase()).toContain('test');
    });
  });

  // 1. PURE ENGINE FULL-TANK METHOD & ANOMALY TESTS
  describe('1. Full-Tank Method & Fuel Anomaly Rules', () => {
    it('full-to-full correct km/L: properly accumulates intermediate partial fills into total fuel', () => {
      // Historical entries:
      // Entry 1: Full tank at 156000 km
      // Entry 2: Partial fill of 15.0 L at 156300 km
      // Entry 3: Full tank of 25.0 L at 156720 km
      // Total distance = 720 km. Total fuel = 15.0 + 25.0 = 40.0 L. Economy = 18.0 km/L
      const history = [
        {
          driverId: driverHemanthId,
          vehicleId: sedanVehicleId,
          vehicleType: 'sedan' as const,
          entryDate: '2026-08-01',
          odometerReading: 156000,
          fuelLitres: 40.0,
          ratePerLitre: 96.5,
          isFullTank: true,
        },
        {
          driverId: driverHemanthId,
          vehicleId: sedanVehicleId,
          vehicleType: 'sedan' as const,
          entryDate: '2026-08-05',
          odometerReading: 156300,
          fuelLitres: 15.0,
          ratePerLitre: 96.5,
          isFullTank: false, // Partial fill
        },
      ];

      const currentFullTankEntry = {
        driverId: driverHemanthId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan' as const,
        entryDate: '2026-08-10',
        odometerReading: 156720,
        fuelLitres: 25.0,
        ratePerLitre: 96.5,
        isFullTank: true, // Second full tank
        receiptPhotoUrl: 'https://storage.starciti.com/fuel/receipt_101.jpg',
      };

      const result = calculateFullTankEconomy(currentFullTankEntry, history);
      expect(result.status).toBe('computed');
      expect(result.fullFillCount).toBe(2);
      expect(result.distanceKm).toBe(720);
      expect(result.accumulatedLitres).toBe(40.0);
      expect(result.kmPerLitre).toBe(18.0);

      // Validate composite entry: within sedan range (16.0 - 22.0) -> zero anomalies
      const validation = validateFuelEntry(currentFullTankEntry, 156300, undefined, history);
      expect(validation.kmPerLitre).toBe(18.0);
      expect(validation.anomalies.length).toBe(0);
      expect(validation.requiresReview).toBe(false);
    });

    it('partial-fill false alarm: single partial fills never raise km/L outliers and report insufficient data', () => {
      // Driver puts only 5L on a 200km trip. Under naive math, 200/5 = 40 km/L (false high outlier).
      // Under full-tank method, partial fills return status 'insufficient_data' and NEVER trigger outliers.
      const history = [
        {
          driverId: driverHemanthId,
          vehicleId: sedanVehicleId,
          vehicleType: 'sedan' as const,
          entryDate: '2026-08-01',
          odometerReading: 156000,
          fuelLitres: 40.0,
          ratePerLitre: 96.5,
          isFullTank: true,
        },
      ];

      const partialFillEntry = {
        driverId: driverHemanthId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan' as const,
        entryDate: '2026-08-03',
        odometerReading: 156200,
        fuelLitres: 5.0,
        ratePerLitre: 96.5,
        isFullTank: false, // Partial fill
        receiptPhotoUrl: 'https://storage.starciti.com/fuel/partial_01.jpg',
      };

      const economy = calculateFullTankEconomy(partialFillEntry, history);
      expect(economy.status).toBe('insufficient_data');
      expect(economy.kmPerLitre).toBeNull();
      expect(economy.message).toContain('Partial fill recorded');

      const outlier = detectKmlOutlier(economy, DEFAULT_VEHICLE_FUEL_SETTINGS.sedan);
      expect(outlier).toBeNull(); // ZERO outlier alarm!

      const validation = validateFuelEntry(partialFillEntry, 156000, undefined, history);
      expect(validation.kmPerLitre).toBeNull();
      expect(validation.anomalies.some(a => a.code.includes('KML_OUTLIER'))).toBe(false);
      expect(validation.requiresReview).toBe(false);
    });

    it('vehicles with <2 full fills have no outlier checks', () => {
      // Vehicle with only 1 full fill has no baseline
      const initialFill = {
        driverId: driverHemanthId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan' as const,
        entryDate: '2026-08-01',
        odometerReading: 156000,
        fuelLitres: 45.0,
        ratePerLitre: 96.5,
        isFullTank: true,
      };

      const economy = calculateFullTankEconomy(initialFill, []);
      expect(economy.status).toBe('insufficient_data');
      expect(economy.fullFillCount).toBe(1);
      expect(economy.kmPerLitre).toBeNull();

      const outlier = detectKmlOutlier(economy, DEFAULT_VEHICLE_FUEL_SETTINGS.sedan);
      expect(outlier).toBeNull();
    });

    it('receipt re-photographed but same bill: triggers DUPLICATE_RECEIPT via perceptual image hash and POS bill metadata', () => {
      const existingEntry = {
        driverId: driverHemanthId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan' as const,
        entryDate: '2026-08-15',
        odometerReading: 156500,
        fuelLitres: 25.0,
        ratePerLitre: 96.5,
        totalAmount: 2412.5,
        fuelStation: 'Indian Oil Killipalam',
        receiptNumber: 'IOCL-98432',
        receiptHash: 'sha256-original-bytes-001',
        perceptualHash: 'a1b2c3d4e5f60718', // 64-bit dHash
      };

      // 1. Same bill re-photographed from another angle/lighting:
      // Cryptographic hash changes completely ('sha256-retaken-bytes-999'),
      // but perceptual visual hash is near-identical (Hamming distance = 1)!
      const rephotographedEntry = {
        driverId: driverFayazId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan' as const,
        entryDate: '2026-08-15',
        odometerReading: 156520,
        fuelLitres: 25.0,
        ratePerLitre: 96.5,
        totalAmount: 2412.5,
        fuelStation: 'Indian Oil Killipalam',
        receiptHash: 'sha256-retaken-bytes-999',
        perceptualHash: 'a1b2c3d4e5f60719', // Hamming distance 1
      };

      const distance = computeHammingDistance(rephotographedEntry.perceptualHash, existingEntry.perceptualHash);
      expect(distance).toBe(1);

      const dupAnomaly = detectDuplicateReceipt(rephotographedEntry, [existingEntry]);
      expect(dupAnomaly).not.toBeNull();
      expect(dupAnomaly!.code).toBe('DUPLICATE_RECEIPT');
      expect(dupAnomaly!.message).toContain('perceptual image matching');

      // 2. Matching POS receipt serial number from same station
      const matchingBillNoEntry = {
        driverId: driverFayazId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan' as const,
        entryDate: '2026-08-15',
        odometerReading: 156530,
        fuelLitres: 25.0,
        ratePerLitre: 96.5,
        totalAmount: 2412.5,
        fuelStation: 'Indian Oil Killipalam',
        receiptNumber: 'IOCL-98432',
      };

      const dupSerialAnomaly = detectDuplicateReceipt(matchingBillNoEntry, [existingEntry]);
      expect(dupSerialAnomaly).not.toBeNull();
      expect(dupSerialAnomaly!.code).toBe('DUPLICATE_RECEIPT');
      expect(dupSerialAnomaly!.message).toContain('Receipt #IOCL-98432');
    });

    it('flags ODOMETER_ROLLBACK when current reading is less than previous', () => {
      const rollback = detectOdometerRollback(155800, 156000);
      expect(rollback).not.toBeNull();
      expect(rollback!.code).toBe('ODOMETER_ROLLBACK');
      expect(rollback!.severity).toBe('critical');
    });

    it('flags MISSING_RECEIPT when photo is mandatory and not provided', () => {
      const missing = detectMissingReceipt(
        {
          driverId: driverFayazId,
          vehicleId: sedanVehicleId,
          vehicleType: 'sedan',
          entryDate: '2026-08-15',
          odometerReading: 156700,
          fuelLitres: 30.0,
          ratePerLitre: 96.5,
          receiptPhotoUrl: '',
        },
        DEFAULT_VEHICLE_FUEL_SETTINGS.sedan
      );
      expect(missing).not.toBeNull();
      expect(missing!.code).toBe('MISSING_RECEIPT');
    });

    it('maps fuel types (petrol, diesel, CNG, electric) to appropriate efficiency and quantity units', () => {
      expect(getFuelUnit('diesel')).toBe('km/L');
      expect(getFuelUnit('petrol')).toBe('km/L');
      expect(getFuelUnit('cng')).toBe('km/kg');
      expect(getFuelUnit('electric')).toBe('km/kWh');
      expect(getFuelUnit('other')).toBe('km/unit');

      expect(getFuelQuantityUnit('diesel')).toBe('L');
      expect(getFuelQuantityUnit('cng')).toBe('kg');
      expect(getFuelQuantityUnit('electric')).toBe('kWh');

      // Outlier detection message uses the vehicle's unit
      const cngSettings = {
        vehicleType: 'sedan' as const,
        minKml: 20.0,
        maxKml: 30.0,
        targetKml: 25.0,
        fuelType: 'cng' as const,
        unit: 'km/kg',
        receiptPhotoMandatory: true,
        duplicateWindowDays: 3,
      };

      const cngOutlier = detectKmlOutlier(15.0, cngSettings);
      expect(cngOutlier).not.toBeNull();
      expect(cngOutlier!.message).toContain('15 km/kg is below expected minimum of 20 km/kg');

      const evSettings = {
        vehicleType: 'sedan' as const,
        minKml: 5.0,
        maxKml: 8.0,
        targetKml: 6.5,
        fuelType: 'electric' as const,
        unit: 'km/kWh',
        receiptPhotoMandatory: true,
        duplicateWindowDays: 3,
      };

      const evOutlier = detectKmlOutlier(9.5, evSettings);
      expect(evOutlier).not.toBeNull();
      expect(evOutlier!.message).toContain('9.5 km/kWh exceeds realistic maximum of 8 km/kWh');
    });

    it('calibrates thresholds from historical full fills (insufficient data if <3 fills; calculates real bounds if >=3)', () => {
      // 1. Fewer than 3 full fills -> returns insufficient_data
      const insufficientHistory = [
        {
          driverId: driverHemanthId,
          vehicleId: sedanVehicleId,
          vehicleType: 'sedan' as const,
          entryDate: '2026-08-01',
          odometerReading: 150000,
          fuelLitres: 40.0,
          ratePerLitre: 96.5,
          isFullTank: true,
        },
        {
          driverId: driverHemanthId,
          vehicleId: sedanVehicleId,
          vehicleType: 'sedan' as const,
          entryDate: '2026-08-07',
          odometerReading: 150720,
          fuelLitres: 40.0,
          ratePerLitre: 96.5,
          isFullTank: true,
        },
      ];

      const underCalib = calibrateVehicleThresholds(insufficientHistory, 'diesel', 3);
      expect(underCalib.status).toBe('insufficient_data');
      expect(underCalib.message).toContain('Need at least 3 verified full tank fills');

      // 2. Exactly 3 full fills:
      // Fill 1: odo 150000 (baseline full fill)
      // Fill 2: odo 150720, litres 40 (720 km / 40 L = 18.0 km/L)
      // Fill 3: odo 151440, litres 40 (720 km / 40 L = 18.0 km/L)
      // Total interval distance: 151440 - 150000 = 1440 km. Total fuel = 80 L.
      // Average economy: 1440 / 80 = 18.0 km/L.
      // Recommended min: 18.0 * 0.85 = 15.3 km/L.
      // Recommended max: 18.0 * 1.15 = 20.7 km/L.
      const historyWith3Fills = [
        ...insufficientHistory,
        {
          driverId: driverHemanthId,
          vehicleId: sedanVehicleId,
          vehicleType: 'sedan' as const,
          entryDate: '2026-08-14',
          odometerReading: 151440,
          fuelLitres: 40.0,
          ratePerLitre: 96.5,
          isFullTank: true,
        },
      ];

      const calib = calibrateVehicleThresholds(historyWith3Fills, 'diesel', 3);
      expect(calib.status).toBe('calibrated');
      expect(calib.averageEconomy).toBe(18.0);
      expect(calib.recommendedMin).toBe(15.3);
      expect(calib.recommendedMax).toBe(20.7);
      expect(calib.recommendedTarget).toBe(18.0);
      expect(calib.unit).toBe('km/L');
      expect(calib.message).toContain('Calibrated from last 3 full fills');
    });
  });

  // 2. DATABASE WORKFLOW IN TEST DATABASE
  describe('2. Review Queue, Held-from-Settlement & Database Validation', () => {
    let testFuelLogId: string;

    it('submits a fuel log with rollback and stores anomalies in test database', async () => {
      const res = await ServerExpenseService.submitFuelLog({
        driverId: driverHemanthId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan',
        entryDate: '2026-08-17',
        odometerReading: 155500, // Rollback vs 156000
        previousOdometer: 156000,
        isFullTank: true,
        fuelLitres: 25.0,
        ratePerLitre: 96.5,
        fuelStation: 'Indian Oil Killipalam',
        receiptPhotoUrl: 'https://storage.starciti.com/fuel/receipt_aug17.jpg',
      });

      expect(res.id).toBeDefined();
      expect(res.status).toBe('submitted');
      expect(res.anomalies.some((a: any) => a.code === 'ODOMETER_ROLLBACK')).toBe(true);

      testFuelLogId = res.id;
    });

    it('enforces mandatory justification when holding an expense from settlement', async () => {
      await expect(
        ServerExpenseService.reviewFuelLog(
          testFuelLogId,
          'hold',
          staffUserId,
          '' // Empty reason
        )
      ).rejects.toThrow(/Mandatory justification reason is required/);
    });

    it('transitions expense to held_from_settlement with valid reason', async () => {
      const reviewed = await ServerExpenseService.reviewFuelLog(
        testFuelLogId,
        'hold',
        staffUserId,
        'Odometer rollback detected (155500 < 156000). Held pending physical inspection.'
      );

      expect(reviewed.status).toBe('held_from_settlement');
      expect(reviewed.heldReason).toContain('Odometer rollback detected');

      // Verify row in test DB
      const dbCheck = await client.query(
        'SELECT status, held_reason, reviewed_by FROM fuel_expenses WHERE id = $1',
        [testFuelLogId]
      );
      expect(dbCheck.rows[0].status).toBe('held_from_settlement');
      expect(dbCheck.rows[0].reviewed_by).toBe(staffUserId);
    });

    it('verifies held expenses are excluded from settlement payout queries', async () => {
      const settleQuery = await client.query(
        "SELECT * FROM fuel_expenses WHERE driver_id = $1 AND status = 'approved'",
        [driverHemanthId]
      );
      expect(settleQuery.rows.length).toBe(0);

      // Submit and approve clean entry
      const cleanRes = await ServerExpenseService.submitFuelLog({
        driverId: driverHemanthId,
        vehicleId: sedanVehicleId,
        vehicleType: 'sedan',
        entryDate: '2026-08-18',
        odometerReading: 156450,
        previousOdometer: 156000,
        isFullTank: true,
        fuelLitres: 25.0,
        ratePerLitre: 96.5,
        receiptPhotoUrl: 'https://storage.starciti.com/fuel/receipt_aug18.jpg',
      });

      await ServerExpenseService.reviewFuelLog(cleanRes.id, 'approve', staffUserId);

      const settleApproved = await client.query(
        "SELECT id, status FROM fuel_expenses WHERE driver_id = $1 AND status = 'approved'",
        [driverHemanthId]
      );
      expect(settleApproved.rows.length).toBe(1);
      expect(settleApproved.rows[0].status).toBe('approved');
    });
  });

  // 3. ROW LEVEL SECURITY (RLS) IN TEST DATABASE
  describe('3. RLS Security: Real JWT role derivation', () => {
    it('RLS: Driver sees only own fuel logs via authenticated JWT', async () => {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${hemanthUserId}"}', true);`);

      const resHemanth = await client.query('SELECT COUNT(*) FROM fuel_expenses');
      expect(Number(resHemanth.rows[0].count)).toBeGreaterThanOrEqual(1);

      await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${afzalUserId}"}', true);`);
      const resAfzal = await client.query('SELECT COUNT(*) FROM fuel_expenses');
      expect(Number(resAfzal.rows[0].count)).toBe(0);

      await client.query('ROLLBACK');
    });

    it('RLS: Blocks driver from updating fuel expense status', async () => {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "${hemanthUserId}"}', true);`);

      const updateRes = await client.query(
        `UPDATE fuel_expenses SET status = 'approved' WHERE driver_id = '${driverHemanthId}'`
      );
      expect(updateRes.rowCount).toBe(0);

      await client.query('ROLLBACK');
    });
  });
});
