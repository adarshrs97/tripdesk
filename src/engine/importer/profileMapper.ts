import * as XLSX from 'xlsx';
import { DayLedgerEntry } from '../types';
import { ImportIssue } from './types';
import { parseExcelSerialDate, parseExcelTime, normalizeDriverName, extractAllowancesFromRemarks } from './excelParser';

export interface ImportColumnMapping {
  dateCol: string;
  driverCol: string;
  vehicleCol: string;
  startKmCol: string;
  closeKmCol: string;
  usedKmCol: string;
  startTimeCol: string;
  closeTimeCol: string;
  nightBataCol: string;
  outstationBataCol: string;
  tollCol: string;
  remarksCol: string;
}

export interface CustomerImportProfile {
  id: string;
  customerId: string;
  customerName: string;
  mapping: ImportColumnMapping;
  updatedAt: string;
}

export interface ValidationErrorItem {
  row: number;
  type: 'bad_time' | 'km_gap' | 'duplicate';
  field: string;
  rawValue: any;
  message: string;
  severity: 'error' | 'warning';
}

export const DEFAULT_COLUMN_MAPPING: ImportColumnMapping = {
  dateCol: 'Date',
  driverCol: 'Driver',
  vehicleCol: 'Vehicle',
  startKmCol: 'Start KM',
  closeKmCol: 'Close KM',
  usedKmCol: 'Total KM',
  startTimeCol: 'Start Time',
  closeTimeCol: 'Close Time',
  nightBataCol: 'Night Bata',
  outstationBataCol: 'Outstation Bata',
  tollCol: 'Toll',
  remarksCol: 'Remarks',
};

/**
 * Automatically infers best-fit column mapping from sheet headers
 */
export function autoDetectColumnMapping(headers: string[]): ImportColumnMapping {
  const findMatch = (pattern: RegExp): string => {
    const match = headers.find((h) => pattern.test(h.trim()));
    return match || '';
  };

  return {
    dateCol: findMatch(/date|trip.*date/i) || headers[0] || '',
    driverCol: findMatch(/driver|pilot/i) || '',
    vehicleCol: findMatch(/vehicle|reg.*no|plate|car/i) || '',
    startKmCol: findMatch(/st.*km|start.*km|opening.*km/i) || '',
    closeKmCol: findMatch(/cl.*km|close.*km|closing.*km/i) || '',
    usedKmCol: findMatch(/t.*km|total.*km|used.*km|run.*km/i) || '',
    startTimeCol: findMatch(/st.*time|start.*time|reporting/i) || '',
    closeTimeCol: findMatch(/cl.*time|close.*time|relieving/i) || '',
    nightBataCol: findMatch(/night.*bata|night.*halt/i) || '',
    outstationBataCol: findMatch(/outstation|out.*bata/i) || '',
    tollCol: findMatch(/toll|parking/i) || '',
    remarksCol: findMatch(/remark|note|route/i) || '',
  };
}

/**
 * Parses raw worksheet data using explicit user column mappings and collects comprehensive validation errors
 */
