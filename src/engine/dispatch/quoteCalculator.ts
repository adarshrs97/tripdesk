import {
  QuotePricingInput,
  QuoteCalculationBreakdown,
  TariffType,
  VehicleCategory,
} from './types';

export interface TariffRateItem {
  baseKm: number;
  baseHours: number;
  baseAmount: number;
  extraKmRate: number;
  extraHourRate: number;
  bataPerDay: number;
  nightBata: number;
}

export const EMPTY_TARIFF_RATE: TariffRateItem = {
  baseKm: 0,
  baseHours: 0,
  baseAmount: 0,
  extraKmRate: 0,
  extraHourRate: 0,
  bataPerDay: 0,
  nightBata: 0,
};

// All tariff models and vehicle prices start EMPTY (no seeded numbers).
// Rates are editable in Settings > Tariffs & Pricing and stored in the database.
export const EMPTY_TARIFF_PRESETS: Record<TariffType, Record<VehicleCategory, TariffRateItem>> = {
  local_hourly: {
    sedan: { ...EMPTY_TARIFF_RATE },
    suv: { ...EMPTY_TARIFF_RATE },
    tempo: { ...EMPTY_TARIFF_RATE },
    luxury: { ...EMPTY_TARIFF_RATE },
  },
  outstation_daily: {
    sedan: { ...EMPTY_TARIFF_RATE },
    suv: { ...EMPTY_TARIFF_RATE },
    tempo: { ...EMPTY_TARIFF_RATE },
    luxury: { ...EMPTY_TARIFF_RATE },
  },
  airport_transfer: {
    sedan: { ...EMPTY_TARIFF_RATE },
    suv: { ...EMPTY_TARIFF_RATE },
    tempo: { ...EMPTY_TARIFF_RATE },
    luxury: { ...EMPTY_TARIFF_RATE },
  },
  fixed_package: {
    sedan: { ...EMPTY_TARIFF_RATE },
    suv: { ...EMPTY_TARIFF_RATE },
    tempo: { ...EMPTY_TARIFF_RATE },
    luxury: { ...EMPTY_TARIFF_RATE },
  },
};

// Aliased for callers; defaults to empty per owner instruction
export const TARIFF_PRESETS = EMPTY_TARIFF_PRESETS;

export function calculateQuoteBreakdown(input: QuotePricingInput): QuoteCalculationBreakdown {
  const days = Math.max(1, input.estimatedDays || 1);
  const totalBaseKm = input.basePackageKm * (input.tariffType === 'outstation_daily' ? days : 1);
  const totalBaseHours = input.basePackageHours * (input.tariffType === 'outstation_daily' ? days : 1);
  const totalBaseAmount = input.basePackageAmount * (input.tariffType === 'outstation_daily' ? days : 1);

  // Extra KM
  const extraKm = Math.max(0, input.estimatedKm - totalBaseKm);
  const extraKmAmount = extraKm * input.extraKmRate;

  // Extra Hours
  const extraHours = Math.max(0, input.estimatedHours - totalBaseHours);
  const extraHoursAmount = extraHours * input.extraHourRate;

  // Driver Bata
  const driverBataAmount = input.driverBataPerDay * days;
  const nightBataAmount = input.driverNightBataPerNight * (input.nightStayCount || 0);

  // Tolls & Permits
  const tollParkingAmount = input.tollParkingEstimate || 0;
  const permitAmount = input.permitEstimate || 0;

  // Subtotal before tax
  const subtotal =
    totalBaseAmount +
    extraKmAmount +
    extraHoursAmount +
    driverBataAmount +
    nightBataAmount +
    tollParkingAmount +
    permitAmount;

  // Tax calculation
  let taxAmount = 0;
  let grandTotal = subtotal;

  if (input.taxRatePercent > 0) {
    if (input.isTaxInclusive) {
      taxAmount = Math.round((subtotal * input.taxRatePercent) / (100 + input.taxRatePercent));
      grandTotal = subtotal; // Already inclusive
    } else {
      taxAmount = Math.round((subtotal * input.taxRatePercent) / 100);
      grandTotal = subtotal + taxAmount;
    }
  }

  return {
    baseAmount: totalBaseAmount,
    extraKm,
    extraKmAmount,
    extraHours,
    extraHoursAmount,
    driverBataAmount,
    nightBataAmount,
    tollParkingAmount,
    permitAmount,
    subtotal,
    taxRatePercent: input.taxRatePercent,
    taxAmount,
    grandTotal,
  };
}
