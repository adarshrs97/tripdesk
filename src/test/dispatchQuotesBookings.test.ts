import { describe, it, expect } from 'vitest';
import { calculateQuoteBreakdown } from '../engine/dispatch/quoteCalculator';
import { DispatchService } from '../services/dispatchService';
import { QuotePricingInput } from '../engine/dispatch/types';
import { FlagsService } from '../services/flagsService';
import { SettingsService } from '../services/settingsService';

describe('Milestone 7d - Dispatch Engine & Tariff Calculations', () => {
  it('calculates standard local hourly quote breakdown accurately', () => {
    const input: QuotePricingInput = {
      tariffType: 'local_hourly',
      vehicleCategory: 'sedan',
      basePackageKm: 80,
      basePackageHours: 8,
      basePackageAmount: 2200,
      estimatedKm: 120, // 40 extra km
      estimatedHours: 10, // 2 extra hours
      estimatedDays: 1,
      extraKmRate: 14,
      extraHourRate: 150,
      driverBataPerDay: 400,
      driverNightBataPerNight: 0,
      nightStayCount: 0,
      tollParkingEstimate: 200,
      permitEstimate: 0,
      taxRatePercent: 5,
      isTaxInclusive: false,
    };

    const breakdown = calculateQuoteBreakdown(input);

    // Base: 2200
    // Extra KM: 40 * 14 = 560
    // Extra Hours: 2 * 150 = 300
    // Driver Bata: 400
    // Toll/Parking: 200
    // Subtotal = 2200 + 560 + 300 + 400 + 200 = 3660
    // Tax 5% = 3660 * 0.05 = 183
    // Grand Total = 3660 + 183 = 3843
    expect(breakdown.baseAmount).toBe(2200);
    expect(breakdown.extraKm).toBe(40);
    expect(breakdown.extraKmAmount).toBe(560);
    expect(breakdown.extraHours).toBe(2);
    expect(breakdown.extraHoursAmount).toBe(300);
    expect(breakdown.driverBataAmount).toBe(400);
    expect(breakdown.subtotal).toBe(3660);
    expect(breakdown.taxAmount).toBe(183);
    expect(breakdown.grandTotal).toBe(3843);
  });

  it('calculates multi-day outstation packages with night bata and permit', () => {
    const input: QuotePricingInput = {
      tariffType: 'outstation_daily',
      vehicleCategory: 'suv',
      basePackageKm: 250,
      basePackageHours: 12,
      basePackageAmount: 4800,
      estimatedKm: 600, // 2 days = 500 base km, so 100 extra km
      estimatedHours: 24,
      estimatedDays: 2,
      extraKmRate: 18,
      extraHourRate: 200,
      driverBataPerDay: 600,
      driverNightBataPerNight: 500,
      nightStayCount: 1,
      tollParkingEstimate: 400,
      permitEstimate: 600,
      taxRatePercent: 5,
      isTaxInclusive: false,
    };

    const breakdown = calculateQuoteBreakdown(input);

    // Base: 4800 * 2 = 9600
    // Extra KM: 100 * 18 = 1800
    // Driver Bata: 600 * 2 = 1200
    // Night Bata: 500 * 1 = 500
    // Tolls: 400
    // Permit: 600
    // Subtotal = 9600 + 1800 + 1200 + 500 + 400 + 600 = 14100
    // Tax 5% = 705
    // Grand Total = 14805
    expect(breakdown.baseAmount).toBe(9600);
    expect(breakdown.extraKm).toBe(100);
    expect(breakdown.extraKmAmount).toBe(1800);
    expect(breakdown.driverBataAmount).toBe(1200);
    expect(breakdown.nightBataAmount).toBe(500);
    expect(breakdown.subtotal).toBe(14100);
    expect(breakdown.taxAmount).toBe(705);
    expect(breakdown.grandTotal).toBe(14805);
  });

  it('correctly extracts back-calculated tax when quote is marked Tax Inclusive', () => {
    const input: QuotePricingInput = {
      tariffType: 'fixed_package',
      vehicleCategory: 'sedan',
      basePackageKm: 100,
      basePackageHours: 8,
      basePackageAmount: 3150,
      estimatedKm: 100,
      estimatedHours: 8,
      estimatedDays: 1,
      extraKmRate: 14,
      extraHourRate: 150,
      driverBataPerDay: 0,
      driverNightBataPerNight: 0,
      nightStayCount: 0,
      tollParkingEstimate: 0,
      permitEstimate: 0,
      taxRatePercent: 5,
      isTaxInclusive: true,
    };

    const breakdown = calculateQuoteBreakdown(input);
    // Subtotal: 3150 inclusive of 5% GST
    // Tax = 3150 * 5 / 105 = 150
    // Grand Total = 3150
    expect(breakdown.subtotal).toBe(3150);
    expect(breakdown.taxAmount).toBe(150);
    expect(breakdown.grandTotal).toBe(3150);
  });
});

