import {
  FuelLogInput,
  FuelAnomaly,
  VehicleFuelSettings,
  VehicleCategory,
  FuelType,
  FuelUnit,
  CalibrationResult,
} from './types';

/**
 * Maps fuel type to its standardized efficiency unit
 */
export function getFuelUnit(fuelType: FuelType | string): FuelUnit | string {
  switch (fuelType?.toLowerCase()) {
    case 'petrol':
    case 'diesel':
      return 'km/L';
    case 'cng':
      return 'km/kg';
    case 'electric':
      return 'km/kWh';
    default:
      return 'km/unit';
  }
}

/**
 * Maps fuel type to its volume / energy unit
 */
export function getFuelQuantityUnit(fuelType: FuelType | string): string {
  switch (fuelType?.toLowerCase()) {
    case 'petrol':
    case 'diesel':
      return 'L';
    case 'cng':
      return 'kg';
    case 'electric':
      return 'kWh';
    default:
      return 'units';
  }
}

export const DEFAULT_VEHICLE_FUEL_SETTINGS: Record<VehicleCategory, VehicleFuelSettings> = {
  sedan: {
    vehicleType: 'sedan',
    minKml: 16.0,
    maxKml: 22.0,
    targetKml: 18.5,
    fuelType: 'diesel',
    unit: 'km/L',
    receiptPhotoMandatory: true,
    duplicateWindowDays: 3,
    isDefaultAssumption: true,
    note: 'default assumption (editable)',
  },
  suv: {
    vehicleType: 'suv',
    minKml: 12.0,
    maxKml: 17.5,
    targetKml: 14.5,
    fuelType: 'diesel',
    unit: 'km/L',
    receiptPhotoMandatory: true,
    duplicateWindowDays: 3,
    isDefaultAssumption: true,
    note: 'default assumption (editable)',
  },
  hatchback: {
    vehicleType: 'hatchback',
    minKml: 17.0,
    maxKml: 24.0,
    targetKml: 20.0,
    fuelType: 'petrol',
    unit: 'km/L',
    receiptPhotoMandatory: true,
    duplicateWindowDays: 3,
    isDefaultAssumption: true,
    note: 'default assumption (editable)',
  },
  minibus: {
    vehicleType: 'minibus',
    minKml: 9.0,
    maxKml: 14.0,
    targetKml: 11.5,
    fuelType: 'diesel',
    unit: 'km/L',
    receiptPhotoMandatory: true,
    duplicateWindowDays: 3,
    isDefaultAssumption: true,
    note: 'default assumption (editable)',
  },
};

export interface FullTankCalculationResult {
  kmPerLitre: number | null;
  status: 'computed' | 'insufficient_data';
  accumulatedLitres: number;
  distanceKm: number | null;
  fullFillCount: number;
  message?: string;
}

/**
 * Calculates KM per Litre economy using the full-tank method:
 * - Economy is strictly computed between consecutive full fills.
 * - Partial fills accumulate fuel volume into the next full fill.
 * - Single partial fills never raise km/L outliers; return status 'insufficient_data'.
 * - Vehicles with <2 full fills have no outlier checks.
 */
export function calculateFullTankEconomy(
  currentEntry: FuelLogInput,
  vehicleFuelHistory: FuelLogInput[] = []
): FullTankCalculationResult {
  // Sort vehicle history by odometer / date ascending, excluding current entry if already stored
  const pastEntries = vehicleFuelHistory
    .filter(e => e.odometerReading < currentEntry.odometerReading)
    .sort((a, b) => a.odometerReading - b.odometerReading);

  const pastFullFills = pastEntries.filter(e => !!e.isFullTank);
  const totalFullFills = pastFullFills.length + (currentEntry.isFullTank ? 1 : 0);

  // If current entry is NOT a full tank:
  if (!currentEntry.isFullTank) {
    return {
      kmPerLitre: null,
      status: 'insufficient_data',
      accumulatedLitres: currentEntry.fuelLitres,
      distanceKm: null,
      fullFillCount: totalFullFills,
      message: 'Partial fill recorded. Fuel volume accumulated for next full tank calculation.',
    };
  }

  // Current entry is a full tank! Do we have at least one previous full tank?
  if (pastFullFills.length === 0) {
    return {
      kmPerLitre: null,
      status: 'insufficient_data',
      accumulatedLitres: currentEntry.fuelLitres,
      distanceKm: null,
      fullFillCount: 1,
      message: 'Initial full tank recorded. Economy will be computed on subsequent full tank fill.',
    };
  }

  // Get the most recent prior full tank
  const lastFullFill = pastFullFills[pastFullFills.length - 1];

  // Accumulate all fuel litres filled AFTER lastFullFill up to and including currentEntry
  const intermediateEntries = pastEntries.filter(
    e => e.odometerReading > lastFullFill.odometerReading
  );

  const intermediateLitres = intermediateEntries.reduce((sum, e) => sum + e.fuelLitres, 0);
  const totalLitres = Math.round((intermediateLitres + currentEntry.fuelLitres) * 100) / 100;
  const distanceKm = currentEntry.odometerReading - lastFullFill.odometerReading;

  if (distanceKm <= 0 || totalLitres <= 0) {
    return {
      kmPerLitre: null,
      status: 'insufficient_data',
      accumulatedLitres: totalLitres,
      distanceKm,
      fullFillCount: totalFullFills,
      message: 'Insufficient distance traveled between full fills.',
    };
  }

  const kmPerLitre = Math.round((distanceKm / totalLitres) * 100) / 100;

  return {
    kmPerLitre,
    status: 'computed',
    accumulatedLitres: totalLitres,
    distanceKm,
    fullFillCount: totalFullFills,
  };
}

