import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  importExcelWorkbook,
  parseExcelTime,
  exportLedgerToExcel,
} from '../engine';
import { ledgerService } from '../services/ledgerService';

describe('Milestone 4: Excel Import Wizard & Robust Parser', () => {
  const filePath = path.resolve(__dirname, '../../reference/Log book VTL Aug 2027.xlsx');
  const buffer = fs.readFileSync(filePath);

  // TEST 1: Clean Aug sheet import
  it('parses the Aug sheet cleanly with 31 days, 25 run days, 1884 KM and 0 fatal errors', () => {
    const result = importExcelWorkbook(buffer);
    expect(result.sheetNames).toContain('Aug');

    const aug = result.sheets['Aug'];
    expect(aug).toBeDefined();
    expect(aug.entries.length).toBe(31);

    const runDays = aug.entries.filter((e) => e.dayStatus === 'RUN' || e.dayStatus === 'SUBSTITUTE');
    expect(runDays.length).toBe(25);

    const totalKm = runDays.reduce((sum, e) => sum + (e.usedKm || 0), 0);
    expect(totalKm).toBe(1884);

    expect(aug.summary.errorCount).toBe(0);
  });

  // TEST 2: Messy ALL sheet import without crashing
  it('parses the messy ALL sheet WITHOUT CRASHING and produces an actionable issue list', () => {
    const result = importExcelWorkbook(buffer);
    expect(result.sheetNames).toContain('ALL');

    const allSheet = result.sheets['ALL'];
    expect(allSheet).toBeDefined();
    // Must not crash and should parse valid rows
    expect(allSheet.entries.length).toBeGreaterThanOrEqual(20);

    // Issues list must be generated
    expect(allSheet.issues.length).toBeGreaterThan(0);

    // 1. Check vehicle typo corrections
    const vehicleIssues = allSheet.issues.filter((i) => i.code === 'TYPO_VEHICLE_PLATE');
    expect(vehicleIssues.length).toBeGreaterThanOrEqual(1);

    // KLO CP 3284 normalized to KL01 CP 3284
    const kloFix = vehicleIssues.find((i) => String(i.rawValue).includes('KLO'));
    expect(kloFix).toBeDefined();
    expect(kloFix?.suggestedFix).toBe('KL01 CP 3284');

    // 2. Check decimal KM typo fix (0.142603 -> 142603)
    const decimalKmIssue = allSheet.issues.find((i) => i.code === 'DECIMAL_KM_TYPO');
    expect(decimalKmIssue).toBeDefined();
    expect(decimalKmIssue?.suggestedFix).toBe(142603);

    // 3. Check summary footer rows skipped cleanly
    const summaryIssue = allSheet.issues.find((i) => i.code === 'SUMMARY_ROW_SKIPPED');
    expect(summaryIssue).toBeDefined();

    // 4. Check empty numbered rows (27-31) skipped cleanly
    const emptyNumIssue = allSheet.issues.find((i) => i.code === 'EMPTY_NUMBERED_ROW');
    expect(emptyNumIssue).toBeDefined();

    // 5. Check out of order dates detected
    const orderIssue = allSheet.issues.find((i) => i.code === 'DATE_OUT_OF_ORDER');
    expect(orderIssue).toBeDefined();
  });

  // TEST 3: VTL Log (Aug 2025 older format) parsing
  it('parses VTL Log (Aug 2025) and extracts embedded allowances from remarks', () => {
    const result = importExcelWorkbook(buffer);
    const vtlLog = result.sheets['VTL Log'];
    expect(vtlLog).toBeDefined();

    // Row with "Kochi", "out 250", "Night 250", "T 400"
    const kochiTrip = vtlLog.entries.find((e) => e.remarks && e.remarks.toLowerCase().includes('kochi'));
    expect(kochiTrip).toBeDefined();
    expect(kochiTrip?.nightBata).toBe(true);
    expect(kochiTrip?.outstationBata).toBe(true);
    expect(kochiTrip?.toll).toBe(400);
  });

  // TEST 4: Unit parser helpers
  it('unit parser: correctly resolves diverse Excel time formats', () => {
    // Fraction of day: 0.375 = 09:00, 0.75 = 18:00
    expect(parseExcelTime(0.375).timeStr).toBe('09:00');
    expect(parseExcelTime(0.75).timeStr).toBe('18:00');

    // Floats: 8.45 = 08:45, 12.30 = 12:30
    expect(parseExcelTime(8.45).timeStr).toBe('08:45');
    expect(parseExcelTime(12.30).timeStr).toBe('12:30');

    // Varied strings
    expect(parseExcelTime('9.am').timeStr).toBe('09:00');
    expect(parseExcelTime('10.pm night').timeStr).toBe('22:00');
    expect(parseExcelTime('9.15p m').timeStr).toBe('21:15');
    expect(parseExcelTime('5.15am').timeStr).toBe('05:15');
  });

  // TEST 5: Excel Exporter & Round-Trip verification
  it('exports clean Excel workbook and verifies round-trip reading', () => {
    const sampleEntries = [
      { date: '2026-08-01', dayStatus: 'RUN' as const, startKm: 155622, closeKm: 155670, usedKm: 48, durationMinutes: 780, nightBata: true, remarks: 'Airport' },
      { date: '2026-08-02', dayStatus: 'SUNDAY' as const, usedKm: 0, durationMinutes: 0 },
    ];

    const exportedBytes = exportLedgerToExcel(sampleEntries, { sheetTitle: 'Aug 2026 Export' });
    expect(exportedBytes.length).toBeGreaterThan(100);

    // Re-import the exported bytes
    const reimported = importExcelWorkbook(exportedBytes);
    expect(reimported.sheetNames).toContain('Aug 2026 Export');

    const importedSheet = reimported.sheets['Aug 2026 Export'];
    expect(importedSheet.entries.length).toBe(2);
    expect(importedSheet.entries[0].usedKm).toBe(48);
    expect(importedSheet.entries[0].nightBata).toBe(true);
  });

  // TEST 6: Anomaly detection - same KM range on different dates
  it('detects same KM range on different dates as potential copy-paste error', () => {
    // Generate a mini workbook with same KM range on 2 different days
    const rows = [
      ['Date', 'Vehicle', 'St KM', 'Cl.KM', 'T KM'],
      ['2026-08-01', 'KL01 CP 3284', 1000, 1050, 50],
      ['2026-08-03', 'KL01 CP 3284', 1000, 1050, 50], // Duplicate range!
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = importExcelWorkbook(bytes);
    const issues = result.sheets['Test'].issues;
    const sameKmIssue = issues.find((i) => i.code === 'SAME_KM_DIFFERENT_DATES');
    expect(sameKmIssue).toBeDefined();
    expect(sameKmIssue?.message).toContain('Same KM range (1000 to 1050)');
  });

  // TEST 7: Anomaly detection - exact duplicate rows
  it('detects exact duplicate rows', () => {
    const rows = [
      ['Date', 'Vehicle', 'St KM', 'Cl.KM', 'T KM'],
      ['2026-08-01', 'KL01 CP 3284', 1000, 1050, 50],
      ['2026-08-01', 'KL01 CP 3284', 1000, 1050, 50], // Exact duplicate!
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = importExcelWorkbook(bytes);
    const dupIssue = result.sheets['Test'].issues.find((i) => i.code === 'EXACT_DUPLICATE_ROW');
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.code).toBe('EXACT_DUPLICATE_ROW');
  });

  // TEST 8: Anomaly detection - close time < start time
  it('detects close time < start time and flags question: overnight run or typo?', () => {
    const rows = [
      ['Date', 'Vehicle', 'St KM', 'Cl.KM', 'ST Time', 'CL Time'],
      ['2026-08-01', 'KL01 CP 3284', 1000, 1050, '22:00', '06:00'], // Close earlier than start
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = importExcelWorkbook(bytes);
    const timeIssue = result.sheets['Test'].issues.find((i) => i.code === 'CLOSE_BEFORE_START_TIME');
    expect(timeIssue).toBeDefined();
    expect(timeIssue?.message).toContain('overnight duty crossing midnight (+24h) or a clerical typo');
    expect(result.sheets['Test'].entries[0].endsNextDay).toBe(true);
    expect(result.sheets['Test'].entries[0].durationMinutes).toBe(480); // 8 hours
  });

  // TEST 9: Anomaly detection - odometer outlier vs neighbours
  it('detects odometer outlier vs neighbours (e.g. 117741 amid 96xxx)', () => {
    const rows = [
      ['Date', 'Vehicle', 'St KM', 'Cl.KM'],
      ['2026-08-01', 'KL01 CP 3284', 96100, 96200],
      ['2026-08-02', 'KL01 CP 3284', 117741, 117850], // Huge jump of +21,541 km!
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = importExcelWorkbook(bytes);
    const outlierIssue = result.sheets['Test'].issues.find((i) => i.code === 'ODOMETER_OUTLIER');
    expect(outlierIssue).toBeDefined();
    expect(outlierIssue?.message).toContain('Odometer outlier detected');
    expect(outlierIssue?.message).toContain('117741');
    expect(outlierIssue?.message).toContain('21,541');
  });

  // TEST 10: Idempotent commit - importing the same file twice adds 0 rows
  it('commit is idempotent: importing the same file twice adds 0 rows', () => {
    const result = importExcelWorkbook(buffer);
    const augEntries = result.sheets['Aug'].entries;

    // First import into a fresh contract namespace
    const firstRun = ledgerService.importEntries('idempotent-test', '2026-08', augEntries);
    expect(firstRun.addedCount).toBeGreaterThanOrEqual(1);

    // Second import with the exact same entries
    const secondRun = ledgerService.importEntries('idempotent-test', '2026-08', augEntries);
    expect(secondRun.addedCount).toBe(0); // ZERO rows added on second run!
    expect(secondRun.totalCount).toBe(firstRun.totalCount);
  });
});
