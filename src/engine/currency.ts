// Pure Currency & Indian Words Formatting - Integer Paise Precision

import { RoundingMode } from './types';

/**
 * Converts Rupees to integer Paise to prevent floating point inaccuracies.
 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Converts integer Paise back to standard Rupees.
 */
export function toRupees(paise: number): number {
  return paise / 100;
}

/**
 * Applies contract rounding mode.
 * - 'down': Floor to nearest whole rupee (historical default for VTL)
 * - 'nearest': Math.round to nearest rupee
 * - 'none': Exact paise
 */
export function applyRounding(
  amountInRupees: number,
  mode: RoundingMode = 'down'
): { rounded: number; roundOff: number } {
  let rounded: number;

  if (mode === 'down') {
    rounded = Math.floor(amountInRupees);
  } else if (mode === 'nearest') {
    rounded = Math.round(amountInRupees);
  } else {
    // Exact paise
    rounded = Math.round(amountInRupees * 100) / 100;
  }

  const roundOff = Math.round((rounded - amountInRupees) * 100) / 100;
  return { rounded, roundOff };
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function twoDigits(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return (TENS[t] + (u > 0 ? ' ' + ONES[u] : '')).trim();
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const hStr = h > 0 ? ONES[h] + ' Hundred' : '';
  const remStr = twoDigits(rem);
  if (hStr && remStr) return `${hStr} and ${remStr}`;
  return hStr || remStr;
}

/**
 * Formats a currency amount into Indian English Words.
 * Grouping: Crores, Lakhs, Thousands, Hundreds, Units.
 * Suffix: "Only".
 * E.g., 68617 -> "Sixty Eight Thousand Six Hundred and Seventeen Only"
 */
export function inrWords(amount: number): string {
  const intAmount = Math.floor(Math.abs(amount));
  if (intAmount === 0) return 'Zero Rupees Only';

  const parts: string[] = [];

  const crores = Math.floor(intAmount / 10000000);
  let rem = intAmount % 10000000;

  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;

  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;

  const hundredsAndUnits = rem;

  if (crores > 0) {
    parts.push(`${twoDigits(crores)} Crore`);
  }
  if (lakhs > 0) {
    parts.push(`${twoDigits(lakhs)} Lakh`);
  }
  if (thousands > 0) {
    parts.push(`${twoDigits(thousands)} Thousand`);
  }
  if (hundredsAndUnits > 0) {
    parts.push(threeDigits(hundredsAndUnits));
  }

  const result = parts.join(' ').replace(/\s+/g, ' ').trim();
  return `${result} Only`;
}
