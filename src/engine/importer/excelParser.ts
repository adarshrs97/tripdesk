// Pure TypeScript Excel Workbook Parser for Starciti Logbooks
import * as XLSX from 'xlsx';
import { DayLedgerEntry } from '../types';
import { ImportIssue, ParsedSheetResult, WorkbookImportResult } from './types';

/**
 * Converts Excel integer or fractional date serial number to YYYY-MM-DD
 */
export function parseExcelSerialDate(val: any): { dateStr: string | null; isTypo: boolean } {
  if (typeof val === 'number') {
    // Excel epoch begins at 1899-12-30 (accounting for Lotus 1-2-3 1900 leap year bug)
    const wholeDays = Math.floor(val);
    if (wholeDays < 1000 || wholeDays > 80000) {
      return { dateStr: null, isTypo: true };
    }
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + wholeDays * 86400000);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return { dateStr: `${year}-${month}-${day}`, isTypo: false };
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { dateStr: trimmed, isTypo: false };
    }
    // Format DD/MM/YYYY or DD-MM-YYYY
    const dmy = trimmed.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return { dateStr: `${year}-${month}-${day}`, isTypo: false };
    }
  }

  return { dateStr: null, isTypo: true };
}

/**
 * Flexible Excel Time Parser: handles fraction of day, numbers (8.45), and diverse strings ('9.am', '10.pm night', '9.15p m')
 */
export function parseExcelTime(val: any): { timeStr: string | null; minutes: number | null } {
  if (val === undefined || val === null || val === '') {
    return { timeStr: null, minutes: null };
  }

  // Case 1: Excel day fraction (0 < val < 1)
  if (typeof val === 'number' && val > 0 && val < 1) {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { timeStr, minutes: h * 60 + m };
  }

  // Case 2: Number like 8.45 or 12.30
  if (typeof val === 'number' && val >= 1 && val <= 24) {
    const h = Math.floor(val);
    const m = Math.round((val - h) * 100);
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { timeStr, minutes: h * 60 + m };
  }

  // Case 3: Strings with varied styles
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase().replace(/\s+/g, '');

    // Already HH:MM
    const hhmmMatch = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmmMatch) {
      const h = parseInt(hhmmMatch[1], 10);
      const m = parseInt(hhmmMatch[2], 10);
      return {
        timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        minutes: h * 60 + m,
      };
    }

    // Handles '9.am', '9am', '10am', '10.pm', '10.pmnight', '9.15pm', '9.15p m', '7pm'
    const isPm = s.includes('pm') || s.includes('night');
    const isAm = s.includes('am');

    // Extract numbers: e.g. 9.15 or 9
    const cleanNum = s.replace(/[^0-9.]/g, '');
    if (cleanNum) {
      const parts = cleanNum.split('.');
      let h = parseInt(parts[0], 10) || 0;
      let m = parts.length > 1 && parts[1].length > 0 ? parseInt(parts[1], 10) : 0;

      // Single digit minute fix (e.g. 9.1 -> 9:10 or 9:01, typically 15/30/45)
      if (parts.length > 1 && parts[1].length === 1) {
        m = m * 10;
      }

      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;

      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return { timeStr, minutes: h * 60 + m };
    }
  }

  return { timeStr: null, minutes: null };
}

/**
 * Normalizes vehicle plate typos (e.g. KLO -> KL01, Ertiga KL 82 4889 -> KL82 4889)
 */