/**
 * Backward compatibility helper for single-entry calculation
 */
export function calculateKmPerLitre(
  currentOdometer: number,
  previousOdometer: number | undefined,
  fuelLitres: number
): number | null {
  if (previousOdometer === undefined || previousOdometer === null) {
    return null;
  }
  const kmTraveled = currentOdometer - previousOdometer;
  if (kmTraveled <= 0 || fuelLitres <= 0) {
    return null;
  }
  return Math.round((kmTraveled / fuelLitres) * 100) / 100;
}

/**
 * Checks for odometer rollback / backward tampering
 */
export function detectOdometerRollback(
  currentOdometer: number,
  previousOdometer: number | undefined
): FuelAnomaly | null {
  if (previousOdometer !== undefined && previousOdometer !== null && currentOdometer < previousOdometer) {
    return {
      code: 'ODOMETER_ROLLBACK',
      severity: 'critical',
      message: `Odometer rollback detected! Current reading (${currentOdometer}) is less than previous (${previousOdometer}). Potential tampering or typo.`,
      expected: `>= ${previousOdometer}`,
      actual: currentOdometer,
    };
  }
  return null;
}

/**
 * Checks for fuel efficiency outlier against configurable vehicle settings.
 * Uses the vehicle's specific efficiency unit (km/L, km/kg, km/kWh).
 * Vehicles with <2 full fills have no outlier checks.
 */
export function detectKmlOutlier(
  fullTankResultOrKml: FullTankCalculationResult | number | null,
  settings: VehicleFuelSettings
): FuelAnomaly | null {
  let kml: number | null = null;
  let detailInfo = '';
  const unit = settings.unit || getFuelUnit(settings.fuelType) || 'km/L';
  const qtyUnit = getFuelQuantityUnit(settings.fuelType);

  if (typeof fullTankResultOrKml === 'object' && fullTankResultOrKml !== null) {
    // If fewer than 2 full fills or insufficient data, NEVER raise an outlier!
    if (
      fullTankResultOrKml.status === 'insufficient_data' ||
      fullTankResultOrKml.fullFillCount < 2 ||
      fullTankResultOrKml.kmPerLitre === null
    ) {
      return null;
    }
    kml = fullTankResultOrKml.kmPerLitre;
    detailInfo = ` (full-tank: ${fullTankResultOrKml.distanceKm} km / ${fullTankResultOrKml.accumulatedLitres} ${qtyUnit})`;
  } else {
    kml = fullTankResultOrKml;
  }

  if (kml === null) return null;

  if (kml < settings.minKml) {
    return {
      code: 'KML_OUTLIER_LOW',
      severity: 'warning',
      message: `Low fuel efficiency: ${kml} ${unit} is below expected minimum of ${settings.minKml} ${unit} for ${settings.vehicleType}. Flagged for fuel check.`,
      expected: `${settings.minKml} - ${settings.maxKml} ${unit}`,
      actual: `${kml} ${unit}${detailInfo}`,
    };
  }

  if (kml > settings.maxKml) {
    return {
      code: 'KML_OUTLIER_HIGH',
      severity: 'warning',
      message: `Unusually high fuel efficiency: ${kml} ${unit} exceeds realistic maximum of ${settings.maxKml} ${unit} for ${settings.vehicleType}. Verify odometer accuracy.`,
      expected: `${settings.minKml} - ${settings.maxKml} ${unit}`,
      actual: `${kml} ${unit}${detailInfo}`,
    };
  }

  return null;
}

/**
 * Computes Hamming distance between two hexadecimal perceptual hashes
 */
