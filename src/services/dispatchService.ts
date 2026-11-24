import {
  CustomerEnquiry,
  Quote,
  Booking,
  DutySlip,
  QuotePricingInput,
  TariffType,
  VehicleCategory,
  CustomerType,
} from '../engine/dispatch/types';
import { calculateQuoteBreakdown } from '../engine/dispatch/quoteCalculator';
import { FlagsService } from './flagsService';
import { InternalFlag } from '../engine/flags';

export class DispatchService {
  private static enquiries: CustomerEnquiry[] = [];
  private static quotes: Quote[] = [];
  private static bookings: Booking[] = [];
  private static dutySlips: DutySlip[] = [];

  // --- Enquiries ---
  static async getEnquiries(): Promise<CustomerEnquiry[]> {
    return [...this.enquiries];
  }

  static async createEnquiry(input: Omit<CustomerEnquiry, 'id' | 'createdAt'>): Promise<CustomerEnquiry> {
    const newEnquiry: CustomerEnquiry = {
      ...input,
      id: `enq-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.enquiries.unshift(newEnquiry);
    return newEnquiry;
  }

  static async updateEnquiryStatus(id: string, status: CustomerEnquiry['status']): Promise<void> {
    const item = this.enquiries.find((e) => e.id === id);
    if (item) {
      item.status = status;
    }
  }

  // --- Quotes ---
  static async getQuotes(): Promise<Quote[]> {
    return [...this.quotes];
  }

  static async getQuoteById(id: string): Promise<Quote | undefined> {
    return this.quotes.find((q) => q.id === id);
  }

  static async createQuote(params: {
    enquiryId?: string;
    supplierId: string;
    supplierName: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    customerType: CustomerType;
    pickupLocation: string;
    dropLocation: string;
    startDate: string;
    endDate: string;
    tariffType: TariffType;
    vehicleCategory: VehicleCategory;
    pricingInput: QuotePricingInput;
    terms?: string[];
  }): Promise<Quote> {
    const breakdown = calculateQuoteBreakdown(params.pricingInput);
    if (!breakdown || breakdown.grandTotal <= 0) {
      throw new Error('A quote with unconfigured rates or ₹0 total cannot be saved or sent. Please configure rates in Settings.');
    }
    const quoteCount = this.quotes.length + 1;
    const quoteNumber = `Q-2026-${String(quoteCount).padStart(3, '0')}`;

    const newQuote: Quote = {
      id: `q-${Date.now()}`,
      quoteNumber,
      enquiryId: params.enquiryId,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      customerType: params.customerType,
      date: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      pickupLocation: params.pickupLocation,
      dropLocation: params.dropLocation,
      startDate: params.startDate,
      endDate: params.endDate,
      tariffType: params.tariffType,
      vehicleCategory: params.vehicleCategory,
      pricingInput: params.pricingInput,
      breakdown,
      termsAndConditions: params.terms || [
        'Starting and closing KM / hours calculated from/to office garage.',
        'Toll, state border taxes and parking fees payable as per actual receipts.',
        'Driver night bata applies for duties running between 22:00 and 06:00 hrs.',
        'Taxes extra as applicable.',
      ],
      status: 'sent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.quotes.unshift(newQuote);

    // If linked to an enquiry, update enquiry status
    if (params.enquiryId) {
      await this.updateEnquiryStatus(params.enquiryId, 'quoted');
      const enquiry = this.enquiries.find((e) => e.id === params.enquiryId);
      if (enquiry) enquiry.quoteId = newQuote.id;
    }

    return newQuote;
  }

  // --- Bookings & Allocations ---
  static async getBookings(): Promise<Booking[]> {
    return [...this.bookings];
  }

  static async getBookingById(id: string): Promise<Booking | undefined> {
    return this.bookings.find((b) => b.id === id);
  }

  /**
   * Converts a quote to a confirmed booking.
   * Checks for customer internal notes/caution flags.
   */
  static async convertQuoteToBooking(
    quoteId: string,
    advanceDetails: {
      advanceAmount: number;
      paymentMode?: 'cash' | 'upi' | 'bank';
      paymentRef?: string;
      specialInstructions?: string;
    }
  ): Promise<Booking> {
    const quote = await this.getQuoteById(quoteId);
    if (!quote) throw new Error(`Quote not found with ID ${quoteId}`);

    const bookingCount = this.bookings.length + 1;
    const bookingNumber = `BK-2026-${String(bookingCount).padStart(3, '0')}`;

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      bookingNumber,
      quoteId: quote.id,
      supplierId: quote.supplierId,
      supplierName: quote.supplierName,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      pickupDateTime: `${quote.startDate}T08:00:00`,
      returnDateTime: `${quote.endDate}T20:00:00`,
      pickupAddress: quote.pickupLocation,
      destination: quote.dropLocation,
      vehicleCategory: quote.vehicleCategory,
      advanceAmountReceived: advanceDetails.advanceAmount,
      advancePaymentMode: advanceDetails.paymentMode,
      advancePaymentRef: advanceDetails.paymentRef,
      agreedEstimatedTotal: quote.breakdown.grandTotal,
      status: 'confirmed',
      specialInstructions: advanceDetails.specialInstructions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    quote.status = 'converted_to_booking';
    quote.bookingId = newBooking.id;

    if (quote.enquiryId) {
      await this.updateEnquiryStatus(quote.enquiryId, 'converted');
    }

    this.bookings.unshift(newBooking);
    return newBooking;
  }

  /**
   * Allocates vehicle and driver to a booking with strict internal flag checks.
   * If any entity has an active 'avoid' flag, raises an error unless an administrative override reason is provided.
   */
  static async allocateVehicleAndDriver(
    bookingId: string,
    allocation: {
      vehicleId: string;
      vehiclePlate: string;
      vehicleModel: string;
      driverId: string;
      driverName: string;
      driverPhone?: string;
      overrideReason?: string;
    }
  ): Promise<{ booking: Booking; flagsResurfaced: InternalFlag[] }> {
    const booking = await this.getBookingById(bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);

    // Resurface flags for vehicle and driver
    const vehicleFlags = await FlagsService.getFlagsForEntity('vehicle', allocation.vehicleId);
    const driverFlags = await FlagsService.getFlagsForEntity('driver', allocation.driverId);
    const allFlags = [...vehicleFlags, ...driverFlags].filter((f) => f.isActive);

    const avoidFlags = allFlags.filter((f) => f.severity === 'avoid');
    if (avoidFlags.length > 0 && (!allocation.overrideReason || allocation.overrideReason.trim().length === 0)) {
      const titles = avoidFlags.map((f) => `"${f.title}" (${f.entityType})`).join(', ');
      throw new Error(
        `Allocation blocked by active AVOID flag: ${titles}. An administrative override reason is mandatory to proceed.`
      );
    }

    booking.allocatedVehicleId = allocation.vehicleId;
    booking.allocatedVehiclePlate = allocation.vehiclePlate;
    booking.allocatedVehicleModel = allocation.vehicleModel;
    booking.allocatedDriverId = allocation.driverId;
    booking.allocatedDriverName = allocation.driverName;
    booking.allocatedDriverPhone = allocation.driverPhone;
    booking.overrideReason = allocation.overrideReason;
    booking.status = 'dispatched';
    booking.updatedAt = new Date().toISOString();

    return { booking, flagsResurfaced: allFlags };
  }

  // --- Duty Slips ---
  static async getDutySlips(): Promise<DutySlip[]> {
    return [...this.dutySlips];
  }

  static async createDutySlip(
    bookingId: string,
    details: {
      reportingTime: string;
      openingKm: number;
      openingTime: string;
      passengerName: string;
      passengerPhone: string;
    }
  ): Promise<DutySlip> {
    const booking = await this.getBookingById(bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);

    const slipCount = this.dutySlips.length + 1;
    const slipNumber = `DS-2026-${String(slipCount).padStart(3, '0')}`;

    const newDutySlip: DutySlip = {
      id: `ds-${Date.now()}`,
      bookingId: booking.id,
      slipNumber,
      dutyDate: booking.pickupDateTime.slice(0, 10),
      reportingTime: details.reportingTime,
      reportingAddress: booking.pickupAddress,
      passengerName: details.passengerName,
      passengerPhone: details.passengerPhone,
      vehiclePlate: booking.allocatedVehiclePlate || 'KL 01 CP 3284',
      vehicleModel: booking.allocatedVehicleModel || 'Maruti Suzuki',
      driverName: booking.allocatedDriverName || 'Assigned Driver',
      driverPhone: booking.allocatedDriverPhone || '',
      openingKm: details.openingKm,
      openingTime: details.openingTime,
      tollAmount: 0,
      parkingAmount: 0,
      permitAmount: 0,
      driverBata: 400,
      status: 'dispatched',
    };

    booking.dutySlipId = newDutySlip.id;
    this.dutySlips.unshift(newDutySlip);
    return newDutySlip;
  }

  // --- Invoicing Conversion ---
  /**
   * Converts a completed or dispatched booking directly into an issued invoice.
   * On dev machine, this safely uses the 'TEST-' series prefix.
   */
  static async convertBookingToInvoice(
    bookingId: string,
    seriesPrefix = 'TEST'
  ): Promise<{ invoiceId: string; invoiceNumber: string; netPayable: number }> {
    const booking = await this.getBookingById(bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);

    const invoiceNumber = `${seriesPrefix}-${Date.now().toString().slice(-4)}`;
    const invoiceId = `inv-bk-${Date.now()}`;
    const netPayable = Math.max(0, booking.agreedEstimatedTotal - booking.advanceAmountReceived);

    booking.invoiceId = invoiceId;
    booking.status = 'completed';
    booking.updatedAt = new Date().toISOString();

    return {
      invoiceId,
      invoiceNumber,
      netPayable,
    };
  }

  // --- Zero-Leakage Document Rendering ---
  /**
   * Renders the customer-facing Quote Document layout.
   * GUARANTEE: Never includes internal caution or avoid flags, staff notes, or internal metadata.
   */
  static renderQuoteDocument(quote: Quote): {
    header: { supplierName: string; quoteNumber: string; date: string; validUntil: string };
    customer: { name: string; phone: string; email?: string };
    trip: {
      pickupLocation: string;
      dropLocation: string;
      startDate: string;
      endDate: string;
      category: string;
    };
    lineItems: Array<{ description: string; amount: number }>;
    taxSummary: { subtotal: number; taxRate: number; taxAmount: number; grandTotal: number };
    terms: string[];
  } {
    const b = quote.breakdown;
    const lineItems: Array<{ description: string; amount: number }> = [
      {
        description: `Base Package (${quote.pricingInput.basePackageKm} KM / ${quote.pricingInput.basePackageHours} Hrs)`,
        amount: b.baseAmount,
      },
    ];

    if (b.extraKmAmount > 0) {
      lineItems.push({
        description: `Estimated Extra KM (${b.extraKm} km @ ₹${quote.pricingInput.extraKmRate}/km)`,
        amount: b.extraKmAmount,
      });
    }

    if (b.extraHoursAmount > 0) {
      lineItems.push({
        description: `Estimated Extra Hours (${b.extraHours} hrs @ ₹${quote.pricingInput.extraHourRate}/hr)`,
        amount: b.extraHoursAmount,
      });
    }

    if (b.driverBataAmount > 0) {
      lineItems.push({
        description: `Driver Bata Allowance (${quote.pricingInput.estimatedDays} day(s) @ ₹${quote.pricingInput.driverBataPerDay}/day)`,
        amount: b.driverBataAmount,
      });
    }

    if (b.nightBataAmount > 0) {
      lineItems.push({
        description: `Driver Night Stay Allowance (${quote.pricingInput.nightStayCount} night(s) @ ₹${quote.pricingInput.driverNightBataPerNight}/night)`,
        amount: b.nightBataAmount,
      });
    }

    if (b.tollParkingAmount > 0) {
      lineItems.push({
        description: `Estimated Toll & Parking (Actuals applicable)`,
        amount: b.tollParkingAmount,
      });
    }

    if (b.permitAmount > 0) {
      lineItems.push({
        description: `Inter-State Tourist Permit Estimate`,
        amount: b.permitAmount,
      });
    }

    return {
      header: {
        supplierName: quote.supplierName,
        quoteNumber: quote.quoteNumber,
        date: quote.date,
        validUntil: quote.validUntil,
      },
      customer: {
        name: quote.customerName,
        phone: quote.customerPhone,
        email: quote.customerEmail,
      },
      trip: {
        pickupLocation: quote.pickupLocation,
        dropLocation: quote.dropLocation,
        startDate: quote.startDate,
        endDate: quote.endDate,
        category: quote.vehicleCategory.toUpperCase(),
      },
      lineItems,
      taxSummary: {
        subtotal: b.subtotal,
        taxRate: b.taxRatePercent,
        taxAmount: b.taxAmount,
        grandTotal: b.grandTotal,
      },
      terms: quote.termsAndConditions,
    };
  }
}