export function normalizeVehiclePlate(val: any): { plate: string; wasCorrected: boolean; original: string } {
  if (!val || typeof val !== 'string') {
    return { plate: 'KL01 CP 3284', wasCorrected: false, original: String(val || '') };
  }

  const raw = val.trim();
  const clean = raw.toUpperCase().replace(/[\s\.\-_]+/g, '');

  // Check if cell actually contains day status rather than a vehicle plate
  if (/^(SUNDAY|HOLIDAY|ONAM|NORUN|LEAVE)$/i.test(clean)) {
    return { plate: '', wasCorrected: false, original: raw };
  }

  // Match KL01 CP 3284 variants: KLO, KLOCP, KLO1CP, KLO13284
  if (clean.includes('3284') || clean.includes('KL01') || clean.includes('KLO1') || clean.includes('KLOCP') || clean.includes('KLO')) {
    const isExact = raw === 'KL01 CP 3284' || raw === 'KL 01 CP 3284';
    return { plate: 'KL01 CP 3284', wasCorrected: !isExact, original: raw };
  }

  // Match KL 82 4889
  if (clean.includes('824889') || clean.includes('4889')) {
    return { plate: 'KL82 4889', wasCorrected: true, original: raw };
  }

  // Match KL 21 M 2378
  if (clean.includes('2378') || clean.includes('21M')) {
    return { plate: 'KL21 M 2378', wasCorrected: true, original: raw };
  }

  // Match KL 74 E 3694
  if (clean.includes('3694') || clean.includes('74E')) {
    return { plate: 'KL74 E 3694', wasCorrected: true, original: raw };
  }

  return { plate: raw, wasCorrected: false, original: raw };
}

/**
 * Normalizes driver names (e.g. trims trailing dots, typos)
 */
export function normalizeDriverName(val: any): { name: string; wasCorrected: boolean } {
  if (!val || typeof val !== 'string') {
    return { name: 'Hemanth Kumar', wasCorrected: false };
  }

  const trimmed = val.trim().replace(/\.+$/, '');
  const lower = trimmed.toLowerCase();

  if (lower.includes('hemanth')) {
    return { name: 'Hemanth Kumar', wasCorrected: trimmed !== 'Hemanth Kumar' };
  }
  if (lower.includes('fayaz')) {
    return { name: 'Muhammad Fayaz.s', wasCorrected: trimmed !== 'Muhammad Fayaz.s' };
  }
  if (lower.includes('asheer')) {
    return { name: 'Asheerkhan', wasCorrected: trimmed !== 'Asheerkhan' };
  }
  if (lower.includes('afzal')) {
    return { name: 'Afzal', wasCorrected: trimmed !== 'Afzal' };
  }

  return { name: trimmed, wasCorrected: false };
}

/**
 * Scans remarks string for embedded allowance annotations (e.g. "out 250", "N 250", "Night 250", "T 400")
 */
export function extractAllowancesFromRemarks(remarks: string | undefined): {
  nightBata: boolean;
  outstationBata: boolean;
  toll: number;
  permit: number;
} {
  if (!remarks) {
    return { nightBata: false, outstationBata: false, toll: 0, permit: 0 };
  }

  const text = remarks.toLowerCase();
  const hasNight = text.includes('night') || text.includes('n 250') || text.includes('n250');
  const hasOutstation = text.includes('out') || text.includes('kanyakumari') || text.includes('kollam') || text.includes('pala');

  let toll = 0;
  let permit = 0;

  const tMatch = text.match(/\bt\s*(\d+)/i);
  if (tMatch) {
    toll = parseInt(tMatch[1], 10);
  }

  const pMatch = text.match(/premit\s*(\d+)|permit\s*(\d+)/i);
  if (pMatch) {
    permit = parseInt(pMatch[1] || pMatch[2], 10);
  } else if (text.includes('premit') || text.includes('permit')) {
    permit = 600; // Standard inter-state permit
  }

  return { nightBata: hasNight, outstationBata: hasOutstation, toll, permit };
}

/**
 * Parses a single worksheet into DayLedgerEntry rows and a comprehensive Issue List
 */
