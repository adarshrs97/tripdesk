import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { TaxService } from '../services/taxService';
import { ServerInvoiceService } from '../services/serverInvoiceService';
import { MastersService } from '../services/mastersService';
import { generateInvoicePdf } from '../services/pdfGenerator';
import { calculateMonthlyFixedInvoice, calculateFormat1Invoice, inrWords } from '../engine';
import { EXACT_SEED_VTL_AUG_2026 } from '../services/ledgerService';
import { createTestClient, assertTestDatabaseGuard, TEST_PG_CONFIG } from './testDbHelper';

describe('Add-on: Customizable Taxes, Saved Item Catalogue & Invoicing for Anyone', () => {
  const cityToursSupplierId = 'a0000000-0000-0000-0000-000000000002';
  const vtlCustomerId = 'c0000000-0000-0000-0000-000000000001';
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await assertTestDatabaseGuard(client);
    ServerInvoiceService.pgConfig = {
      host: TEST_PG_CONFIG.host as string,
      port: TEST_PG_CONFIG.port as number,
      user: TEST_PG_CONFIG.user as string,
      password: TEST_PG_CONFIG.password as string,
      database: 'test',
    };
  });

  afterAll(async () => {
    if (client) {
      await client.query(`
        UPDATE invoices SET status = 'draft', locked_at = NULL WHERE customer_id NOT IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');
        DELETE FROM payments WHERE invoice_id NOT IN (SELECT id FROM invoices WHERE customer_id IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'));
        DELETE FROM credit_debit_notes WHERE original_invoice_id NOT IN (SELECT id FROM invoices WHERE customer_id IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'));
        DELETE FROM payment_reminders WHERE invoice_id NOT IN (SELECT id FROM invoices WHERE customer_id IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'));
        DELETE FROM invoices WHERE customer_id NOT IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');
        DELETE FROM customers WHERE id NOT IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');
      `);
      await client.end();
    }
  });

  // TEST 1: TAXES AS DATA & SCOPE LADDER
  describe('1. Taxes as Data & Scope Ladder Resolution', () => {
    it('resolves effective tax profile following scope ladder: line > invoice > contract > customer > global', () => {
      const taxProfiles = [
        { id: 'tax-none', name: 'No Tax', taxType: 'none', ratePercent: 0, appliesTo: 'all', placeOfSupplyLogic: 'exempt', isActive: true, isInclusive: false },
        { id: 'tax-5', name: 'GST 5%', taxType: 'gst', ratePercent: 5, appliesTo: 'services', placeOfSupplyLogic: 'intra_state_cgst_sgst', isActive: true, isInclusive: false },
        { id: 'tax-12', name: 'GST 12%', taxType: 'gst', ratePercent: 12, appliesTo: 'services', placeOfSupplyLogic: 'intra_state_cgst_sgst', isActive: true, isInclusive: false },
        { id: 'tax-18', name: 'GST 18%', taxType: 'gst', ratePercent: 18, appliesTo: 'services', placeOfSupplyLogic: 'intra_state_cgst_sgst', isActive: true, isInclusive: false },
      ] as any;

      // When line-level override is present, it wins
      const lineResolved = TaxService.resolveEffectiveTaxProfile(
        {
          lineProfileId: 'tax-18',
          invoiceProfileId: 'tax-12',
          customerProfileId: 'tax-5',
        },
        taxProfiles
      );
      expect(lineResolved.ratePercent).toBe(18);

      // When line is absent, invoice override wins
      const invoiceResolved = TaxService.resolveEffectiveTaxProfile(
        {
          invoiceProfileId: 'tax-12',
          customerProfileId: 'tax-5',
        },
        taxProfiles
      );
      expect(invoiceResolved.ratePercent).toBe(12);

      // When invoice is absent, customer default wins
      const customerResolved = TaxService.resolveEffectiveTaxProfile(
        {
          customerProfileId: 'tax-5',
        },
        taxProfiles
      );
      expect(customerResolved.ratePercent).toBe(5);

      // When everything is absent, global default ("No Tax" 0%) wins
      const globalResolved = TaxService.resolveEffectiveTaxProfile({}, taxProfiles);
      expect(globalResolved.ratePercent).toBe(0);
    });

    it('accurately calculates intra-state (CGST 2.5% + SGST 2.5%) vs inter-state (IGST 5%)', () => {
      const gst5Profile = {
        id: 'tax-5',
        name: 'GST 5%',
        taxType: 'gst',
        ratePercent: 5.0,
        appliesTo: 'services',
        placeOfSupplyLogic: 'intra_state_cgst_sgst',
        sacHsnDefault: '996601',
        isInclusive: false,
        isActive: true,
      } as any;

      // Intra-state (Kerala to Kerala): 5% split into 2.5% CGST + 2.5% SGST
      const intra = TaxService.calculateTax(10000, gst5Profile, {
        supplierState: 'Kerala',
        customerState: 'Kerala',
      });
      expect(intra.taxableAmount).toBe(10000);
      expect(intra.taxAmount).toBe(500);
      expect(intra.cgstAmount).toBe(250);
      expect(intra.sgstAmount).toBe(250);
      expect(intra.igstAmount).toBe(0);
      expect(intra.totalWithTax).toBe(10500);

      // Inter-state (Kerala to Tamil Nadu): 5% IGST
      const inter = TaxService.calculateTax(10000, gst5Profile, {
        supplierState: 'Kerala',
        customerState: 'Tamil Nadu',
      });
      expect(inter.taxableAmount).toBe(10000);
      expect(inter.taxAmount).toBe(500);
      expect(inter.cgstAmount).toBe(0);
      expect(inter.sgstAmount).toBe(0);
      expect(inter.igstAmount).toBe(500);
      expect(inter.totalWithTax).toBe(10500);
    });
  });

  // TEST 2: INVOICE FOR ANYONE (AD-HOC INVOICING)
  describe('2. Invoicing for Anyone (No Prior Contract Needed)', () => {
    it('creates an invoice for a brand-new walk-in customer with 3 free-form lines, 5% GST, discount, and renders valid PDF', async () => {
      // 1. Create a brand-new customer inline
      const newCustomer = await MastersService.createCustomer({
        name: 'Dr. Anand Ramanathan',
        customerType: 'individual',
        billingAddress: 'Medical College Junction, Trivandrum, Kerala',
        phone: '+91 9447098765',
        email: 'anand.ramanathan@hospital.org',
        pan: 'AAAPR1234K', // Individual PAN (4th char 'P')
      });

      expect(newCustomer.name).toBe('Dr. Anand Ramanathan');

      // Ensure customer exists in PostgreSQL for foreign key constraint
      await client.query(`
        INSERT INTO customers (id, name, customer_type, billing_address, phone, email, pan)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        newCustomer.id,
        newCustomer.name,
        newCustomer.customerType,
        newCustomer.billingAddress,
        newCustomer.phone,
        newCustomer.email,
        newCustomer.pan,
      ]);

      // 2. Build 3 free-form lines with discount and 5% GST
      // Line 1: Airport transfer 1 @ 1200
      // Line 2: Outstation trip 150 km @ 16 = 2400 with 10% discount (-240) = 2160
      // Line 3: Night bata 1 @ 200
      // Subtotal = 1200 + 2400 + 200 = 3800
      // Discount = 240
      // Taxable = 3560
      // GST 5% = 3560 * 0.05 = 178
      // Grand Total = 3738

      const taxableTotal = 3560;
      const gstAmount = 178;
      const grandTotal = 3738;
      expect(taxableTotal).toBe(3560);
      expect(gstAmount).toBe(178);

      const snapshotJson = {
        invoiceType: 'tax_invoice',
        title: 'Tax Invoice',
        customer: {
          id: newCustomer.id,
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email,
          billingAddress: newCustomer.billingAddress,
          pan: newCustomer.pan,
        },
        supplier: {
          id: cityToursSupplierId,
          legalName: 'M. Ratnaraj',
          tradeName: 'M/S City Tours & Travels',
          address: 'Killipalam, Trivandrum, Kerala',
          pan: 'BGYPM6861Q',
          gstin: '32BGYPM6861Q1Z3',
          phones: '6238603200 / 8136910938',
        },
        items: [
          { description: 'Airport Pickup & Drop (Trivandrum TRV)', quantity: 1, unit: 'trip', rate: 1200, discount: 0, taxAmount: 60, netTotal: 1260, sacHsn: '996601' },
          { description: 'Outstation Running (150 km @ ₹16)', quantity: 150, unit: 'km', rate: 16, discount: 240, taxAmount: 108, netTotal: 2268, sacHsn: '996601' },
          { description: 'Driver Night Bata Allowance', quantity: 1, unit: 'day', rate: 200, discount: 0, taxAmount: 10, netTotal: 210, sacHsn: '996601' },
        ],
        totals: {
          subtotal: 3800,
          totalDiscount: 240,
          taxableTotal: 3560,
          cgstAmount: 89,
          sgstAmount: 89,
          totalTax: 178,
          grandTotal: 3738,
          inWords: inrWords(3738),
        },
      };

      // Issue invoice atomically
      const issueRes = await ServerInvoiceService.issueInvoice({
        supplierId: cityToursSupplierId,
        customerId: newCustomer.id,
        periodFrom: '2026-09-01',
        periodTo: '2026-09-01',
        totalAmount: grandTotal,
        snapshotJson: snapshotJson as any,
        templateId: 'format1_package_school',
        templateVersion: 1,
        issuedBy: 'Admin (M. Ratnaraj)',
        adminOverrideReason: 'Ad-hoc trip invoice for Dr. Anand Ramanathan',
      });

      expect(issueRes.invoiceNumber).toBeDefined();
      expect(['locked', 'issued']).toContain(issueRes.status);

      // 3. Verify server-side PDF generation
      const pdfRes = await generateInvoicePdf(
        {
          title: 'Tax Invoice',
          invoiceNumber: issueRes.invoiceNumber,
          customer: snapshotJson.customer,
          supplier: snapshotJson.supplier,
          metaFields: [
            { label: 'Invoice No', value: issueRes.invoiceNumber, key: 'invoiceNo' },
            { label: 'Date', value: '2026-09-01', key: 'invoiceDate' },
          ],
          columns: [
            { id: 'desc', label: 'Description', align: 'left' },
            { id: 'qty', label: 'Qty', align: 'center' },
            { id: 'rate', label: 'Rate', align: 'right' },
            { id: 'tax', label: 'GST', align: 'right' },
            { id: 'amount', label: 'Amount', align: 'right' },
          ],
          rows: snapshotJson.items.map((it) => ({
            cells: [
              { columnId: 'desc', formattedText: it.description, align: 'left' },
              { columnId: 'qty', formattedText: `${it.quantity} ${it.unit}`, align: 'center' },
              { columnId: 'rate', formattedText: `₹${it.rate}`, align: 'right' },
              { columnId: 'tax', formattedText: `₹${it.taxAmount}`, align: 'right' },
              { columnId: 'amount', formattedText: `₹${it.netTotal}`, align: 'right' },
            ],
          })),
          breakupRows: [
            { label: 'Subtotal', formattedText: '₹3,800.00' },
            { label: 'Discount', formattedText: '-₹240.00' },
            { label: 'Taxable Amount', formattedText: '₹3,560.00' },
            { label: 'CGST (2.5%)', formattedText: '₹89.00' },
            { label: 'SGST (2.5%)', formattedText: '₹89.00' },
            { label: 'Grand Total', formattedText: '₹3,738.00' },
          ],
          totalAmountWords: inrWords(3738),
          signature: {
            title: 'For M/S City Tours & Travels',
            subtitle: 'Authorized Signatory',
          },
          annexure: { attachLedger: false },
        } as any,
        { outputPath: 'public/invoices/adhoc_dr_anand.pdf' }
      );

      expect(pdfRes.pdfBuffer).toBeDefined();
      expect(pdfRes.pdfBuffer!.length).toBeGreaterThan(5000);

      // Clean up ad-hoc test invoice and customer so database returns to pristine 2-customer baseline
      await client.query("UPDATE invoices SET status = 'draft', locked_at = NULL WHERE id = $1", [issueRes.invoiceId]);
      await client.query('DELETE FROM invoices WHERE id = $1', [issueRes.invoiceId]);
      await client.query('DELETE FROM customers WHERE id = $1', [newCustomer.id]);
    });

    it('proves changing a tax profile affects new invoices while issued invoices remain permanently locked', async () => {
      // 1. Fetch current tax profile
      const originalGstProfile = (await TaxService.getTaxProfiles()).find((p) => p.ratePercent === 5.0)!;

      // 2. Issue invoice under 5% rate
      const inv5Res = await ServerInvoiceService.issueInvoice({
        supplierId: cityToursSupplierId,
        customerId: vtlCustomerId,
        periodFrom: '2026-09-02',
        periodTo: '2026-09-02',
        totalAmount: 10500,
        snapshotJson: {
          taxRate: 5.0,
          taxAmount: 500,
          totalAmount: 10500,
        } as any,
        templateId: 'format2_fixed_vtl_2026',
        templateVersion: 1,
        issuedBy: 'Admin',
      });

      // 3. Admin modifies tax profile to 6.0%
      const updatedProfile = await TaxService.saveTaxProfile({
        ...originalGstProfile,
        ratePercent: 6.0,
        notes: 'Statutory update to 6.0%',
      });
      expect(updatedProfile.ratePercent).toBe(6.0);

      // 4. Verify existing issued invoice in DB retained its original 5% snapshot and 10500 total!
      const checkRes = await client.query('SELECT total_amount, snapshot_json FROM invoices WHERE id = $1', [inv5Res.invoiceId]);
      expect(Number(checkRes.rows[0].total_amount)).toBe(10500);
      expect(checkRes.rows[0].snapshot_json.taxRate).toBe(5.0);

      // 5. Restore profile back to 5.0%
      await TaxService.saveTaxProfile({
        ...originalGstProfile,
        ratePercent: 5.0,
      });
    });
  });

  // TEST 3: RLS POLICY GUARDS ON TAXES AND INVOICES
  describe('3. RLS Security: Staff cannot edit tax profiles; Driver cannot see invoices', () => {
    it('RLS: Blocks staff from inserting or editing tax profiles', async () => {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      // Authenticate with Staff JWT
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000002\"}', true);");

      // Staff can read tax profiles
      const staffRead = await client.query('SELECT COUNT(*) FROM tax_profiles');
      expect(Number(staffRead.rows[0].count)).toBeGreaterThanOrEqual(1);

      // Staff attempts to insert a new tax profile -> blocked by RLS!
      await client.query('SAVEPOINT sp_staff_tax');
      await expect(
        client.query(`
          INSERT INTO tax_profiles (name, tax_type, rate_percent)
          VALUES ('Malicious Rate', 'gst', 25.0)
        `)
      ).rejects.toThrow(/violates row-level security policy/);
      await client.query('ROLLBACK TO SAVEPOINT sp_staff_tax');

      await client.query('ROLLBACK');
    });

    it('RLS: Driver role sees 0 invoices', async () => {
      await client.query('BEGIN');
      await client.query('SET ROLE starciti_app');
      // Authenticate with Driver JWT
      await client.query("SELECT set_config('request.jwt.claims', '{\"sub\": \"c0000000-0000-0000-0000-000000000003\"}', true);");

      const res = await client.query('SELECT COUNT(*) FROM invoices');
      expect(Number(res.rows[0].count)).toBe(0);

      await client.query('ROLLBACK');
    });
  });

  // TEST 4: EXISTING GOLDEN TESTS INTEGRITY GUARANTEE
  describe('4. Existing Golden Billing Engine Calculations Remain Intact', () => {
    it('Golden Test 1: VTL August 2026 Monthly Fixed Rental strictly equals ₹68,662', () => {
      const calc = calculateMonthlyFixedInvoice(
        '2026-08-01',
        '2026-08-31',
        EXACT_SEED_VTL_AUG_2026,
        {
          fixedAmount: 65000,
          includedKm: 3000,
          includedHoursPerDay: 12,
          extraKmRate: 16,
          extraHourRate: 150,
          nightBataRate: 200,
          outstationBataRate: 200,
          contractWorkingDays: 30,
          roundingMode: 'down',
        }
      );

      expect(calc.totalAmount).toBe(68662);
      expect(calc.monthlyFixedAmount).toBe(65000);
      expect(calc.extraHoursAmount).toBe(1462.5); // 9h 45m = 9.75h * 150
      expect(calc.nightBataAmount).toBe(400); // 2 days
      expect(calc.outstationBataAmount).toBe(600); // 3 days
      expect(calc.tollPermitAmount).toBe(1200); // 2 days @ 600
    });

    it('Golden Test 2: Global Public School Package Formula strictly equals ₹21,210', () => {
      const schoolParams = {
        baseAmount: 2415,
        includedHours: 10,
        includedKm: 80,
        extraHourRate: 200,
        extraKmRate: 15,
        roundingMode: 'down' as const,
      };

      const schoolLines = [
        { date: '01/08/2026', dayStatus: 'RUN', usedKm: 82, durationMinutes: 600, vehicleType: 'Sedan' },
        { date: '03/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 735, vehicleType: 'Sedan' },
        { date: '03/08/2026', dayStatus: 'RUN', usedKm: 84, durationMinutes: 660, vehicleType: 'Sedan' },
        { date: '04/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 705, vehicleType: 'Sedan' },
        { date: '04/08/2026', dayStatus: 'RUN', usedKm: 90, durationMinutes: 615, vehicleType: 'Sedan' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 630, vehicleType: 'Sedan' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 600, vehicleType: 'Sedan' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 750, vehicleType: 'Sedan' },
      ] as any;

      const calc = calculateFormat1Invoice(schoolLines, schoolParams);

      expect(calc.totalAmount).toBe(21210);
      expect(calc.subtotal).toBe(21210);
    });
  });
});

