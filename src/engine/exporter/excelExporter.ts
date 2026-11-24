// Clean Excel Exporter for Starciti Daily Trip Ledger matching Reference Template
import * as XLSX from 'xlsx';
import { DayLedgerEntry } from '../types';
import { formatMinutesToHM } from '../duration';

export interface ExportOptions {
  sheetTitle?: string;
  contractCode?: string;
  customerName?: string;
  periodLabel?: string;
}

export function exportLedgerToExcel(
  entries: DayLedgerEntry[],
  options: ExportOptions = {}
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Build rows array matching Log_book_VTL_Aug_2026.xlsx
  const header = [
    'SL',
    'Date',
    'Driver',
    'Vehicle',
    'St KM',
    'Cl.KM',
    'T KM',
    'ST Time',
    'CL Time',
    'Hours',
    'Additional Hours',
    'Night Bata',
    'outstation bata',
    'Remarks',
  ];

  const dataRows: any[][] = [];

  entries.forEach((entry, idx) => {
    const sl = idx + 1;
    const isRun = entry.dayStatus === 'RUN' || entry.dayStatus === 'SUBSTITUTE';

    let hoursStr = '';
    let addHoursStr = '';

    if (entry.durationMinutes && entry.durationMinutes > 0) {
      hoursStr = formatMinutesToHM(entry.durationMinutes);
      if (entry.durationMinutes > 720) {
        addHoursStr = formatMinutesToHM(entry.durationMinutes - 720);
      }
    }

    dataRows.push([
      sl,
      entry.date,
      entry.driverName || 'Hemanth Kumar',
      entry.vehiclePlate || 'KL01 CP 3284',
      isRun ? entry.startKm ?? '' : '',
      isRun ? entry.closeKm ?? '' : '',
      isRun ? entry.usedKm ?? 0 : '',
      isRun ? entry.startTime ?? '' : '',
      isRun ? entry.closeTime ?? '' : '',
      hoursStr,
      addHoursStr,
      entry.nightBata ? '200' : '',
      entry.outstationBata ? '200' : '',
      entry.remarks || (entry.dayStatus === 'SUNDAY' ? 'Sunday' : entry.dayStatus === 'HOLIDAY' ? 'Holiday' : ''),
    ]);
  });

  // Totals Row
  const totalKm = entries.reduce((sum, e) => sum + (e.usedKm || 0), 0);
  const totalExtraMinutes = entries.reduce((sum, e) => {
    if (e.durationMinutes && e.durationMinutes > 720) {
      return sum + (e.durationMinutes - 720);
    }
    return sum;
  }, 0);

  const nightBataTotal = entries.filter((e) => e.nightBata).length * 200;
  const outstationBataTotal = entries.filter((e) => e.outstationBata).length * 200;

  const totalRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    totalKm,
    '',
    '',
    '',
    formatMinutesToHM(totalExtraMinutes),
    nightBataTotal > 0 ? nightBataTotal : '',
    outstationBataTotal > 0 ? outstationBataTotal : '',
    `Total Run Days: ${entries.filter((e) => e.dayStatus === 'RUN' || e.dayStatus === 'SUBSTITUTE').length}`,
  ];

  dataRows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // SL
    { wch: 12 }, // Date
    { wch: 18 }, // Driver
    { wch: 16 }, // Vehicle
    { wch: 10 }, // St KM
    { wch: 10 }, // Cl.KM
    { wch: 8 },  // T KM
    { wch: 10 }, // ST Time
    { wch: 10 }, // CL Time
    { wch: 10 }, // Hours
    { wch: 16 }, // Additional Hours
    { wch: 12 }, // Night Bata
    { wch: 16 }, // Outstation Bata
    { wch: 30 }, // Remarks
  ];

  const sheetName = options.sheetTitle || 'Aug 2026';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(outBuffer);
}