export function parseWorksheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedSheetResult {
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const entries: DayLedgerEntry[] = [];
  const issues: ImportIssue[] = [];

  if (!rows || rows.length === 0) {
    return {
      sheetName,
      entries: [],
      issues: [],
      summary: { totalRows: 0, validRows: 0, errorCount: 0, warningCount: 0, infoCount: 0 },
    };
  }

  // 1. Find Header Row
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (Array.isArray(row)) {
      const strRow = row.map((c) => String(c || '').toLowerCase()).join(' ');
      if (strRow.includes('date') && (strRow.includes('km') || strRow.includes('driver') || strRow.includes('vehicle'))) {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0; // Default to first row
  }

  const headers = rows[headerRowIdx].map((h) => String(h || '').trim());
  const colIdx = {
    date: headers.findIndex((h) => /date/i.test(h)),
    driver: headers.findIndex((h) => /driver/i.test(h)),
    vehicle: headers.findIndex((h) => /vehicle/i.test(h)),
    startKm: headers.findIndex((h) => /st.*km|start.*km/i.test(h)),
    closeKm: headers.findIndex((h) => /cl.*km|close.*km/i.test(h)),
    usedKm: headers.findIndex((h) => /t.*km|total.*km|used.*km/i.test(h)),
    startTime: headers.findIndex((h) => /st.*time|start.*time/i.test(h)),
    closeTime: headers.findIndex((h) => /cl.*time|close.*time/i.test(h)),
    nightBata: headers.findIndex((h) => /night.*bata/i.test(h)),
    outstationBata: headers.findIndex((h) => /outstat|out.*bata/i.test(h)),
    remarks: headers.findIndex((h) => /remark/i.test(h)),
  };

  let prevDate: string | null = null;
  let prevCloseKmByVehicle = new Map<string, number>();
  const seenKmRanges = new Map<string, { date: string; rowNum: number }>();
  const seenExactRows = new Set<string>();

  // 2. Parse Data Rows
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNum = r + 1;

    // Detect empty or sparse rows
    const nonNulls = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonNulls.length === 0) continue;

    // Detect summary footer rows (e.g. "Period From Aug 1st..." or "Total" or dateless aggregate row)
    const rowText = row.map((c) => String(c || '')).join(' ');
    const rawDateCheck = colIdx.date >= 0 ? row[colIdx.date] : null;
    if (
      /period|from aug|contractual amount|minimum km|total/i.test(rowText) ||
      (!rawDateCheck && nonNulls.some((v) => typeof v === 'number' && v > 500))
    ) {
      issues.push({
        id: `issue-r${rowNum}-summary`,
        rowNumber: rowNum,
        column: 'Row',
        rawValue: rowText.substring(0, 40),
        severity: 'info',
        code: 'SUMMARY_ROW_SKIPPED',
        message: 'Summary footer calculation row detected and excluded from trip ledger.',
      });
      continue;
    }

    // Detect rows with only SL index (e.g. [ 27 ])
    if (nonNulls.length === 1 && typeof nonNulls[0] === 'number') {
      issues.push({
        id: `issue-r${rowNum}-empty-num`,
        rowNumber: rowNum,
        column: 'Row',
        rawValue: nonNulls[0],
        severity: 'info',
        code: 'EMPTY_NUMBERED_ROW',
        message: `Empty day slot index (${nonNulls[0]}) with no trip details. Recorded as NO_RUN day.`,
        suggestedFix: 'Mark as NO_RUN',
      });
      continue;
    }

    // 3. Extract and Parse Date
    const rawDate = colIdx.date >= 0 ? row[colIdx.date] : null;
    const { dateStr } = parseExcelSerialDate(rawDate);

    if (!dateStr) {
      issues.push({
        id: `issue-r${rowNum}-date`,
        rowNumber: rowNum,
        column: 'Date',
        rawValue: rawDate,
        severity: 'error',
        code: 'INVALID_DATE',
        message: `Unparseable date value: "${rawDate}"`,
      });
      continue; // Cannot proceed without date
    }

    // Check chronological ordering
    if (prevDate && dateStr < prevDate) {
      issues.push({
        id: `issue-r${rowNum}-date-order`,
        rowNumber: rowNum,
        column: 'Date',
        rawValue: dateStr,
        severity: 'warning',
        code: 'DATE_OUT_OF_ORDER',
        message: `Trip date (${dateStr}) appears out of chronological order (previous was ${prevDate}).`,
        suggestedFix: 'Sort chronologically',
      });
    }
    prevDate = dateStr;

    // 4. Vehicle Normalization
    const rawVehicle = colIdx.vehicle >= 0 ? row[colIdx.vehicle] : null;
    const { plate: vehiclePlate, wasCorrected: vehicleCorrected } = normalizeVehiclePlate(rawVehicle);

    if (vehicleCorrected) {
      issues.push({
        id: `issue-r${rowNum}-vehicle-typo`,
        rowNumber: rowNum,
        column: 'Vehicle',
        rawValue: rawVehicle,
        severity: 'warning',
        code: 'TYPO_VEHICLE_PLATE',
        message: `Normalized vehicle typo: "${rawVehicle}" -> "${vehiclePlate}"`,
        suggestedFix: vehiclePlate,
      });
    }

    // 5. Driver Normalization
    const rawDriver = colIdx.driver >= 0 ? row[colIdx.driver] : null;
    const { name: driverName, wasCorrected: driverCorrected } = normalizeDriverName(rawDriver);

    if (driverCorrected) {
      issues.push({
        id: `issue-r${rowNum}-driver`,
        rowNumber: rowNum,
        column: 'Driver',
        rawValue: rawDriver,
        severity: 'info',
        code: 'MISSING_DRIVER',
        message: `Standardized driver name: "${rawDriver}" -> "${driverName}"`,
        suggestedFix: driverName,
      });
    }

    // 6. Odometers & Decimal Bug Handling
    let rawStartKm = colIdx.startKm >= 0 ? row[colIdx.startKm] : null;
    let rawCloseKm = colIdx.closeKm >= 0 ? row[colIdx.closeKm] : null;

    // Check for decimal typo bug: e.g. 0.142603 instead of 142603
    if (typeof rawStartKm === 'number' && rawStartKm > 0 && rawStartKm < 1) {
      const fixedKm = Math.round(rawStartKm * 1000000);
      issues.push({
        id: `issue-r${rowNum}-start-km-dec`,
        rowNumber: rowNum,
        column: 'Start KM',
        rawValue: rawStartKm,
        severity: 'warning',
        code: 'DECIMAL_KM_TYPO',
        message: `Excel decimal typo detected in Start KM: ${rawStartKm} should be ${fixedKm}.`,
        suggestedFix: fixedKm,
      });
      rawStartKm = fixedKm;
    }

    const startKm = typeof rawStartKm === 'number' ? Math.round(rawStartKm) : null;
    const closeKm = typeof rawCloseKm === 'number' ? Math.round(rawCloseKm) : null;

    // Check negative KM
    if (startKm !== null && closeKm !== null && closeKm < startKm) {
      issues.push({
        id: `issue-r${rowNum}-km-neg`,
        rowNumber: rowNum,
        column: 'Close KM',
        rawValue: { startKm, closeKm },
        severity: 'error',
        code: 'NEGATIVE_KM',
        message: `Close KM (${closeKm}) is less than Start KM (${startKm}).`,
      });
    }

    // Check exact duplicate rows
    const rowKey = `${dateStr}:${vehiclePlate}:${startKm}:${closeKm}`;
    if (startKm !== null && closeKm !== null && seenExactRows.has(rowKey)) {
      issues.push({
        id: `issue-r${rowNum}-exact-dup`,
        rowNumber: rowNum,
        column: 'Row',
        rawValue: { date: dateStr, vehicle: vehiclePlate, startKm, closeKm },
        severity: 'error',
        code: 'EXACT_DUPLICATE_ROW',
        message: `Exact duplicate row detected on ${dateStr} for ${vehiclePlate} (Start ${startKm}, Close ${closeKm}).`,
        suggestedFix: 'Deduplicate row',
      });
    }
    seenExactRows.add(rowKey);

    // Check same KM range on different dates
    if (startKm !== null && closeKm !== null && closeKm > startKm) {
      const rangeKey = `${vehiclePlate}:${startKm}-${closeKm}`;
      const existingRange = seenKmRanges.get(rangeKey);
      if (existingRange && existingRange.date !== dateStr) {
        issues.push({
          id: `issue-r${rowNum}-same-km-diff-dates`,
          rowNumber: rowNum,
          column: 'Start KM',
          rawValue: { startKm, closeKm, prevDate: existingRange.date },
          severity: 'warning',
          code: 'SAME_KM_DIFFERENT_DATES',
          message: `Same KM range (${startKm} to ${closeKm}) on ${vehiclePlate} was previously logged on ${existingRange.date} (Row ${existingRange.rowNum}). Suspected copy-paste error.`,
          suggestedFix: 'Verify odometer against paper logbook',
        });
      } else {
        seenKmRanges.set(rangeKey, { date: dateStr, rowNum });
      }
    }

    // Check KM continuity gap and outliers
    const prevClose = prevCloseKmByVehicle.get(vehiclePlate);
    if (startKm !== null && prevClose !== undefined) {
      const gap = startKm - prevClose;
      const delta = Math.abs(startKm - prevClose);

      // Odometer Outlier detection (e.g. 117741 amid 96xxx)
      if (delta > 5000) {
        issues.push({
          id: `issue-r${rowNum}-km-outlier`,
          rowNumber: rowNum,
          column: 'Start KM',
          rawValue: { startKm, prevClose, delta },
          severity: 'warning',
          code: 'ODOMETER_OUTLIER',
          message: `Odometer outlier detected: Start KM (${startKm}) deviates by ${delta.toLocaleString()} km from previous close (${prevClose}) on ${vehiclePlate}.`,
          suggestedFix: `Inspect reading (${startKm}) vs expected (~${prevClose})`,
        });
      } else if (gap > 15) {
        issues.push({
          id: `issue-r${rowNum}-km-gap`,
          rowNumber: rowNum,
          column: 'Start KM',
          rawValue: { startKm, prevClose, gap },
          severity: 'warning',
          code: 'KM_CONTINUITY_GAP',
          message: `Unaccounted gap of ${gap} km on ${vehiclePlate} (Start ${startKm} vs Prev Close ${prevClose}).`,
          suggestedFix: `Review gap (${gap} km)`,
        });
      }
    }
    if (closeKm !== null) {
      prevCloseKmByVehicle.set(vehiclePlate, closeKm);
    }

    // 7. Time Parsing
    const rawStTime = colIdx.startTime >= 0 ? row[colIdx.startTime] : null;
    const rawClTime = colIdx.closeTime >= 0 ? row[colIdx.closeTime] : null;

    const parsedSt = parseExcelTime(rawStTime);
    const parsedCl = parseExcelTime(rawClTime);

    if (rawStTime !== null && parsedSt.timeStr === null) {
      issues.push({
        id: `issue-r${rowNum}-st-time`,
        rowNumber: rowNum,
        column: 'ST Time',
        rawValue: rawStTime,
        severity: 'warning',
        code: 'UNPARSEABLE_TIME',
        message: `Could not parse start time: "${rawStTime}"`,
      });
    }

    // Compute duration & check close time < start time
    let durationMinutes: number | null = null;
    let endsNextDay = false;
    if (parsedSt.minutes !== null && parsedCl.minutes !== null) {
      if (parsedCl.minutes < parsedSt.minutes) {
        endsNextDay = true;
        issues.push({
          id: `issue-r${rowNum}-close-before-start`,
          rowNumber: rowNum,
          column: 'CL Time',
          rawValue: { startTime: parsedSt.timeStr, closeTime: parsedCl.timeStr },
          severity: 'warning',
          code: 'CLOSE_BEFORE_START_TIME',
          message: `Close time (${parsedCl.timeStr}) is earlier than start time (${parsedSt.timeStr}). Flagged: Is this an overnight duty crossing midnight (+24h) or a clerical typo?`,
          suggestedFix: 'Confirm as overnight crossing',
        });
      }
      let dur = parsedCl.minutes - parsedSt.minutes;
      if (dur < 0) dur += 24 * 60; // Next-day crossing
      durationMinutes = dur;
    }

    // 8. Remarks & Allowances across any extra trailing columns (as in older VTL Log sheets)
    const remarkParts: string[] = [];
    if (colIdx.remarks >= 0) {
      for (let c = colIdx.remarks; c < row.length; c++) {
        if (row[c] !== null && row[c] !== undefined && String(row[c]).trim() !== '') {
          remarkParts.push(String(row[c]).trim());
        }
      }
    }
    const rawRemarks = remarkParts.join(' ');
    const allowances = extractAllowancesFromRemarks(rawRemarks);

    const nightBataCol = colIdx.nightBata >= 0 ? Boolean(row[colIdx.nightBata]) : false;
    const outstationCol = colIdx.outstationBata >= 0 ? Boolean(row[colIdx.outstationBata]) : false;

    const isNightBata = nightBataCol || allowances.nightBata;
    const isOutstationBata = outstationCol || allowances.outstationBata;

    // Detect day status across entire row (including when written into vehicle column)
    const isSunday = new Date(dateStr).getDay() === 0 || /sunday/i.test(rowText);
    const isNoRun = /no run/i.test(rowText);
    const isHoliday = /onam|holiday|republic|independence/i.test(rowText);

    let dayStatus: DayLedgerEntry['dayStatus'] = 'RUN';
    if (isNoRun) {
      dayStatus = 'NO_RUN';
    } else if (isSunday && (!startKm || startKm === 0)) {
      dayStatus = 'SUNDAY';
    } else if (isHoliday && (!startKm || startKm === 0)) {
      dayStatus = 'HOLIDAY';
    } else if (vehiclePlate === 'KL74 E 3694' || /substitute/i.test(rowText)) {
      dayStatus = 'SUBSTITUTE';
    }

    const usedKm =
      startKm !== null && closeKm !== null
        ? Math.max(0, closeKm - startKm)
        : colIdx.usedKm >= 0 && typeof row[colIdx.usedKm] === 'number'
        ? row[colIdx.usedKm]
        : 0;

    entries.push({
      date: dateStr,
      dayStatus,
      vehiclePlate,
      driverName,
      startKm,
      closeKm,
      usedKm,
      startTime: parsedSt.timeStr,
      closeTime: parsedCl.timeStr,
      durationMinutes,
      endsNextDay,
      nightBata: isNightBata,
      outstationBata: isOutstationBata,
      toll: allowances.toll,
      permit: allowances.permit,
      remarks: rawRemarks || undefined,
      extra: {
        excelRow: rowNum,
        originalVehicle: rawVehicle,
        originalDriver: rawDriver,
      },
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    sheetName,
    entries,
    issues,
    summary: {
      totalRows: rows.length,
      validRows: entries.length,
      errorCount,
      warningCount,
      infoCount,
    },
  };
}

/**
 * Imports an entire Excel workbook buffer and returns results for each sheet
 */
export function importExcelWorkbook(fileBuffer: ArrayBuffer | Uint8Array): WorkbookImportResult {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const sheets: Record<string, ParsedSheetResult> = {};

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (sheet && sheet['!ref']) {
      sheets[name] = parseWorksheet(sheet, name);
    }
  }

  // Pick default active sheet (prefer 'Aug' or first parsed sheet)
  const activeSheetName = wb.SheetNames.includes('Aug')
    ? 'Aug'
    : wb.SheetNames.includes('July')
    ? 'July'
    : wb.SheetNames.includes('Jul')
    ? 'Jul'
    : Object.keys(sheets)[0] || wb.SheetNames[0];

  return {
    sheetNames: Object.keys(sheets),
    sheets,
    activeSheetName,
  };
}

/**
 * Specifically parses and filters entries for July 2026 from any uploaded logbook sheet or workbook
 */
export function extractJuly2026Entries(workbookResult: WorkbookImportResult): DayLedgerEntry[] {
  const julyEntries: DayLedgerEntry[] = [];
  
  for (const sheetName of workbookResult.sheetNames) {
    const sheetResult = workbookResult.sheets[sheetName];
    if (!sheetResult) continue;

    for (const entry of sheetResult.entries) {
      if (entry.date.startsWith('2026-07')) {
        julyEntries.push(entry);
      }
    }
  }

  return julyEntries;
}
