// ==============================================================================
// Milestone 8: Fleet Utilisation Engine
// ==============================================================================

export interface VehicleTripLogInput {
  vehicleId: string;
  registrationNumber: string;
  date: string; // YYYY-MM-DD
  kmRun: number;
}

export interface VehicleMaintenanceInput {
  vehicleId: string;
  date: string; // YYYY-MM-DD
  workshopName?: string;
}

export interface VehicleUtilisationResult {
  vehicleId: string;
  registrationNumber: string;
  vehicleModel?: string;
  monthYear: string;
  calendarDays: number;
  runDays: number;
  idleDays: number;
  maintenanceDays: number;
  totalKmRun: number;
  averageKmPerRunDay: number;
  utilisationRate: number; // percentage (0 to 100)
}

export interface FleetUtilisationSummary {
  monthYear: string;
  calendarDays: number;
  totalVehicles: number;
  totalFleetKm: number;
  averageFleetKmPerVehicle: number;
  fleetAverageUtilisationRate: number;
  vehicles: VehicleUtilisationResult[];
}

/**
 * Calculates days in a given YYYY-MM month
 */
export function getDaysInMonthYear(monthYear: string): number {
  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return new Date(year, month, 0).getDate();
}

/**
 * Computes Fleet and Per-Vehicle Utilisation Metrics
 */
export function calculateFleetUtilisation(
  vehicles: { id: string; registrationNumber: string; model?: string }[],
  trips: VehicleTripLogInput[],
  maintenance: VehicleMaintenanceInput[] = [],
  monthYear: string
): FleetUtilisationSummary {
  const calendarDays = getDaysInMonthYear(monthYear);

  const vehicleResults: VehicleUtilisationResult[] = vehicles.map((v) => {
    // Distinct run dates
    const vehicleTrips = trips.filter((t) => t.vehicleId === v.id || t.registrationNumber === v.registrationNumber);
    const runDates = new Set(vehicleTrips.map((t) => t.date));
    const runDays = runDates.size;

    // Distinct maintenance dates (excluding dates where the car actually ran)
    const vehicleMaint = maintenance.filter((m) => m.vehicleId === v.id);
    const maintDates = new Set(vehicleMaint.map((m) => m.date));
    let maintenanceDays = 0;
    maintDates.forEach((d) => {
      if (!runDates.has(d)) {
        maintenanceDays++;
      }
    });

    const idleDays = Math.max(0, calendarDays - runDays - maintenanceDays);

    const totalKmRun = vehicleTrips.reduce((acc, t) => acc + (t.kmRun || 0), 0);
    const averageKmPerRunDay = runDays > 0 ? Math.round((totalKmRun / runDays) * 10) / 10 : 0;
    const utilisationRate = calendarDays > 0 ? Math.round(((runDays / calendarDays) * 100) * 10) / 10 : 0;

    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      vehicleModel: v.model,
      monthYear,
      calendarDays,
      runDays,
      idleDays,
      maintenanceDays,
      totalKmRun,
      averageKmPerRunDay,
      utilisationRate,
    };
  });

  const totalFleetKm = vehicleResults.reduce((acc, v) => acc + v.totalKmRun, 0);
  const averageFleetKmPerVehicle =
    vehicleResults.length > 0 ? Math.round((totalFleetKm / vehicleResults.length) * 10) / 10 : 0;

  const sumUtilisation = vehicleResults.reduce((acc, v) => acc + v.utilisationRate, 0);
  const fleetAverageUtilisationRate =
    vehicleResults.length > 0 ? Math.round((sumUtilisation / vehicleResults.length) * 10) / 10 : 0;

  return {
    monthYear,
    calendarDays,
    totalVehicles: vehicles.length,
    totalFleetKm,
    averageFleetKmPerVehicle,
    fleetAverageUtilisationRate,
    vehicles: vehicleResults,
  };
}