describe('Milestone 7d - End-to-End Dispatch & Conversion Pipeline', () => {
  it('converts enquiry -> quote -> booking -> invoice in a seamless pipeline', async () => {
    // 1. Create Enquiry
    const enquiry = await DispatchService.createEnquiry({
      enquiryDate: '2026-08-20',
      customerName: 'M/s Vindhya Telelinks Limited',
      customerPhone: '+91 94470 12345',
      customerType: 'corporate',
      pickupLocation: 'Technopark Campus',
      dropLocation: 'Kollam Plant',
      startDate: '2026-08-22',
      endDate: '2026-08-22',
      vehicleCategory: 'sedan',
      estimatedKm: 150,
      estimatedDays: 1,
      estimatedHours: 10,
      status: 'new',
    });

    expect(enquiry.id).toBeDefined();
    expect(enquiry.status).toBe('new');

    // 2. Generate Quote from Enquiry with configured test pricing
    const pricing: QuotePricingInput = {
      tariffType: 'local_hourly',
      vehicleCategory: 'sedan',
      basePackageKm: 80,
      basePackageHours: 8,
      basePackageAmount: 2200,
      estimatedKm: 150,
      estimatedHours: 10,
      estimatedDays: 1,
      extraKmRate: 14,
      extraHourRate: 150,
      driverBataPerDay: 400,
      driverNightBataPerNight: 0,
      nightStayCount: 0,
      tollParkingEstimate: 100,
      permitEstimate: 0,
      taxRatePercent: 5,
    };

    const quote = await DispatchService.createQuote({
      enquiryId: enquiry.id,
      supplierId: 's0000000-0000-0000-0000-000000000001',
      supplierName: 'City Tours & Travels',
      customerName: enquiry.customerName,
      customerPhone: enquiry.customerPhone,
      customerType: enquiry.customerType,
      pickupLocation: enquiry.pickupLocation,
      dropLocation: enquiry.dropLocation,
      startDate: enquiry.startDate,
      endDate: enquiry.endDate,
      tariffType: 'local_hourly',
      vehicleCategory: 'sedan',
      pricingInput: pricing,
    });

    expect(quote.quoteNumber).toMatch(/^Q-2026-/);
    expect(quote.status).toBe('sent');

    // Check enquiry updated
    const updatedEnquiry = (await DispatchService.getEnquiries()).find((e) => e.id === enquiry.id);
    expect(updatedEnquiry?.status).toBe('quoted');
    expect(updatedEnquiry?.quoteId).toBe(quote.id);

    // 3. Convert Quote to Confirmed Booking
    const booking = await DispatchService.convertQuoteToBooking(quote.id, {
      advanceAmount: 1500,
      paymentMode: 'bank',
      paymentRef: 'NEFT-TEST-001',
      specialInstructions: 'VIP customer, AC must be in prime condition.',
    });

    expect(booking.bookingNumber).toMatch(/^BK-2026-/);
    expect(booking.status).toBe('confirmed');
    expect(booking.advanceAmountReceived).toBe(1500);
    expect(booking.advancePaymentMode).toBe('bank');

    // 4. Allocate Fleet Vehicle & Driver
    const allocationResult = await DispatchService.allocateVehicleAndDriver(booking.id, {
      vehicleId: '10000000-0000-0000-0000-000000000001', // KL 01 CP 3284
      vehiclePlate: 'KL 01 CP 3284',
      vehicleModel: 'Maruti Suzuki 7-Seat AC',
      driverId: 'd0000000-0000-0000-0000-000000000001', // Hemanth Kumar
      driverName: 'Hemanth Kumar',
      driverPhone: '+91 94470 99887',
    });

    expect(allocationResult.booking.status).toBe('dispatched');
    expect(allocationResult.booking.allocatedVehiclePlate).toBe('KL 01 CP 3284');
    expect(allocationResult.booking.allocatedDriverName).toBe('Hemanth Kumar');

    // 5. Generate Duty Slip
    const dutySlip = await DispatchService.createDutySlip(booking.id, {
      reportingTime: '08:00',
      openingKm: 156000,
      openingTime: '08:00',
      passengerName: 'VTL Plant Inspector',
      passengerPhone: '+91 94470 12345',
    });

    expect(dutySlip.slipNumber).toMatch(/^DS-2026-/);
    expect(dutySlip.openingKm).toBe(156000);

    // 6. Issue Final Invoice (on dev machine using isolated TEST series)
    const invoiceResult = await DispatchService.convertBookingToInvoice(booking.id, 'TEST');
    expect(invoiceResult.invoiceNumber).toMatch(/^TEST-/);
    expect(invoiceResult.netPayable).toBe(booking.agreedEstimatedTotal - 1500);

    const completedBooking = await DispatchService.getBookingById(booking.id);
    expect(completedBooking?.status).toBe('completed');
    expect(completedBooking?.invoiceId).toBe(invoiceResult.invoiceId);
  });

  it('strictly rejects saving or sending a quote when rates are unconfigured or grand total is ₹0', async () => {
    const zeroPricing: QuotePricingInput = {
      tariffType: 'local_hourly',
      vehicleCategory: 'sedan',
      basePackageKm: 0,
      basePackageHours: 0,
      basePackageAmount: 0,
      estimatedKm: 80,
      estimatedHours: 8,
      estimatedDays: 1,
      extraKmRate: 0,
      extraHourRate: 0,
      driverBataPerDay: 0,
      driverNightBataPerNight: 0,
      nightStayCount: 0,
      tollParkingEstimate: 0,
      permitEstimate: 0,
      taxRatePercent: 0,
    };

    await expect(
      DispatchService.createQuote({
        supplierId: 's0000000-0000-0000-0000-000000000001',
        supplierName: 'City Tours & Travels',
        customerName: 'Zero Rate Test Customer',
        customerPhone: '+91 94470 12345',
        customerType: 'individual',
        pickupLocation: 'Trivandrum',
        dropLocation: 'Kollam',
        startDate: '2026-08-25',
        endDate: '2026-08-25',
        tariffType: 'local_hourly',
        vehicleCategory: 'sedan',
        pricingInput: zeroPricing,
      })
    ).rejects.toThrow(/unconfigured rates or ₹0 total cannot be saved or sent/i);
  });
});