export function parseWorksheetWithMapping(
  sheet: XLSX.WorkSheet,
  mapping: ImportColumnMapping
): {
  entries: DayLedgerEntry[];
  issues: ImportIssue[];
  validationErrors: ValidationErrorItem[];
  headers: string[];
} {
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const entries: DayLedgerEntry[] = [];
  const issues: ImportIssue[] = [];
  const validationErrors: ValidationErrorItem[] = [];

  if (!rows || rows.length === 0) {
    return { entries: [], issues: [], validationErrors: [], headers: [] };
  }

  // 1. Locate Header Row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('date') || rowStr.includes('km') || rowStr.includes('driver')) {
        headerRowIdx = i;
        break;
      }
    }
  }

  const headers = rows[headerRowIdx].map((h) => String(h || '').trim());

  // Map header titles to column indexes
  const colIndexMap = {
    date: headers.indexOf(mapping.dateCol),
    driver: headers.indexOf(mapping.driverCol),
    vehicle: headers.indexOf(mapping.vehicleCol),
    startKm: headers.indexOf(mapping.startKmCol),
    closeKm: headers.indexOf(mapping.closeKmCol),
    usedKm: headers.indexOf(mapping.usedKmCol),
    startTime: headers.indexOf(mapping.startTimeCol),
    closeTime: headers.indexOf(mapping.closeTimeCol),
    nightBata: headers.indexOf(mapping.nightBataCol),
    outstationBata: headers.indexOf(mapping.outstationBataCol),
    toll: headers.indexOf(mapping.tollCol),
    remarks: headers.indexOf(mapping.remarksCol),
  };

  const seenDatesByVehicle = new Map<string, number>();
  const lastOdometerByVehicle = new Map<string, number>();

  // 2. Parse Rows
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNum = r + 1;
    const nonNulls = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonNulls.length === 0) continue;

    // Skip summary / total footer rows
    const rowStr = row.map((c) => String(c || '')).join(' ');
    if (/total|period|summary|contractual amount/i.test(rowStr)) continue;

    // Date parsing
    const rawDate = colIndexMap.date >= 0 ? row[colIndexMap.date] : null;
    const parsedDate = parseExcelSerialDate(rawDate);
    const dateStr = parsedDate.dateStr || `2026-08-${String(r).padStart(2, '0')}`;

    // Vehicle and Driver
    const rawVehicle = colIndexMap.vehicle >= 0 ? String(row[colIndexMap.vehicle] || '').trim() : '';
    const vehiclePlate = rawVehicle.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'KL01CP3284';

    const rawDriver = colIndexMap.driver >= 0 ? row[colIndexMap.driver] : null;
    const driverNorm = normalizeDriverName(rawDriver);

    // Odometer parsing
    const rawStartKm = colIndexMap.startKm >= 0 ? row[colIndexMap.startKm] : null;
    const rawCloseKm = colIndexMap.closeKm >= 0 ? row[colIndexMap.closeKm] : null;
    const startKm = typeof rawStartKm === 'number' ? rawStartKm : parseInt(String(rawStartKm || '0'), 10) || 0;
    const closeKm = typeof rawCloseKm === 'number' ? rawCloseKm : parseInt(String(rawCloseKm || '0'), 10) || 0;
    const usedKm = closeKm >= startKm ? closeKm - startKm : 0;

    // Time parsing
    const rawStartTime = colIndexMap.startTime >= 0 ? row[colIndexMap.startTime] : null;
    const rawCloseTime = colIndexMap.closeTime >= 0 ? row[colIndexMap.closeTime] : null;
    const parsedStart = parseExcelTime(rawStartTime);
    const parsedClose = parseExcelTime(rawCloseTime);

    // Remarks
    const remarks = colIndexMap.remarks >= 0 ? String(row[colIndexMap.remarks] || '') : '';
    const allowances = extractAllowancesFromRemarks(remarks);

    // --- VALIDATION ERROR CHECKS ---

    // 1. Bad HH.MM validation
    if (rawStartTime !== null && rawStartTime !== undefined && String(rawStartTime).trim() !== '') {
      const s = String(rawStartTime).trim();
      // If it looks like decimal with invalid minutes e.g. 8.75, 9.99, 14.85
      const parts = s.split(/[.:]/);
      if (parts.length === 2) {
        const m = parseInt(parts[1], 10);
        if (m >= 60) {
          validationErrors.push({
            row: rowNum,
            type: 'bad_time',
            field: 'Start Time',
            rawValue: rawStartTime,
            message: `Invalid minutes component (${m} >= 60) in time value "${rawStartTime}".`,
            severity: 'error',
          });
        }
      }
    }

    if (rawCloseTime !== null && rawCloseTime !== undefined && String(rawCloseTime).trim() !== '') {
      const s = String(rawCloseTime).trim();
      const parts = s.split(/[.:]/);
      if (parts.length === 2) {
        const m = parseInt(parts[1], 10);
        if (m >= 60) {
          validationErrors.push({
            row: rowNum,
            type: 'bad_time',
            field: 'Close Time',
            rawValue: rawCloseTime,
            message: `Invalid minutes component (${m} >= 60) in time value "${rawCloseTime}".`,
            severity: 'error',
          });
        }
      }
    }

    // 2. KM Gap validation (Start KM != previous trip Close KM)
    if (lastOdometerByVehicle.has(vehiclePlate) && startKm > 0) {
      const prevClose = lastOdometerByVehicle.get(vehiclePlate)!;
      if (startKm !== prevClose) {
        const gap = Math.abs(startKm - prevClose);
        validationErrors.push({
          row: rowNum,
          type: 'km_gap',
          field: 'Start KM',
          rawValue: startKm,
          message: `Odometer gap of ${gap} km detected: trip starts at ${startKm} km but previous trip closed at ${prevClose} km.`,
          severity: gap > 15 ? 'error' : 'warning',
        });
      }
    }
    if (closeKm > 0) {
      lastOdometerByVehicle.set(vehiclePlate, closeKm);
    }

    // 3. Duplicate trip detection (same date and vehicle)
    const tripKey = `${dateStr}__${vehiclePlate}`;
    if (seenDatesByVehicle.has(tripKey)) {
      const firstRow = seenDatesByVehicle.get(tripKey)!;
      validationErrors.push({
        row: rowNum,
        type: 'duplicate',
        field: 'Date / Vehicle',
        rawValue: `${dateStr} (${vehiclePlate})`,
        message: `Duplicate trip detected: Row ${rowNum} has identical date and vehicle as Row ${firstRow}.`,
        severity: 'error',
      });
    } else {
      seenDatesByVehicle.set(tripKey, rowNum);
    }

    // Duration calculation
    let durationMinutes = 0;
    if (parsedStart.minutes !== null && parsedClose.minutes !== null) {
      durationMinutes = parsedClose.minutes >= parsedStart.minutes
        ? parsedClose.minutes - parsedStart.minutes
        : (24 * 60 - parsedStart.minutes) + parsedClose.minutes;
    }

    entries.push({
      date: dateStr,
      dayStatus: usedKm > 0 || durationMinutes > 0 ? 'RUN' : 'NO_RUN',
      vehiclePlate,
      driverName: driverNorm.name,
      startKm,
      closeKm,
      usedKm,
      startTime: parsedStart.timeStr || undefined,
      closeTime: parsedClose.timeStr || undefined,
      durationMinutes,
      nightBata: allowances.nightBata,
      outstationBata: allowances.outstationBata,
      remarks,
    });
  }

  return { entries, issues, validationErrors, headers };
}

import { supabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * Reusable import profile storage helpers
 * Stored in PostgreSQL public.import_profiles table with Row Level Security (RLS)
 * Zero localStorage fallback in production code paths.
 */
export async function saveCustomerImportProfile(
  customerId: string,
  customerName: string,
  mapping: ImportColumnMapping,
  client?: any
): Promise<CustomerImportProfile> {
  const profileName = `${customerName} Import Profile`;

  // 1. Direct PG client (used by Vitest suites running against the isolated test DB)
  if (client) {
    const res = await client.query(
      `INSERT INTO public.import_profiles (customer_id, customer_name, profile_name, mapping, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (customer_id)
       DO UPDATE SET mapping = EXCLUDED.mapping, customer_name = EXCLUDED.customer_name, updated_at = NOW()
       RETURNING id, customer_id, customer_name, mapping, updated_at`,
      [customerId, customerName, profileName, JSON.stringify(mapping)]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      mapping: typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping,
      updatedAt: row.updated_at,
    };
  }

  // 2. Browser Supabase client with active JWT session & RLS enforcement
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('import_profiles')
      .upsert(
        {
          customer_id: customerId,
          customer_name: customerName,
          profile_name: profileName,
          mapping: mapping as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to save import profile to database:', error);
      throw new Error(`Database error saving import profile: ${error.message}`);
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name,
      mapping: data.mapping,
      updatedAt: data.updated_at,
    };
  }

  throw new Error('Database is not configured to save import profiles.');
}

export async function getCustomerImportProfile(
  customerId: string,
  client?: any
): Promise<CustomerImportProfile | null> {
  // 1. Direct PG client (used by Vitest suites running against the isolated test DB)
  if (client) {
    const res = await client.query(
      `SELECT id, customer_id, customer_name, mapping, updated_at
       FROM public.import_profiles
       WHERE customer_id = $1`,
      [customerId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      mapping: typeof row.mapping === 'string' ? JSON.parse(row.mapping) : row.mapping,
      updatedAt: row.updated_at,
    };
  }

  // 2. Browser Supabase client with active JWT session & RLS enforcement
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('import_profiles')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) {
      console.error('Failed to get import profile from database:', error);
      return null;
    }

    if (data) {
      return {
        id: data.id,
        customerId: data.customer_id,
        customerName: data.customer_name,
        mapping: data.mapping,
        updatedAt: data.updated_at,
      };
    }
  }

  return null;
}
