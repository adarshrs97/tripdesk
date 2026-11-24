import { describe, it, expect } from 'vitest';
import { MastersService } from '../services/mastersService';

describe('Milestone 1: Masters & Versioned Terms Tests', () => {
  it('retrieves seeded customers with correct details', async () => {
    const customers = await MastersService.getCustomers();
    expect(customers.length).toBeGreaterThanOrEqual(2);

    const vtl = customers.find(c => c.name.includes('Vindhya Telelinks'));
    expect(vtl).toBeDefined();
    expect(vtl?.pan).toBe('AAACV7757J');
    expect(vtl?.gstin).toBe('32AAACV7757J2Z0');
    expect(vtl?.defaultInvoiceFormat).toBe('F2');
    expect(vtl?.approvalToken).toBe('token-vtl-approval-2026');

    const gps = customers.find(c => c.name.includes('Global Public School'));
    expect(gps).toBeDefined();
    expect(gps?.defaultInvoiceFormat).toBe('F1');
    expect(gps?.approvalToken).toBe('token-gps-approval-2026');
  });

  it('retrieves seeded vehicles with real data (no invented expiries, exact 7-Seat AC Car model)', async () => {
    const vehicles = await MastersService.getVehicles();
    expect(vehicles.length).toBeGreaterThanOrEqual(4);

    const ertiga = vehicles.find(v => v.regNo === 'KL01CP3284');
    expect(ertiga).toBeDefined();
    expect(ertiga?.displayRegNo).toBe('KL-01-CP-3284');
    expect(ertiga?.makeModel).toBe('7-Seat AC Car'); // Real wording from VTL invoice, NOT invented
    expect(ertiga?.rcExpiry).toBeNull();            // Real data: no invented dates
    expect(ertiga?.kmGapThreshold).toBe(15);
    expect(ertiga?.currentOdometer).toBe(157748);
  });

  it('retrieves seeded drivers with real data (no invented licenses or daily batas)', async () => {
    const drivers = await MastersService.getDrivers();
    expect(drivers.length).toBeGreaterThanOrEqual(4);

    const hemanth = drivers.find(d => d.name === 'Hemanth Kumar');
    expect(hemanth).toBeDefined();
    expect(hemanth?.licenseNo).toBeNull();         // Real data: no invented license
    expect(hemanth?.dailyBataRate).toBeNull();     // Bata is per trip/contract
  });

  it('correctly resolves versioned contract terms: Aug 2025 vs Aug 2026', async () => {
    const contractId = 'b0000000-0000-0000-0000-000000000001'; // VTL contract

    // Test Aug 2025 terms: 2,700 km, 10h, Rs 250 bata
    const terms2025 = await MastersService.getTermsForDate(contractId, '2025-08-15');
    expect(terms2025).toBeDefined();
    expect(terms2025?.includedKm).toBe(2700);
    expect(terms2025?.includedHoursPerDay).toBe(10);
    expect(terms2025?.nightBata).toBe(250);
    expect(terms2025?.outstationBata).toBe(250);

    // Test Aug 2026 terms: 3,000 km, 12h, Rs 200 bata
    const terms2026 = await MastersService.getTermsForDate(contractId, '2026-08-15');
    expect(terms2026).toBeDefined();
    expect(terms2026?.includedKm).toBe(3000);
    expect(terms2026?.includedHoursPerDay).toBe(12);
    expect(terms2026?.nightBata).toBe(200);
    expect(terms2026?.outstationBata).toBe(200);
    expect(terms2026?.roundingMode).toBe('down');
  });

  it('retrieves rate cards: sedan seeded, other vehicle types blank and configurable', async () => {
    const schoolContractId = 'b0000000-0000-0000-0000-000000000002';
    const sedanCard = await MastersService.getRateCard(schoolContractId, 'sedan');
    expect(sedanCard).toBeDefined();
    expect(sedanCard?.baseAmount).toBe(2415);
    expect(sedanCard?.includedHours).toBe(10);
    expect(sedanCard?.includedKm).toBe(80);
    expect(sedanCard?.extraHourRate).toBe(200);
    expect(sedanCard?.extraKmRate).toBe(15);

    // Per decision 5: Ertiga/Innova/Tempo Traveller are blank and configurable
    const ertigaCard = await MastersService.getRateCard(undefined, 'ertiga');
    expect(ertigaCard).toBeUndefined();
  });
});
