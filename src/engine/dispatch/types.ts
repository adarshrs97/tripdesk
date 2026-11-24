export type CustomerType = 'individual' | 'agent' | 'corporate' | 'school' | 'long_term';
export type EnquiryStatus = 'new' | 'quoted' | 'converted' | 'lost';
export type VehicleCategory = 'sedan' | 'suv' | 'tempo' | 'luxury';

export interface CustomerEnquiry {
  id: string;
  enquiryDate: string; // YYYY-MM-DD
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerType: CustomerType;
  pickupLocation: string;
  dropLocation: string;
  startDate: string;
  endDate: string;
  vehicleCategory: VehicleCategory;
  estimatedKm: number;
  estimatedDays: number;
  estimatedHours: number;
  status: EnquiryStatus;
  notes?: string;
  quoteId?: string;
  createdAt: string;
}

export type TariffType = 'local_hourly' | 'outstation_daily' | 'airport_transfer' | 'fixed_package';

export interface QuotePricingInput {
  tariffType: TariffType;
  vehicleCategory: VehicleCategory;
  basePackageKm: number;
  basePackageHours: number;
  basePackageAmount: number;
  estimatedKm: number;
  estimatedHours: number;
  estimatedDays: number;
  extraKmRate: number;
  extraHourRate: number;
  driverBataPerDay: number;
  driverNightBataPerNight: number;
  nightStayCount: number;
  tollParkingEstimate: number;
  permitEstimate: number;
  taxRatePercent: number; // e.g. 5, 12, 18 or 0
  isTaxInclusive?: boolean;
}

export interface QuoteCalculationBreakdown {
  baseAmount: number;
  extraKm: number;
  extraKmAmount: number;
  extraHours: number;
  extraHoursAmount: number;
  driverBataAmount: number;
  nightBataAmount: number;
  tollParkingAmount: number;
  permitAmount: number;
  subtotal: number;
  taxRatePercent: number;
  taxAmount: number;
  grandTotal: number;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted_to_booking';

export interface Quote {
  id: string;
  quoteNumber: string; // e.g. Q-2026-001
  enquiryId?: string;
  supplierId: string; // e.g. City Tours or Starciti
  supplierName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerType: CustomerType;
  date: string;
  validUntil: string;
  pickupLocation: string;
  dropLocation: string;
  startDate: string;
  endDate: string;
  tariffType: TariffType;
  vehicleCategory: VehicleCategory;
  pricingInput: QuotePricingInput;
  breakdown: QuoteCalculationBreakdown;
  termsAndConditions: string[];
  status: QuoteStatus;
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'confirmed' | 'dispatched' | 'running' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  bookingNumber: string; // e.g. BK-2026-001
  quoteId?: string;
  supplierId: string;
  supplierName: string;
  customerName: string;
  customerPhone: string;
  pickupDateTime: string; // ISO
  returnDateTime: string; // ISO
  pickupAddress: string;
  destination: string;
  vehicleCategory: VehicleCategory;
  allocatedVehicleId?: string;
  allocatedVehiclePlate?: string;
  allocatedVehicleModel?: string;
  allocatedDriverId?: string;
  allocatedDriverName?: string;
  allocatedDriverPhone?: string;
  advanceAmountReceived: number;
  advancePaymentMode?: 'cash' | 'upi' | 'bank';
  advancePaymentRef?: string;
  agreedEstimatedTotal: number;
  status: BookingStatus;
  specialInstructions?: string;
  overrideReason?: string; // Logged when admin overrides an 'avoid' flag
  invoiceId?: string;
  dutySlipId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DutySlip {
  id: string;
  bookingId: string;
  slipNumber: string; // e.g. DS-2026-001
  dutyDate: string;
  reportingTime: string;
  reportingAddress: string;
  passengerName: string;
  passengerPhone: string;
  vehiclePlate: string;
  vehicleModel: string;
  driverName: string;
  driverPhone: string;
  openingKm: number;
  closingKm?: number;
  totalKmRun?: number;
  openingTime: string;
  closingTime?: string;
  totalHours?: number;
  tollAmount: number;
  parkingAmount: number;
  permitAmount: number;
  driverBata: number;
  customerNotes?: string;
  status: 'dispatched' | 'closed';
}
