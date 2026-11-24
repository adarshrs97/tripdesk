export type VehicleCategory = 'sedan' | 'suv' | 'hatchback' | 'minibus';

export type FuelType = 'petrol' | 'diesel' | 'cng' | 'electric' | 'other';

export type FuelUnit = 'km/L' | 'km/kg' | 'km/kWh' | 'km/unit';

export type ExpenseStatus = 'submitted' | 'approved' | 'held_from_settlement' | 'rejected';

export type FuelAnomalyCode =
  | 'ODOMETER_ROLLBACK'
  | 'KML_OUTLIER_LOW'
  | 'KML_OUTLIER_HIGH'
  | 'DUPLICATE_RECEIPT'
  | 'MISSING_RECEIPT';

export interface FuelAnomaly {
  code: FuelAnomalyCode;
  severity: 'warning' | 'critical';
  message: string;
  expected?: string | number;
  actual?: string | number;
}

export interface VehicleFuelSettings {
  id?: string;
  vehicleType: VehicleCategory;
  minKml: number;
  maxKml: number;
  targetKml: number;
  fuelType: FuelType;
  unit?: FuelUnit | string;
  receiptPhotoMandatory: boolean;
  duplicateWindowDays: number;
  isDefaultAssumption?: boolean;
  note?: string;
}

export interface CalibrationResult {
  status: 'calibrated' | 'insufficient_data';
  nFullFills: number;
  averageEconomy: number | null;
  recommendedMin: number | null;
  recommendedMax: number | null;
  recommendedTarget: number | null;
  unit: string;
  message: string;
}

export interface FuelLogInput {
  driverId: string;
  vehicleId: string;
  vehicleType: VehicleCategory;
  entryDate: string; // YYYY-MM-DD
  odometerReading: number;
  previousOdometer?: number;
  fuelLitres: number;
  ratePerLitre: number;
  totalAmount?: number;
  fuelStation?: string;
  isFullTank?: boolean;
  receiptNumber?: string;
  receiptPhotoUrl?: string;
  receiptHash?: string;
  perceptualHash?: string;
  notes?: string;
}

export interface FuelLogRecord extends FuelLogInput {
  id: string;
  totalAmount: number;
  kmPerLitre?: number;
  isFullTank: boolean;
  receiptNumber?: string;
  perceptualHash?: string;
  status: ExpenseStatus;
  heldReason?: string;
  anomalies: FuelAnomaly[];
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OtherExpenseInput {
  driverId: string;
  vehicleId: string;
  tripId?: string;
  expenseDate: string;
  category: 'toll' | 'parking' | 'cleaning' | 'repairs' | 'permit' | 'other';
  amount: number;
  description?: string;
  receiptPhotoUrl?: string;
}

export interface OtherExpenseRecord extends OtherExpenseInput {
  id: string;
  status: ExpenseStatus;
  heldReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}
