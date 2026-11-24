// Format 2: Monthly Fixed Contract Pricing Model (e.g. VTL)

import { DayLedgerEntry, MonthlyFixedContractParams, Format2InvoiceResult, LineExplanation } from '../types';
import { applyRounding, inrWords, toPaise, toRupees } from '../currency';
import { formatMinutesToHM } from '../duration';

export function calculateMonthlyFixedInvoice(
  periodFrom: string,
  periodTo: string,
  entries: DayLedgerEntry[],
  params: MonthlyFixedContractParams
): Format2InvoiceResult {
  const contractWorkingDays = params.contractWorkingDays ?? 30;
  let actualRunDays = 0;
  let totalKmUsed = 0;
  let totalExtraMinutes = 0;
  let nightBataDays = 0;
  let outstationBataDays = 0;
  let airportTaxPaise = 0;
  let tollPermitPaise = 0;
  let extraDaysCount = 0;

  const includedMinutesPerDay = params.includedHoursPerDay * 60;

  for (const entry of entries) {
    const isRun = entry.dayStatus === 'RUN' || (entry.usedKm && entry.usedKm > 0) || (entry.durationMinutes && entry.durationMinutes > 0);

    if (isRun) {
      actualRunDays++;
      totalKmUsed += entry.usedKm || 0;

      // Extra minutes calculation per run day
      if (entry.durationMinutes && entry.durationMinutes > includedMinutesPerDay) {
        let dayExtraMinutes = entry.durationMinutes - includedMinutesPerDay;
        if (params.extraHourBlockMinutes && params.extraHourBlockMinutes > 1) {
          const quotient = dayExtraMinutes / params.extraHourBlockMinutes;
          const dir = params.extraHourRoundingDirection || 'ceil';
          const roundedBlocks = dir === 'ceil' ? Math.ceil(quotient) : dir === 'nearest' ? Math.round(quotient) : Math.floor(quotient);
          dayExtraMinutes = roundedBlocks * params.extraHourBlockMinutes;
        }
        totalExtraMinutes += dayExtraMinutes;
      }

      // Check for Sunday or Holiday runs (Extra Days)
      if (entry.dayStatus === 'SUNDAY' || entry.dayStatus === 'HOLIDAY') {
        extraDaysCount++;
      }
    }

    // Allowances & Tolls
    if (entry.nightBata) nightBataDays++;
    if (entry.outstationBata) outstationBataDays++;
    if (entry.airportTax) airportTaxPaise += toPaise(entry.airportTax);
    if (entry.permit) tollPermitPaise += toPaise(entry.permit);
    if (entry.toll) tollPermitPaise += toPaise(entry.toll);
    if (entry.parking) tollPermitPaise += toPaise(entry.parking);
  }

  // 1. Extra KM
  const fixedKm = params.includedKm;
  const extraKm = Math.max(0, totalKmUsed - fixedKm);
  const extraKmAmount = extraKm * params.extraKmRate;

  // 2. Extra Hours
  let extraHoursAmount: number;
  let extraHoursDecimal: number;

  if (params.legacyDecimalHoursBug) {
    // Legacy Excel/Paper Bug: treated "9h 45m" as decimal "9.45"
    const h = Math.floor(totalExtraMinutes / 60);
    const m = Math.round(totalExtraMinutes % 60);
    extraHoursDecimal = parseFloat(`${h}.${m}`); // 9.45
    extraHoursAmount = Math.round(extraHoursDecimal * params.extraHourRate * 100) / 100; // 1417.50
  } else {
    // Correct Engine Calculation: integer minutes pro-rata
    extraHoursDecimal = Math.round((totalExtraMinutes / 60) * 100) / 100; // 9.75
    extraHoursAmount = Math.round((totalExtraMinutes / 60) * params.extraHourRate * 100) / 100; // 1462.50
  }

  // 3. Batas & Charges
  const nightBataAmount = nightBataDays * params.nightBataRate;
  const outstationBataAmount = outstationBataDays * params.outstationBataRate;
  const airportTaxAmount = toRupees(airportTaxPaise);
  const tollPermitAmount = toRupees(tollPermitPaise);
  const extraDaysAmount = extraDaysCount * (params.extraDayRate || 0);

  // 4. Subtotal & Rounding
  const subtotalPaise =
    toPaise(params.fixedAmount) +
    toPaise(extraHoursAmount) +
    toPaise(extraKmAmount) +
    toPaise(nightBataAmount) +
    toPaise(outstationBataAmount) +
    airportTaxPaise +
    tollPermitPaise +
    toPaise(extraDaysAmount);

  const subtotal = toRupees(subtotalPaise);
  const { rounded: totalAmount, roundOff } = applyRounding(subtotal, params.roundingMode || 'down');
  const amountInWords = inrWords(totalAmount);

  // 5. Line-by-Line Audit Explanations
  const explanations: LineExplanation[] = [
    {
      field: 'fixed_amount',
      label: 'Monthly Fixed Amount',
      calculation: `Agreed monthly fixed retainer (includes ${fixedKm.toLocaleString()} KM & ${params.includedHoursPerDay}h/day)`,
      rate: params.fixedAmount,
      quantity: 1,
      unit: 'month',
      amount: params.fixedAmount,
    },
    {
      field: 'extra_hours',
      label: `Extra Hours @ ₹${params.extraHourRate} each`,
      calculation: params.legacyDecimalHoursBug
        ? `Legacy paper calculation: ${extraHoursDecimal} decimal hrs * ₹${params.extraHourRate}`
        : `${formatMinutesToHM(totalExtraMinutes)} (${totalExtraMinutes} mins = ${extraHoursDecimal} hrs) * ₹${params.extraHourRate}/hr`,
      rate: params.extraHourRate,
      quantity: extraHoursDecimal,
      unit: 'hours',
      amount: extraHoursAmount,
    },
    {
      field: 'extra_km',
      label: `Extra KM @ ₹${params.extraKmRate}/km`,
      calculation: `Used ${totalKmUsed} KM - Included ${fixedKm} KM = ${extraKm} KM * ₹${params.extraKmRate}`,
      rate: params.extraKmRate,
      quantity: extraKm,
      unit: 'km',
      amount: extraKmAmount,
    },
    {
      field: 'night_bata',
      label: 'Night Bata',
      calculation: `${nightBataDays} days * ₹${params.nightBataRate}`,
      rate: params.nightBataRate,
      quantity: nightBataDays,
      unit: 'days',
      amount: nightBataAmount,
    },
    {
      field: 'outstation_bata',
      label: 'Outstation Bata',
      calculation: `${outstationBataDays} days * ₹${params.outstationBataRate}`,
      rate: params.outstationBataRate,
      quantity: outstationBataDays,
      unit: 'days',
      amount: outstationBataAmount,
    },
    {
      field: 'toll_permit',
      label: 'Toll & Permit',
      calculation: `Total tolls, permits, and parking receipts logged across the month`,
      amount: tollPermitAmount,
    },
  ];

  if (airportTaxAmount > 0) {
    explanations.push({
      field: 'airport_tax',
      label: 'Airport Tax',
      calculation: `Airport parking & access receipts`,
      amount: airportTaxAmount,
    });
  }

  const snapshotJson = {
    periodFrom,
    periodTo,
    contractWorkingDays,
    actualRunDays,
    totalKmUsed,
    fixedKm,
    extraKm,
    totalExtraMinutes,
    extraHoursFormatted: formatMinutesToHM(totalExtraMinutes),
    extraHoursAmount,
    fixedAmount: params.fixedAmount,
    nightBataAmount,
    outstationBataAmount,
    tollPermitAmount,
    airportTaxAmount,
    subtotal,
    roundOff,
    totalAmount,
    roundingMode: params.roundingMode || 'down',
  };

  return {
    periodFrom,
    periodTo,
    contractWorkingDays,
    actualRunDays,
    totalKmUsed,
    fixedKm,
    extraKm,
    extraKmAmount,
    totalExtraMinutes,
    extraHoursDecimal,
    extraHoursAmount,
    monthlyFixedAmount: params.fixedAmount,
    fixedAmount: params.fixedAmount,
    nightBataDays,
    nightBataAmount,
    outstationBataDays,
    outstationBataAmount,
    airportTaxAmount,
    tollPermitAmount,
    extraDaysCount,
    extraDaysAmount,
    subtotal,
    roundOff,
    totalAmount,
    amountInWords,
    explanations,
    snapshotJson,
  };
}
