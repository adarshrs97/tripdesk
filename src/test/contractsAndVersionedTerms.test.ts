import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyFixedInvoice,
  calculateFormat1Invoice,
  MonthlyFixedContractParams,
  PerTripPackageParams,
  DayLedgerEntry,
} from '../engine';
import { MastersService } from '../services/mastersService';
import { EXACT_SEED_VTL_AUG_2026 } from '../services/ledgerService';

describe('Milestone 10 - Requirement 2: Contracts & Versioned Terms Data Pipeline', () => {
  it('creates VTL customer, contract, and versioned terms from data, reproducing Rs 68,617', async () => {
    // 1. Create Customer
    const vtlCustomer = await MastersService.createCustomer({
      id: 'cust-vtl-pilot-test',
      name: 'M/s Vindhya Telelinks Limited',
      customerType: 'corporate',
      billingAddress: 'CC No. 40/1072A, PRG-59, North Janatha Road, Palarivattom, Cochin',
      city: 'Ernakulam',
      state: 'Kerala',
      pincode: '682025',
      pan: 'AAACV7757J',
      gstin: '32AAACV7757J2Z0',
      defaultInvoiceFormat: 'STARTER_MONTHLY_CONTRACT',
    });
    expect(vtlCustomer.id).toBe('cust-vtl-pilot-test');

    // 2. Create Contract
    const vtlContract = await MastersService.createContract({
      id: 'ctr-vtl-pilot-test',
      customerId: vtlCustomer.id,
      supplierId: 'a0000000-0000-0000-0000-000000000002', // M/S City Tours & Travels
      agreementNo: '202526000005308395',
      agreementDate: '2025-11-01',
      validFrom: '2025-11-01',
      validTo: '2026-09-30',
      contractKind: 'monthly_fixed',
      invoiceFormat: 'STARTER_MONTHLY_CONTRACT',
      pricingModel: 'monthly_fixed',
      pricingParams: {
        fixed_amount: 65000,
        included_km: 3000,
        included_hours: 12,
        extra_km_rate: 18,
        extra_hour_rate: 150,
        night_bata: 200,
        outstation_bata: 200,
        rounding: 'down',
        legacy_decimal_hours_bug: true,
      },
      status: 'active',
    });
    expect(vtlContract.id).toBe('ctr-vtl-pilot-test');

    // 3. Create Versioned Terms (Historical Aug 2026 with decimal hours bug configuration)
    const vtlTerms = await MastersService.createContractTerm({
      id: 'term-vtl-aug-2026',
      contractId: vtlContract.id,
      effectiveFrom: '2025-11-01',
      effectiveTo: '2026-09-30',
      fixedAmount: 65000,
      includedKm: 3000,
      includedHoursPerDay: 12,
      extraHourRate: 150,
      extraKmRate: 18,
      nightBata: 200,
      outstationBata: 200,
      workingDays: 30,
      roundingMode: 'down',
      gstMode: 'disabled',
      legacyDecimalHoursBug: true,
    });
    expect(vtlTerms.id).toBe('term-vtl-aug-2026');

    // 4. Resolve terms from data for August 2026
    const resolvedTerms = await MastersService.getTermsForDate(vtlContract.id, '2026-08-15');
    expect(resolvedTerms).toBeDefined();

    const calcParams: MonthlyFixedContractParams = {
      fixedAmount: resolvedTerms!.fixedAmount,
      includedKm: resolvedTerms!.includedKm,
      includedHoursPerDay: resolvedTerms!.includedHoursPerDay,
      extraKmRate: resolvedTerms!.extraKmRate,
      extraHourRate: resolvedTerms!.extraHourRate,
      nightBataRate: resolvedTerms!.nightBata,
      outstationBataRate: resolvedTerms!.outstationBata,
      contractWorkingDays: resolvedTerms!.workingDays,
      roundingMode: resolvedTerms!.roundingMode,
      legacyDecimalHoursBug: true,
    };

    // 5. Calculate monthly invoice from August trips
    const invoiceResult = calculateMonthlyFixedInvoice(
      '2026-08-01',
      '2026-08-31',
      EXACT_SEED_VTL_AUG_2026,
      calcParams
    );

    // Exact reproduction of ₹68,617 (9h45m decimal 9.45 * 150 = 1417.50)
    // THIS EQUALS THE PAPER INVOICE (Invoice VTL August 2026- Monthly.pdf)
    expect(invoiceResult.subtotal).toBe(68617.50);
    expect(invoiceResult.totalAmount).toBe(68617);
    expect(invoiceResult.roundOff).toBe(-0.50);
    expect(invoiceResult.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Seventeen Only');
  });

  it('calculates Rs 68,662 for VTL August when legacyDecimalHoursBug is OFF (exact pro-rata decimal hours: 9h45m = 9.75h, +Rs 45 difference)', async () => {
    const calcParamsExact: MonthlyFixedContractParams = {
      fixedAmount: 65000,
      includedKm: 3000,
      includedHoursPerDay: 12,
      extraKmRate: 18,
      extraHourRate: 150,
      nightBataRate: 200,
      outstationBataRate: 200,
      contractWorkingDays: 30,
      roundingMode: 'down',
      legacyDecimalHoursBug: false, // Flag OFF
    };

    const invoiceResult = calculateMonthlyFixedInvoice(
      '2026-08-01',
      '2026-08-31',
      EXACT_SEED_VTL_AUG_2026,
      calcParamsExact
    );

    // Exact calculation: 9h 45m = 9.75 hours * 150 = 1462.50
    // Total subtotal: 65,000 + 1,462.50 + 2,200 = 68,662.50 -> rounded down to 68,662
    expect(invoiceResult.subtotal).toBe(68662.50);
    expect(invoiceResult.totalAmount).toBe(68662);
    expect(invoiceResult.roundOff).toBe(-0.50);
    expect(invoiceResult.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Sixty Two Only');

    // Prove difference is exactly Rs 45
    expect(invoiceResult.totalAmount - 68617).toBe(45);
  });

  it('creates School customer, contract, and rate terms from data, reproducing Rs 21,210', async () => {
    // 1. Create School Customer
    const schoolCustomer = await MastersService.createCustomer({
      id: 'cust-school-pilot-test',
      name: 'Global Public School',
      customerType: 'school',
      billingAddress: 'Attakulangara, Trivandrum',
      city: 'Trivandrum',
      state: 'Kerala',
      pincode: '695036',
      defaultInvoiceFormat: 'STARTER_PER_TRIP_PACKAGE',
    });
    expect(schoolCustomer.id).toBe('cust-school-pilot-test');

    // 2. Create School Contract
    const schoolContract = await MastersService.createContract({
      id: 'ctr-school-pilot-test',
      customerId: schoolCustomer.id,
      supplierId: 'a0000000-0000-0000-0000-000000000001', // StarCiti Group
      agreementNo: 'GPS-TRV-2026-08',
      agreementDate: '2026-06-01',
      validFrom: '2026-06-01',
      validTo: '2027-05-31',
      contractKind: 'per_trip_package',
      invoiceFormat: 'STARTER_PER_TRIP_PACKAGE',
      pricingModel: 'per_trip_package',
      pricingParams: {
        base_amount: 2415,
        included_km: 80,
        included_hours: 10,
        extra_km_rate: 15,
        extra_hour_rate: 200,
        rounding: 'down',
      },
      status: 'active',
    });
    expect(schoolContract.id).toBe('ctr-school-pilot-test');

    // 3. Define 8 duty lines from real school invoice photo
    const schoolLines: DayLedgerEntry[] = [
      { date: '01/08/2026', dayStatus: 'RUN', usedKm: 82, durationMinutes: 600, vehicleType: 'Sedan' },
      { date: '03/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 735, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      { date: '03/08/2026', dayStatus: 'RUN', usedKm: 84, durationMinutes: 660, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      { date: '04/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 705, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      { date: '04/08/2026', dayStatus: 'RUN', usedKm: 90, durationMinutes: 615, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 630, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 600, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
      { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 750, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
    ];

    const schoolParams: PerTripPackageParams = {
      baseAmount: schoolContract.pricingParams.base_amount,
      includedHours: schoolContract.pricingParams.included_hours,
      includedKm: schoolContract.pricingParams.included_km,
      extraHourRate: schoolContract.pricingParams.extra_hour_rate,
      extraKmRate: schoolContract.pricingParams.extra_km_rate,
      roundingMode: 'down',
    };

    // 4. Calculate School Invoice
    const result = calculateFormat1Invoice(schoolLines, schoolParams);
    expect(result.subtotal).toBe(21210);
    expect(result.totalAmount).toBe(21210);
    expect(result.amountInWords).toBe('Twenty One Thousand Two Hundred and Ten Only');
  });

  it('proves versioned terms revision does not mutate or drift older issued calculations', async () => {
    const contractId = 'ctr-vtl-pilot-test';

    // Add revised terms version for October 2026 onwards (rates increase to 70k base, 20/km)
    await MastersService.createContractTerm({
      id: 'term-vtl-revision-oct2026',
      contractId,
      effectiveFrom: '2026-10-01',
      effectiveTo: '2027-09-30',
      fixedAmount: 70000,
      includedKm: 3200,
      includedHoursPerDay: 12,
      extraHourRate: 175,
      extraKmRate: 20,
      nightBata: 250,
      outstationBata: 250,
      workingDays: 30,
      roundingMode: 'down',
      gstMode: 'disabled',
    });

    // Query terms for August 2026 (must remain old terms: 65,000)
    const augTerms = await MastersService.getTermsForDate(contractId, '2026-08-15');
    expect(augTerms?.fixedAmount).toBe(65000);
    expect(augTerms?.includedKm).toBe(3000);
    expect(augTerms?.extraKmRate).toBe(18);

    // Query terms for October 2026 (must resolve revised terms: 70,000)
    const octTerms = await MastersService.getTermsForDate(contractId, '2026-10-15');
    expect(octTerms?.fixedAmount).toBe(70000);
    expect(octTerms?.includedKm).toBe(3200);
    expect(octTerms?.extraKmRate).toBe(20);
  });
});
