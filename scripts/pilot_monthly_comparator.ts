import * as fs from 'fs';
import * as path from 'path';
import { importExcelWorkbook, calculateMonthlyFixedInvoice, MonthlyFixedContractParams, DayLedgerEntry } from '../src/engine';

interface ComparisonReport {
  fileName: string;
  sheetName: string;
  monthPeriod: string;
  totalTripsLogged: number;
  actualRunDays: number;
  totalKmUsed: number;
  extraKm: number;
  extraHoursFormatted: string;
  extraHoursDecimal: number;
  nightBataDays: number;
  outstationBataDays: number;
  tollPermitAmount: number;
  computedTotalProRata: number;
  computedTotalLegacyDecimal: number;
  expectedTotal?: number;
  variance?: number;
  itemizedDifferences: string[];
}

export async function compareMonthlyLogbook(
  filePath: string,
  expectedTotal?: number,
  sheetNamePreference?: string,
  contractParams?: Partial<MonthlyFixedContractParams>
): Promise<ComparisonReport> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const workbookResult = importExcelWorkbook(fileBuffer);

  const selectedSheetName = sheetNamePreference && workbookResult.sheets[sheetNamePreference]
    ? sheetNamePreference
    : workbookResult.sheetNames.find((s) => s.toLowerCase().includes('aug') || s.toLowerCase().includes('log') || s.toLowerCase().includes('sept') || s.toLowerCase().includes('oct')) ||
      workbookResult.sheetNames[0];

  const parsedSheet = workbookResult.sheets[selectedSheetName];
  if (!parsedSheet || !parsedSheet.entries || parsedSheet.entries.length === 0) {
    throw new Error(`No valid ledger entries found in sheet "${selectedSheetName}" of ${filePath}`);
  }

  const entries: DayLedgerEntry[] = parsedSheet.entries;

  const defaultParams: MonthlyFixedContractParams = {
    fixedAmount: 65000,
    includedKm: 3000,
    includedHoursPerDay: 12,
    extraKmRate: 16,
    extraHourRate: 150,
    nightBataRate: 200,
    outstationBataRate: 200,
    contractWorkingDays: 30,
    roundingMode: 'down',
    ...contractParams,
  };

  const periodFrom = entries[0]?.date || '2026-08-01';
  const periodTo = entries[entries.length - 1]?.date || '2026-08-31';

  // 1. Pro-rata calculation
  const proRataResult = calculateMonthlyFixedInvoice(periodFrom, periodTo, entries, defaultParams);

  // 2. Legacy decimal hours bug calculation
  const legacyResult = calculateMonthlyFixedInvoice(periodFrom, periodTo, entries, {
    ...defaultParams,
    legacyDecimalHoursBug: true,
  });

  const itemizedDifferences: string[] = [];

  if (proRataResult.totalAmount !== legacyResult.totalAmount) {
    itemizedDifferences.push(
      `Decimal Hours Calculation: Integer minutes pro-rata yields ₹${proRataResult.totalAmount} (extra hours: ₹${proRataResult.extraHoursAmount}), while legacy Excel bug yields ₹${legacyResult.totalAmount} (extra hours: ₹${legacyResult.extraHoursAmount}). Historical drift: ₹${proRataResult.totalAmount - legacyResult.totalAmount}.`
    );
  }

  let variance: number | undefined;
  if (expectedTotal !== undefined) {
    variance = proRataResult.totalAmount - expectedTotal;
    if (variance !== 0) {
      itemizedDifferences.push(
        `Total Invoice Variance: Expected physical invoice ₹${expectedTotal.toLocaleString('en-IN')} vs Computed ₹${proRataResult.totalAmount.toLocaleString('en-IN')} (Difference: ₹${variance > 0 ? '+' : ''}${variance}).`
      );
    } else {
      itemizedDifferences.push(`Total Invoice strictly matches expected physical invoice to the rupee (₹${expectedTotal}).`);
    }
  }

  const hours = Math.floor(proRataResult.totalExtraMinutes / 60);
  const mins = proRataResult.totalExtraMinutes % 60;

  return {
    fileName: path.basename(filePath),
    sheetName: selectedSheetName,
    monthPeriod: `${periodFrom} to ${periodTo}`,
    totalTripsLogged: entries.length,
    actualRunDays: proRataResult.actualRunDays,
    totalKmUsed: proRataResult.totalKmUsed,
    extraKm: proRataResult.extraKm,
    extraHoursFormatted: `${hours}h ${mins}m (${proRataResult.totalExtraMinutes} mins)`,
    extraHoursDecimal: proRataResult.extraHoursDecimal,
    nightBataDays: proRataResult.nightBataDays,
    outstationBataDays: proRataResult.outstationBataDays,
    tollPermitAmount: proRataResult.tollPermitAmount,
    computedTotalProRata: proRataResult.totalAmount,
    computedTotalLegacyDecimal: legacyResult.totalAmount,
    expectedTotal,
    variance,
    itemizedDifferences,
  };
}

// CLI runner
if (process.argv[1]?.includes('pilot_monthly_comparator')) {
  const filePath = process.argv[2] || 'reference/Log book VTL Aug 2027.xlsx';
  const expected = process.argv[3] ? parseFloat(process.argv[3]) : 68617;
  const sheet = process.argv[4] || 'Aug';

  console.log('================================================================');
  console.log('   STARCITI PILOT MONTHLY COMPARATOR & RECONCILIATION SCRIPT   ');
  console.log('================================================================');
  console.log(`Analyzing file: ${filePath}`);
  console.log(`Expected physical invoice total: ₹${expected}`);
  console.log(`Selected Sheet: ${sheet}`);
  console.log('----------------------------------------------------------------');

  compareMonthlyLogbook(filePath, expected, sheet)
    .then((report) => {
      console.log(`Period:                  ${report.monthPeriod}`);
      console.log(`Total Trips Logged:      ${report.totalTripsLogged}`);
      console.log(`Actual Run Days:         ${report.actualRunDays}`);
      console.log(`Total KM Used:           ${report.totalKmUsed} KM (Included: 3000 KM, Extra: ${report.extraKm} KM)`);
      console.log(`Extra Working Hours:     ${report.extraHoursFormatted}`);
      console.log(`Night Bata:              ${report.nightBataDays} days (₹${report.nightBataDays * 200})`);
      console.log(`Outstation Bata:         ${report.outstationBataDays} days (₹${report.outstationBataDays * 200})`);
      console.log(`Toll & Permit:           ₹${report.tollPermitAmount}`);
      console.log('----------------------------------------------------------------');
      console.log(`Computed (Pro-rata):     ₹${report.computedTotalProRata.toLocaleString('en-IN')}`);
      console.log(`Computed (Legacy Bug):   ₹${report.computedTotalLegacyDecimal.toLocaleString('en-IN')}`);
      console.log(`Expected Total:          ₹${report.expectedTotal?.toLocaleString('en-IN')}`);
      console.log(`Variance:                ₹${report.variance}`);
      console.log('----------------------------------------------------------------');
      console.log('Itemized Findings:');
      report.itemizedDifferences.forEach((diff, i) => console.log(` [${i + 1}] ${diff}`));
      console.log('================================================================');
    })
    .catch((err) => {
      console.error('Comparison error:', err.message);
      process.exit(1);
    });
}
