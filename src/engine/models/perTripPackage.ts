// Format 1: Per-Trip Package Pricing Model (e.g. Global Public School)

import { DayLedgerEntry, PerTripPackageParams, Format1RowResult, Format1InvoiceResult, LineExplanation } from '../types';
import { applyRounding, inrWords, toPaise, toRupees } from '../currency';
import { formatMinutesToHM } from '../duration';

export function calculateFormat1Row(
  entry: DayLedgerEntry,
  params: PerTripPackageParams
): Format1RowResult {
  const vehicleType = entry.vehicleType || 'Sedan';
  const totalMinutes = entry.durationMinutes || 0;
  const totalKm = entry.usedKm || 0;

  const includedMinutes = params.includedHours * 60;
  const additionalMinutes = Math.max(0, totalMinutes - includedMinutes);
  const additionalKm = Math.max(0, totalKm - params.includedKm);

  // Pro-rata by minute for extra hours: (mins / 60) * extraHourRate
  const additionalHoursAmount = Math.round((additionalMinutes / 60) * params.extraHourRate * 100) / 100;
  const additionalKmAmount = additionalKm * params.extraKmRate;

  const lineTotalPaise = toPaise(params.baseAmount) + toPaise(additionalHoursAmount) + toPaise(additionalKmAmount);
  const lineTotal = toRupees(lineTotalPaise);

  const explanations: LineExplanation[] = [
    {
      field: 'base_amount',
      label: `Base Package (${params.includedHours}h / ${params.includedKm}km)`,
      calculation: `Fixed package rate`,
      rate: params.baseAmount,
      quantity: 1,
      unit: 'day',
      amount: params.baseAmount,
    },
  ];

  if (additionalMinutes > 0) {
    explanations.push({
      field: 'additional_hours',
      label: `Additional Hours (${formatMinutesToHM(additionalMinutes)})`,
      calculation: `(${additionalMinutes} min / 60) * ₹${params.extraHourRate}/hr`,
      rate: params.extraHourRate,
      quantity: Math.round((additionalMinutes / 60) * 100) / 100,
      unit: 'hours',
      amount: additionalHoursAmount,
    });
  }

  if (additionalKm > 0) {
    explanations.push({
      field: 'additional_km',
      label: `Additional KM (${additionalKm} km)`,
      calculation: `${additionalKm} km * ₹${params.extraKmRate}/km`,
      rate: params.extraKmRate,
      quantity: additionalKm,
      unit: 'km',
      amount: additionalKmAmount,
    });
  }

  return {
    date: entry.date,
    vehicleType,
    totalMinutes,
    durationMinutes: totalMinutes,
    durationFormatted: formatMinutesToHM(totalMinutes),
    totalKm,
    usedKm: totalKm,
    baseAmount: params.baseAmount,
    additionalMinutes,
    extraMinutes: additionalMinutes,
    extraHoursFormatted: formatMinutesToHM(additionalMinutes),
    additionalKm,
    extraKm: additionalKm,
    additionalHoursAmount,
    additionalKmAmount,
    lineTotal,
    explanations,
  };
}

export function calculateFormat1Invoice(
  entries: DayLedgerEntry[],
  params: PerTripPackageParams
): Format1InvoiceResult {
  const rows: Format1RowResult[] = [];
  let subtotalPaise = 0;

  for (const entry of entries) {
    const rowRes = calculateFormat1Row(entry, params);
    rows.push(rowRes);
    subtotalPaise += toPaise(rowRes.lineTotal);
  }

  const subtotal = toRupees(subtotalPaise);
  const { rounded: totalAmount, roundOff } = applyRounding(subtotal, params.roundingMode || 'down');
  const amountInWords = inrWords(totalAmount);

  const explanations: LineExplanation[] = [
    {
      field: 'subtotal',
      label: 'Subtotal of Vehicle-Days',
      calculation: `Sum of ${rows.length} vehicle-day package rows`,
      quantity: rows.length,
      unit: 'vehicle-days',
      amount: subtotal,
    },
  ];

  return {
    rows,
    subtotal,
    roundOff,
    totalAmount,
    amountInWords,
    explanations,
  };
}