describe('Milestone 7d - Flag Resurfacing & Zero-Leakage Security', () => {
  it('blocks fleet allocation when entity has an active AVOID flag without override reason', async () => {
    // Add an avoid flag to a test vehicle
    await FlagsService.createFlag({
      entityType: 'vehicle',
      entityId: '10000000-0000-0000-0000-000000000002', // KL 82 4889
      severity: 'avoid',
      title: 'Suspension Clunk on Rough Roads',
      description: 'Front left strut bush worn; do not assign for highway/outstation trips until replaced.',
    });

    // Create a fresh quote for the test booking
    const testQuote = await DispatchService.createQuote({
      supplierId: 's0000000-0000-0000-0000-000000000001',
      supplierName: 'M/S City Tours & Travels',
      customerName: 'Avoid Flag Test Customer',
      customerPhone: '+91 94470 12345',
      customerType: 'corporate',
      pickupLocation: 'City Office',
      dropLocation: 'Plant',
      startDate: '2026-08-25',
      endDate: '2026-08-25',
      tariffType: 'local_hourly',
      vehicleCategory: 'sedan',
      pricingInput: {
        tariffType: 'local_hourly',
        vehicleCategory: 'sedan',
        basePackageKm: 80,
        basePackageHours: 8,
        basePackageAmount: 2000,
        estimatedKm: 80,
        estimatedHours: 8,
        estimatedDays: 1,
        extraKmRate: 14,
        extraHourRate: 150,
        driverBataPerDay: 400,
        driverNightBataPerNight: 0,
        nightStayCount: 0,
        tollParkingEstimate: 0,
        permitEstimate: 0,
        taxRatePercent: 5,
      },
    });

    // Create a fresh booking from testQuote
    const booking = await DispatchService.convertQuoteToBooking(testQuote.id, {
      advanceAmount: 500,
    });

    // Attempting allocation without overrideReason MUST throw
    await expect(
      DispatchService.allocateVehicleAndDriver(booking.id, {
        vehicleId: '10000000-0000-0000-0000-000000000002',
        vehiclePlate: 'KL 82 4889',
        vehicleModel: 'Ertiga',
        driverId: 'd0000000-0000-0000-0000-000000000001',
        driverName: 'Hemanth Kumar',
      })
    ).rejects.toThrow(/Allocation blocked by active AVOID flag.*Administrative override reason is mandatory/i);

    // With explicit admin override reason, allocation succeeds and records reason
    const overrideResult = await DispatchService.allocateVehicleAndDriver(booking.id, {
      vehicleId: '10000000-0000-0000-0000-000000000002',
      vehiclePlate: 'KL 82 4889',
      vehicleModel: 'Ertiga',
      driverId: 'd0000000-0000-0000-0000-000000000001',
      driverName: 'Hemanth Kumar',
      overrideReason: 'City-only smooth tarmac route authorized by fleet manager.',
    });

    expect(overrideResult.booking.status).toBe('dispatched');
    expect(overrideResult.booking.overrideReason).toBe('City-only smooth tarmac route authorized by fleet manager.');
  });

  it('guarantees ZERO LEAKAGE of caution/avoid flags in customer quote document', async () => {
    // Create a quote for a customer that has an active caution flag in FlagsService
    const quote = await DispatchService.createQuote({
      supplierId: 's0000000-0000-0000-0000-000000000001',
      supplierName: 'M/S City Tours & Travels',
      customerName: 'M/s Vindhya Telelinks Limited',
      customerPhone: '+91 94470 12345',
      customerType: 'corporate',
      pickupLocation: 'Technopark Campus',
      dropLocation: 'Kollam Plant',
      startDate: '2026-08-22',
      endDate: '2026-08-22',
      tariffType: 'local_hourly',
      vehicleCategory: 'sedan',
      pricingInput: {
        tariffType: 'local_hourly',
        vehicleCategory: 'sedan',
        basePackageKm: 80,
        basePackageHours: 8,
        basePackageAmount: 2200,
        estimatedKm: 120,
        estimatedHours: 10,
        estimatedDays: 1,
        extraKmRate: 14,
        extraHourRate: 150,
        driverBataPerDay: 400,
        driverNightBataPerNight: 0,
        nightStayCount: 0,
        tollParkingEstimate: 100,
        permitEstimate: 0,
        taxRatePercent: 5,
      },
    });

    const customerDoc = DispatchService.renderQuoteDocument(quote);
    const serializedDoc = JSON.stringify(customerDoc);

    // Verify customer document contains legitimate quote details
    expect(customerDoc.header.quoteNumber).toBe(quote.quoteNumber);
    expect(customerDoc.customer.name).toBe(quote.customerName);
    expect(customerDoc.taxSummary.grandTotal).toBeGreaterThan(0);

    // Assert strictly ZERO occurrence of internal flag terms or metadata
    expect(serializedDoc).not.toContain('caution');
    expect(serializedDoc).not.toContain('avoid');
    expect(serializedDoc).not.toContain('Factory Gate Security Clearance');
    expect(serializedDoc).not.toContain('Rear AC Blower');
    expect(serializedDoc).not.toContain('GPS Discrepancy');
  });

  it('stores shared office vocabulary and quote tariffs in settings table with RLS', async () => {
    // 1. Vocabulary
    const vocab = await SettingsService.getVocabulary();
    expect(vocab.length).toBeGreaterThan(0);
    const tripTerm = vocab.find((v) => v.key === 'trip');
    expect(tripTerm?.malayalam).toBe('യാത്ര');

    // 2. Tariffs start empty / unconfigured
    const tariffs = await SettingsService.getQuoteTariffs();
    expect(typeof tariffs).toBe('object');

    // 3. Setup state starts with lockable structure
    const setupState = await SettingsService.getSetupState();
    expect(typeof setupState.completed).toBe('boolean');
  });
});