export function computeHammingDistance(hexA: string, hexB: string): number {
  if (hexA === hexB) return 0;
  let dist = 0;
  const len = Math.min(hexA.length, hexB.length);
  for (let i = 0; i < len; i++) {
    const valA = parseInt(hexA[i], 16) || 0;
    const valB = parseInt(hexB[i], 16) || 0;
    let xor = valA ^ valB;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  dist += Math.abs(hexA.length - hexB.length) * 4;
  return dist;
}

/**
 * Checks for duplicate receipt entries within a configurable time window:
 * 1. Perceptual image hash match (re-photographed receipt of same physical bill)
 * 2. Exact file cryptographic hash match
 * 3. Receipt number + Station + Amount + Date match
 * 4. Same vehicle + close date + identical quantity and amount
 */
export function detectDuplicateReceipt(
  entry: FuelLogInput,
  existingEntries: FuelLogInput[] = [],
  windowDays: number = 3
): FuelAnomaly | null {
  const entryTime = new Date(entry.entryDate).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  for (const existing of existingEntries) {
    const existingTime = new Date(existing.entryDate).getTime();
    const timeDiff = Math.abs(entryTime - existingTime);

    // 1. Perceptual image hash match (re-photographed receipt)
    if (entry.perceptualHash && existing.perceptualHash) {
      const distance = computeHammingDistance(entry.perceptualHash, existing.perceptualHash);
      if (distance <= 5) {
        return {
          code: 'DUPLICATE_RECEIPT',
          severity: 'critical',
          message: `Duplicate receipt detected via perceptual image matching! Re-photographed bill matches submission for vehicle ${existing.vehicleId} on ${existing.entryDate} (Hamming distance ${distance}).`,
          expected: 'Unique receipt upload',
          actual: `Matching perceptual hash (dist: ${distance})`,
        };
      }
    }

    // 2. Exact receipt file hash match (e.g. same photo SHA-256)
    if (entry.receiptHash && existing.receiptHash && entry.receiptHash === existing.receiptHash) {
      return {
        code: 'DUPLICATE_RECEIPT',
        severity: 'critical',
        message: `Duplicate receipt detected! Identical receipt photo hash already submitted for vehicle ${existing.vehicleId} on ${existing.entryDate}.`,
        expected: 'Unique receipt upload',
        actual: 'Matching receipt hash',
      };
    }

    // 3. Receipt number + Station + Amount match
    if (
      entry.receiptNumber &&
      existing.receiptNumber &&
      entry.receiptNumber.trim().toLowerCase() === existing.receiptNumber.trim().toLowerCase() &&
      entry.fuelStation &&
      existing.fuelStation &&
      entry.fuelStation.trim().toLowerCase() === existing.fuelStation.trim().toLowerCase() &&
      Math.abs((existing.totalAmount || 0) - (entry.totalAmount || entry.fuelLitres * entry.ratePerLitre)) < 1.0
    ) {
      return {
        code: 'DUPLICATE_RECEIPT',
        severity: 'critical',
        message: `Duplicate bill detected! Receipt #${entry.receiptNumber} from ${entry.fuelStation} (₹${entry.totalAmount}) already submitted on ${existing.entryDate}.`,
        expected: 'Unique receipt number',
        actual: `Duplicate receipt #${entry.receiptNumber}`,
      };
    }

    // 4. Same vehicle, same date, identical litres and amount
    if (
      timeDiff <= windowMs &&
      existing.vehicleId === entry.vehicleId &&
      Math.abs(existing.fuelLitres - entry.fuelLitres) < 0.05 &&
      Math.abs((existing.totalAmount || 0) - (entry.totalAmount || entry.fuelLitres * entry.ratePerLitre)) < 1.0
    ) {
      return {
        code: 'DUPLICATE_RECEIPT',
        severity: 'warning',
        message: `Possible duplicate fuel entry: identical quantity (${entry.fuelLitres} L) and amount submitted for this vehicle on ${existing.entryDate}.`,
        expected: 'Distinct fuel entry',
        actual: `Duplicate amount ₹${entry.totalAmount || Math.round(entry.fuelLitres * entry.ratePerLitre)}`,
      };
    }
  }

  return null;
}

/**
 * Validates mandatory receipt photo requirement from settings
 */
export function detectMissingReceipt(
  entry: FuelLogInput,
  settings: VehicleFuelSettings
): FuelAnomaly | null {
  if (settings.receiptPhotoMandatory && (!entry.receiptPhotoUrl || entry.receiptPhotoUrl.trim() === '')) {
    return {
      code: 'MISSING_RECEIPT',
      severity: 'warning',
      message: 'Receipt photo is required for fuel expense reimbursement.',
      expected: 'Receipt photo attached',
      actual: 'No receipt photo',
    };
  }
  return null;
}

/**
 * Full Composite Validation of a Fuel Entry with Full-Tank Method
 */
export function validateFuelEntry(
  entry: FuelLogInput,
  previousOdometer: number | undefined,
  settingsOverride?: Partial<VehicleFuelSettings>,
  existingEntries: FuelLogInput[] = []
): {
  totalAmount: number;
  kmPerLitre: number | null;
  fullTankCalculation: FullTankCalculationResult;
  anomalies: FuelAnomaly[];
  requiresReview: boolean;
} {
  const category = (entry.vehicleType || 'sedan').toLowerCase() as VehicleCategory;
  const settings: VehicleFuelSettings = {
    ...(DEFAULT_VEHICLE_FUEL_SETTINGS[category] || DEFAULT_VEHICLE_FUEL_SETTINGS.sedan),
    ...settingsOverride,
  };

  const totalAmount = Math.round(entry.fuelLitres * entry.ratePerLitre * 100) / 100;

  // Run full-tank calculation
  const fullTankCalculation = calculateFullTankEconomy(entry, existingEntries);
  const kmPerLitre = fullTankCalculation.kmPerLitre;

  const anomalies: FuelAnomaly[] = [];

  const rollback = detectOdometerRollback(entry.odometerReading, previousOdometer);
  if (rollback) anomalies.push(rollback);

  const kmlOutlier = detectKmlOutlier(fullTankCalculation, settings);
  if (kmlOutlier) anomalies.push(kmlOutlier);

  const duplicate = detectDuplicateReceipt(
    { ...entry, totalAmount },
    existingEntries,
    settings.duplicateWindowDays
  );
  if (duplicate) anomalies.push(duplicate);

  const missingReceipt = detectMissingReceipt(entry, settings);
  if (missingReceipt) anomalies.push(missingReceipt);

  return {
    totalAmount,
    kmPerLitre,
    fullTankCalculation,
    anomalies,
    requiresReview: anomalies.length > 0,
  };
}

/**
 * Calibrates min, max, and target fuel thresholds from historical full fills:
 * - Requires at least N full fills (default: 3).
 * - Computes real-world average economy = total distance / total fuel across the full fill window.
 * - Recommends:
 *     target: round(avg, 1)
 *     min: round(avg * 0.85, 1) (-15% tolerance)
 *     max: round(avg * 1.15, 1) (+15% tolerance)
 */
export function calibrateVehicleThresholds(
  vehicleHistory: FuelLogInput[],
  fuelType: FuelType | string = 'diesel',
  nFullFills: number = 3
): CalibrationResult {
  const unit = getFuelUnit(fuelType);
  const fullFills = vehicleHistory
    .filter(e => !!e.isFullTank)
    .sort((a, b) => a.odometerReading - b.odometerReading);

  if (fullFills.length < 2 || fullFills.length < nFullFills) {
    return {
      status: 'insufficient_data',
      nFullFills: fullFills.length,
      averageEconomy: null,
      recommendedMin: null,
      recommendedMax: null,
      recommendedTarget: null,
      unit,
      message: `Need at least ${nFullFills} verified full tank fills to calibrate thresholds. Found ${fullFills.length}.`,
    };
  }

  // Take the most recent nFullFills
  const windowFills = fullFills.slice(-nFullFills);
  const firstFill = windowFills[0];
  const lastFill = windowFills[windowFills.length - 1];

  const totalDistance = lastFill.odometerReading - firstFill.odometerReading;

  // Sum all fuel entries strictly filled after firstFill up to and including lastFill
  const relevantEntries = vehicleHistory.filter(
    e => e.odometerReading > firstFill.odometerReading && e.odometerReading <= lastFill.odometerReading
  );

  const totalFuel = relevantEntries.reduce((sum, e) => sum + e.fuelLitres, 0);

  if (totalDistance <= 0 || totalFuel <= 0) {
    return {
      status: 'insufficient_data',
      nFullFills: fullFills.length,
      averageEconomy: null,
      recommendedMin: null,
      recommendedMax: null,
      recommendedTarget: null,
      unit,
      message: 'Distance or fuel consumed in calibration window is non-positive.',
    };
  }

  const rawAvg = totalDistance / totalFuel;
  const avg = Math.round(rawAvg * 10) / 10;
  const min = Math.round(avg * 0.85 * 10) / 10;
  const max = Math.round(avg * 1.15 * 10) / 10;

  return {
    status: 'calibrated',
    nFullFills: windowFills.length,
    averageEconomy: avg,
    recommendedMin: min,
    recommendedMax: max,
    recommendedTarget: avg,
    unit,
    message: `Calibrated from last ${windowFills.length} full fills: average ${avg} ${unit}. Recommended range [${min} - ${max} ${unit}].`,
  };
}
