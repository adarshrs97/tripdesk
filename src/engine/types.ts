// Pure Billing Engine Types - Zero UI / DB imports

export type RoundingMode = 'down' | 'nearest' | 'none';

export interface DayLedgerEntry {
  date: string;                   // YYYY-MM-DD
  dayStatus: 'RUN' | 'SUNDAY' | 'HOLIDAY' | 'NO_RUN' | 'LEAVE' | 'BREAKDOWN' | 'SUBSTITUTE';
  startKm?: number | null;
  closeKm?: number | null;
  usedKm?: number | null;
  startTime?: string | null;      // '05:00', '08:30', or '9.am'
  closeTime?: string | null;      // '18:00', '22:00', or '10.pm night'
  durationMinutes?: number | null;
  endsNextDay?: boolean;
  nightBata?: boolean;            // Office toggle
  outstationBata?: boolean;       // Office toggle
  airportTax?: number;            // In rupees
  toll?: number;                  // In rupees
  permit?: number;                // In rupees
  parking?: number;               // In rupees
  otherCharges?: number;          // In rupees
  vehicleSlot?: string | null;    // 'Vehicle 1', 'Vehicle 2'
  vehicleType?: string | null;    // 'sedan', 'ertiga', etc.
  vehiclePlate?: string | null;   // e.g. 'KL01 CP 3284'
  driverId?: string | null;
  driverName?: string | null;
  remarks?: string | null;
  extra?: Record<string, any>;    // Custom ledger fields
}

export interface MonthlyFixedContractParams {
  fixedAmount: number;            // e.g. 65000
  includedKm: number;             // e.g. 3000
  includedHoursPerDay: number;    // e.g. 12
  extraKmRate: number;            // e.g. 18
  extraHourRate: number;          // e.g. 150
  nightBataRate: number;          // e.g. 200
  outstationBataRate: number;     // e.g. 200
  contractWorkingDays?: number;   // e.g. 30
  extraDayRate?: number;          // e.g. 0
  roundingMode?: RoundingMode;    // default 'down'
  extraHourBlockMinutes?: number; // e.g. 30 for 30-min block rounding
  extraHourRoundingDirection?: 'ceil' | 'nearest' | 'floor';
  legacyDecimalHoursBug?: boolean;// true reproduces historic 9.45 decimal bug (₹68,617.50)
}

export interface PerTripPackageParams {
  baseAmount: number;             // e.g. 2415
  includedHours: number;          // e.g. 10
  includedKm: number;             // e.g. 80
  extraHourRate: number;          // e.g. 200
  extraKmRate: number;            // e.g. 15
  minCharge?: number;
  roundingMode?: RoundingMode;
}

export interface LineExplanation {
  field: string;
  label: string;
  calculation: string;
  rate?: number;
  quantity?: number;
  unit?: string;
  amount: number;                 // In rupees
}

export interface Format1RowResult {
  date: string;
  vehicleType: string;
  totalMinutes: number;
  durationMinutes?: number;
  durationFormatted?: string;
  totalKm: number;
  usedKm?: number;
  baseAmount: number;
  additionalMinutes: number;
  extraMinutes?: number;
  extraHoursFormatted?: string;
  additionalKm: number;
  extraKm?: number;
  additionalHoursAmount: number;
  additionalKmAmount: number;
  lineTotal: number;
  explanations: LineExplanation[];
}

export interface Format1InvoiceResult {
  rows: Format1RowResult[];
  subtotal: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
  explanations: LineExplanation[];
}

export interface Format2InvoiceResult {
  periodFrom: string;
  periodTo: string;
  contractWorkingDays: number;    // e.g. 30
  actualRunDays: number;          // e.g. 25
  totalKmUsed: number;            // e.g. 1884
  fixedKm: number;                // e.g. 3000
  extraKm: number;                // e.g. 0
  extraKmAmount: number;          // e.g. 0
  totalExtraMinutes: number;      // e.g. 585 (9h 45m)
  extraHoursDecimal: number;      // e.g. 9.75
  extraHoursAmount: number;       // e.g. 1462.50 (or 1417.50 if legacy)
  monthlyFixedAmount: number;     // e.g. 65000
  fixedAmount?: number;           // Alias for monthlyFixedAmount
  nightBataDays: number;          // e.g. 2
  nightBataAmount: number;        // e.g. 400
  outstationBataDays: number;     // e.g. 3
  outstationBataAmount: number;   // e.g. 600
  airportTaxAmount: number;       // e.g. 0
  tollPermitAmount: number;       // e.g. 1200
  extraDaysCount: number;         // e.g. 0
  extraDaysAmount: number;        // e.g. 0
  subtotal: number;               // Unrounded total
  roundOff: number;               // e.g. -0.50
  totalAmount: number;            // e.g. 68617 or 68662
  amountInWords: string;
  explanations: LineExplanation[];
  snapshotJson: Record<string, any>;
}
