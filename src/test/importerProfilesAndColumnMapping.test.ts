import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  autoDetectColumnMapping,
  parseWorksheetWithMapping,
  saveCustomerImportProfile,
  getCustomerImportProfile,
  ImportColumnMapping,
} from '../engine/importer/profileMapper';
import { createTestClient } from './testDbHelper';

describe('Milestone 10 - Requirement 3: Reusable Customer Import Profiles & Column Mapping', () => {
  it('1. Auto-detects column mapping heuristics from arbitrary custom header names', () => {
    const customHeaders = [
      'Trip Date',
      'Assigned Pilot',
      'Car Registration',
      'Opening KM Odo',
      'Closing KM Odo',
      'Run KM',
      'Reporting Time',
      'Relieving Time',
      'Night Halt',
      'Outstation Allowance',
      'Parking / Toll',
      'Route Notes',
    ];

    const mapping = autoDetectColumnMapping(customHeaders);
    expect(mapping.dateCol).toBe('Trip Date');
    expect(mapping.driverCol).toBe('Assigned Pilot');
    expect(mapping.vehicleCol).toBe('Car Registration');
    expect(mapping.startKmCol).toBe('Opening KM Odo');
    expect(mapping.closeKmCol).toBe('Closing KM Odo');
    expect(mapping.usedKmCol).toBe('Run KM');
    expect(mapping.startTimeCol).toBe('Reporting Time');
    expect(mapping.closeTimeCol).toBe('Relieving Time');
    expect(mapping.nightBataCol).toBe('Night Halt');
    expect(mapping.outstationBataCol).toBe('Outstation Allowance');
    expect(mapping.tollCol).toBe('Parking / Toll');
    expect(mapping.remarksCol).toBe('Route Notes');
  });

  it('2. Saves and retrieves reusable import profiles per customer from test database', async () => {
    const testClient = await createTestClient();
    const customerId = 'c0000000-0000-0000-0000-000000000001'; // Seeded customer in test DB
    const customMapping: ImportColumnMapping = {
      dateCol: 'DT',
      driverCol: 'PILOT',
      vehicleCol: 'VEH_NO',
      startKmCol: 'ODO_START',
      closeKmCol: 'ODO_END',
      usedKmCol: 'KM_RUN',
      startTimeCol: 'IN_TIME',
      closeTimeCol: 'OUT_TIME',
      nightBataCol: 'NIGHT_HALT',
      outstationBataCol: 'OUT_HALT',
      tollCol: 'TOLLS',
      remarksCol: 'NOTES',
    };

    try {
      // 1. Save profile to test DB
      const saved = await saveCustomerImportProfile(customerId, 'M/s Vindhya Telelinks Limited', customMapping, testClient);
      expect(saved).toBeDefined();
      expect(saved.customerId).toBe(customerId);

      // 2. Retrieve profile from test DB
      const loaded = await getCustomerImportProfile(customerId, testClient);
      expect(loaded).toBeDefined();
      expect(loaded?.customerId).toBe(customerId);
      expect(loaded?.customerName).toBe('M/s Vindhya Telelinks Limited');
      expect(loaded?.mapping.startKmCol).toBe('ODO_START');
      expect(loaded?.mapping.closeKmCol).toBe('ODO_END');

      // 3. Direct SQL verification in import_profiles table
      const res = await testClient.query(
        'SELECT id, customer_id, customer_name, profile_name, mapping FROM public.import_profiles WHERE customer_id = $1',
        [customerId]
      );
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].customer_id).toBe(customerId);
      expect(res.rows[0].profile_name).toBe('M/s Vindhya Telelinks Limited Import Profile');
      const dbMapping = typeof res.rows[0].mapping === 'string' ? JSON.parse(res.rows[0].mapping) : res.rows[0].mapping;
      expect(dbMapping.driverCol).toBe('PILOT');
    } finally {
      await testClient.query('DELETE FROM public.import_profiles WHERE customer_id = $1', [customerId]);
      await testClient.end();
    }
  });

  it('3. Parses sheet with mapping and flags validation errors: bad HH.MM, km gaps, and duplicates', () => {
    // Construct sample Excel worksheet data with known errors
    const wsData = [
      ['D_DATE', 'PILOT', 'VEH_REG', 'KM_START', 'KM_CLOSE', 'T_START', 'T_CLOSE', 'NOTES'],
      // Row 2: Valid trip
      ['2026-08-01', 'Hemanth Kumar', 'KL01CP3284', 157000, 157100, '08:00', '18:00', 'Local Technopark run'],
      // Row 3: KM Gap (starts at 157150 instead of 157100)
      ['2026-08-02', 'Hemanth Kumar', 'KL01CP3284', 157150, 157250, '08:30', '19:00', 'Site visit'],
      // Row 4: Bad HH.MM value (close time has 75 minutes: 20.75)
      ['2026-08-03', 'Hemanth Kumar', 'KL01CP3284', 157250, 157350, '09:00', '20.75', 'Overtime shift'],
      // Row 5: Duplicate trip (same date 2026-08-01 and vehicle KL01CP3284 as Row 2)
      ['2026-08-01', 'Hemanth Kumar', 'KL01CP3284', 157000, 157100, '08:00', '18:00', 'Duplicate run entry'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    const mapping: ImportColumnMapping = {
      dateCol: 'D_DATE',
      driverCol: 'PILOT',
      vehicleCol: 'VEH_REG',
      startKmCol: 'KM_START',
      closeKmCol: 'KM_CLOSE',
      usedKmCol: '',
      startTimeCol: 'T_START',
      closeTimeCol: 'T_CLOSE',
      nightBataCol: '',
      outstationBataCol: '',
      tollCol: '',
      remarksCol: 'NOTES',
    };

    const result = parseWorksheetWithMapping(worksheet, mapping);

    expect(result.entries.length).toBe(4);

    // Verify Validation Errors List
    expect(result.validationErrors.length).toBeGreaterThanOrEqual(3);

    // 1. KM Gap Error
    const kmGapErr = result.validationErrors.find((e) => e.type === 'km_gap');
    expect(kmGapErr).toBeDefined();
    expect(kmGapErr?.row).toBe(3);
    expect(kmGapErr?.message).toContain('50 km detected');

    // 2. Bad HH.MM Error
    const badTimeErr = result.validationErrors.find((e) => e.type === 'bad_time');
    expect(badTimeErr).toBeDefined();
    expect(badTimeErr?.row).toBe(4);
    expect(badTimeErr?.message).toContain('75 >= 60');

    // 3. Duplicate Trip Error
    const dupErr = result.validationErrors.find((e) => e.type === 'duplicate');
    expect(dupErr).toBeDefined();
    expect(dupErr?.row).toBe(5);
    expect(dupErr?.message).toContain('Duplicate trip detected');
  });

  it('4. Database RLS: only admin and staff can select or write import profiles', async () => {
    const testClient = await createTestClient();
    const customerId = 'c0000000-0000-0000-0000-000000000001';

    try {
      // 1. As staff/admin: insert and select succeed
      await testClient.query('BEGIN');
      await testClient.query('SET ROLE starciti_app');
      await testClient.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', true)"); // staff
      const insertRes = await testClient.query(
        `INSERT INTO public.import_profiles (customer_id, customer_name, profile_name, mapping)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (customer_id) DO UPDATE SET customer_name = EXCLUDED.customer_name
         RETURNING id`,
        [customerId, 'M/s Vindhya Telelinks Limited', 'Staff Created Profile', JSON.stringify({ dateCol: 'DATE' })]
      );
      expect(insertRes.rows.length).toBe(1);

      const staffSelectRes = await testClient.query('SELECT * FROM public.import_profiles WHERE customer_id = $1', [customerId]);
      expect(staffSelectRes.rows.length).toBe(1);

      // 2. As driver or customer viewer: select is BLOCKED by RLS (returns 0 rows)
      await testClient.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', true)"); // driver
      const driverSelectRes = await testClient.query('SELECT * FROM public.import_profiles WHERE customer_id = $1', [customerId]);
      expect(driverSelectRes.rows.length).toBe(0); // RLS strictly filters out for driver
      await testClient.query('ROLLBACK');
    } finally {
      await testClient.query('RESET request.jwt.claim.role; RESET request.jwt.claim.sub;');
      await testClient.query('DELETE FROM public.import_profiles WHERE customer_id = $1', [customerId]);
      await testClient.end();
    }
  });
});
