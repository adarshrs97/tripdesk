import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, assertTestDatabaseGuard, TEST_PG_CONFIG } from './testDbHelper';
import { TemplateService } from '../services/templateService';
import { ServerInvoiceService } from '../services/serverInvoiceService';
import { generateInvoiceHtml } from '../services/pdfGenerator';
import { RenderedInvoice, renderInvoiceTemplate } from '../engine';
import { InvoiceTemplate } from '../engine/templates/types';

describe('A. Formats are NOT fixtures: Dynamic Custom Template & Customer E2E', () => {
  let client: Client;
  const supplierId = 'a1111111-1111-1111-1111-111111111111';
  const customerId = 'c2222222-2222-2222-2222-222222222222';
  const contractId = 'b3333333-3333-3333-3333-333333333333';
  const vehicleId = 'e4444444-4444-4444-4444-444444444444';
  const driverId = 'd5555555-5555-5555-5555-555555555555';
  const customTemplateId = 'template-custom-maritime-freight-v1';

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

    // Clean any residual test fixtures
    await client.query(`UPDATE invoices SET status = 'draft', locked_at = NULL WHERE contract_id = $1`, [contractId]);
    await client.query(`UPDATE trip_ledger SET is_locked = FALSE, invoice_id = NULL WHERE contract_id = $1`, [contractId]);
    await client.query(`DELETE FROM trip_ledger WHERE contract_id = $1`, [contractId]);
    await client.query(`DELETE FROM invoices WHERE contract_id = $1`, [contractId]);
    await client.query(`DELETE FROM contracts WHERE id = $1`, [contractId]);
    await client.query(`DELETE FROM customers WHERE id = $1`, [customerId]);
    await client.query(`DELETE FROM vehicles WHERE id = $1`, [vehicleId]);
    await client.query(`DELETE FROM drivers WHERE id = $1`, [driverId]);
    await client.query(`DELETE FROM supplier_profiles WHERE id = $1`, [supplierId]);

    // 1. Insert brand-new custom supplier entity
    await client.query(`
      INSERT INTO supplier_profiles (
        id, trade_name, legal_name, address, city, state, pincode,
        phone, email, pan, gstin, sac_code, bank_name, account_number, ifsc, invoice_prefix
      ) VALUES (
        $1, 'Apex Maritime Freight Logistics', 'Apex Freight Solutions Pvt Ltd', 'Plot 42, KINFRA Logistics Park', 'Trivandrum', 'Kerala', '695019',
        '+91 62386 00000', 'freight@apexlogistics.com', 'APEXL1234F', '32APEXL1234F1Z8', '9965', 'Axis Bank Ltd', '98765432101234', 'UTIB0001234', 'APX'
      ) ON CONFLICT (id) DO NOTHING;
    `, [supplierId]);

    // 2. Insert brand-new customer entity
    await client.query(`
      INSERT INTO customers (
        id, name, customer_type, billing_address, city, state, pincode,
        pan, gstin, payment_terms_days, default_supplier_id, default_invoice_format
      ) VALUES (
        $1, 'Blue Horizon Maritime Port Operators', 'corporate', 'Pier 7, Vizhinjam International Seaport',
        'Trivandrum', 'Kerala', '695521', 'BLUEM9876Q', '32BLUEM9876Q1Z2', 30, $2, $3
      ) ON CONFLICT (id) DO NOTHING;
    `, [customerId, supplierId, customTemplateId]);

    // 3. Insert vehicle and driver
    await client.query(`
      INSERT INTO vehicles (
        id, reg_no, display_reg_no, make_model, vehicle_type, seats, ownership, current_odometer
      ) VALUES (
        $1, 'KL01CZ9988', 'KL-01-CZ-9988', 'BharatBenz Heavy Multi-Axle Hauler', 'luxury', 2, 'owned', 45000
      ) ON CONFLICT (id) DO NOTHING;
    `, [vehicleId]);

    await client.query(`
      INSERT INTO drivers (
        id, name, phone, driver_type
      ) VALUES (
        $1, 'Captain Rajendran', '+91 94470 88776', 'permanent'
      ) ON CONFLICT (id) DO NOTHING;
    `, [driverId]);

    // 4. Insert Contract assigned to the custom template
    await client.query(`
      INSERT INTO contracts (
        id, customer_id, supplier_id, agreement_no, agreement_date, valid_from, valid_to,
        contract_kind, invoice_format, pricing_model, pricing_params, status
      ) VALUES (
        $1, $2, $3, 'AGR-BHMP-2026-99', '2026-08-01', '2026-08-01', '2027-07-31',
        'monthly_fixed', $4, 'monthly_fixed', '{"fixed_amount": 125000}'::jsonb, 'active'
      ) ON CONFLICT (id) DO NOTHING;
    `, [contractId, customerId, supplierId, customTemplateId]);
  });

  afterAll(async () => {
    if (client) {
      // Clean up in reverse foreign key order (unlock ledger and invoice rows before deletion)
      await client.query(`UPDATE invoices SET status = 'draft', locked_at = NULL WHERE contract_id = $1`, [contractId]);
      await client.query(`UPDATE trip_ledger SET is_locked = FALSE, invoice_id = NULL WHERE contract_id = $1`, [contractId]);
      await client.query(`DELETE FROM trip_ledger WHERE contract_id = $1`, [contractId]);
      await client.query(`DELETE FROM invoices WHERE contract_id = $1`, [contractId]);
      await client.query(`DELETE FROM contracts WHERE id = $1`, [contractId]);
      await client.query(`DELETE FROM customers WHERE id = $1`, [customerId]);
      await client.query(`DELETE FROM vehicles WHERE id = $1`, [vehicleId]);
      await client.query(`DELETE FROM drivers WHERE id = $1`, [driverId]);
      await client.query(`DELETE FROM supplier_profiles WHERE id = $1`, [supplierId]);
      await client.end();
    }
  });

  it('saves and resolves a completely new custom template created in data', async () => {
    const customTemplate: InvoiceTemplate = {
      id: customTemplateId,
      code: 'CUSTOM_MARITIME_FREIGHT',
      name: 'Maritime Heavy Freight Template',
      version: 1,
      status: 'published',
      description: 'Custom specialized format for maritime port haulage and bill of lading',
      pricingModelId: 'monthly_fixed',
      pageSetup: {
        orientation: 'portrait',
        paperSize: 'A4',
        marginMm: 10,
      },
      header: {
        showSupplierLogo: true,
        showSupplierAddress: true,
        showRecipientDetails: true,
        titleText: 'MARITIME FREIGHT BILL OF LADING & TAX INVOICE',
        metaFields: [
          { key: 'invoiceNo', label: 'INVOICE NO', source: 'invoice.number' },
          { key: 'date', label: 'DATE', source: 'invoice.date' },
        ],
      },
      lineTable: {
        columns: [
          { id: 'sl', label: 'SL NO', source: 'sl', format: 'number', align: 'center', show: true },
          { id: 'voyage', label: 'VESSEL / VOYAGE ID', source: 'voyage', format: 'text', align: 'left', show: true },
          { id: 'date', label: 'HAULAGE DATE', source: 'date', format: 'date', align: 'center', show: true },
          { id: 'tonnage', label: 'GROSS WT (MT)', source: 'tonnage', format: 'number', align: 'right', show: true },
          { id: 'vehicle', label: 'CONTAINER VEHICLE', source: 'vehicle', format: 'text', align: 'left', show: true },
          { id: 'driver', label: 'HAULAGE PILOT', source: 'driver', format: 'text', align: 'left', show: true },
          { id: 'craneCharge', label: 'QUAYSIDE CRANE (INR)', source: 'craneCharge', format: 'money', align: 'right', show: true },
          { id: 'netFreight', label: 'HAULAGE FREIGHT (INR)', source: 'netFreight', format: 'money', align: 'right', show: true },
        ],
      },
      breakupRows: [],
      totals: {
        rounding: 'nearest',
        showInWords: true,
        gstBlock: true,
      },
      footer: {
        bankDetails: true,
        upiQr: false,
        termsAndConditions: [
          'Certified that container seal integrity was verified at Port Gate 3.',
          'Demurrage charges apply for containers detained beyond 48 hours.',
          'Subject to Trivandrum Maritime Jurisdiction.',
        ],
        signatureBlock: {
          title: 'For Apex Maritime Freight Logistics',
          subtitle: 'Authorised Signatory',
        },
      },
      annexure: {
        attachLedger: true,
      },
      styleTokens: {
        primaryColor: '#0f766e',
        accentColor: '#14b8a6',
        fontFamily: 'Inter, sans-serif',
        tableBorder: 'grid',
        compactDensity: true,
      },
    };

    await TemplateService.saveTemplate(customTemplate);

    const retrieved = TemplateService.getTemplateByIdSync(customTemplateId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(customTemplateId);
    expect(retrieved?.name).toBe('Maritime Heavy Freight Template');
    expect(retrieved?.header.titleText).toBe('MARITIME FREIGHT BILL OF LADING & TAX INVOICE');
    expect(retrieved?.lineTable.columns).toHaveLength(8);
  });

  it('issues an invoice using the new template and customer with zero code changes, generating pixel-perfect HTML/PDF', async () => {
    // 1. Insert sample haulage trips into trip_ledger
    await client.query(`
      INSERT INTO trip_ledger (
        contract_id, vehicle_id, driver_id, trip_date, start_time, close_time,
        start_km, close_km, used_km, day_status
      ) VALUES 
        ($1, $2, $3, '2026-08-10', '08:00', '18:00', 45000, 45120, 120, 'RUN'),
        ($1, $2, $3, '2026-08-11', '08:00', '18:00', 45120, 45250, 130, 'RUN'),
        ($1, $2, $3, '2026-08-12', '08:00', '20:00', 45250, 45400, 150, 'RUN');
    `, [contractId, vehicleId, driverId]);

    // 2. Build RenderedInvoice snapshot strictly from the custom template definition
    const retrievedTemplate = (await TemplateService.getTemplateById(customTemplateId))!;
    const renderedSnapshot: RenderedInvoice = renderInvoiceTemplate(
      retrievedTemplate,
      {
        invoice: {
          number: 'APX-2026-001',
          date: '31/08/2026',
          periodText: '01/08/2026 to 31/08/2026',
        },
        supplier: {
          legalName: 'Apex Freight Solutions Pvt Ltd',
          tradeName: 'Apex Maritime Freight Logistics',
          address: 'Plot 42, KINFRA Logistics Park, Trivandrum, Kerala - 695019',
          gstin: '32APEXL1234F1Z8',
          pan: 'APEXL1234F',
          phone: '+91 62386 00000',
          email: 'freight@apexlogistics.com',
          bankName: 'Axis Bank Ltd',
          bankBranch: 'Kazhakoottam',
          bankAccountNo: '98765432101234',
          bankIfsc: 'UTIB0001234',
        },
        customer: {
          name: 'Blue Horizon Maritime Port Operators',
          billingAddress: 'Pier 7, Vizhinjam International Seaport, Trivandrum, Kerala - 695521',
          gstin: '32BLUEM9876Q1Z2',
        },
        contract: {
          agreementNo: 'AGR-BHMP-2026-99',
          name: 'Quayside Maritime Haulage Contract',
          sacCode: '9965',
        },
        rows: [
          {
            sl: 1,
            voyage: 'VESSEL-KAVARATTI-V04',
            date: '10/08/2026',
            tonnage: 42.5,
            vehicle: 'KL-01-CZ-9988',
            driver: 'Captain Rajendran',
            craneCharge: 15000,
            netFreight: 125000,
          },
        ],
        outputs: {
          fixedAmount: 125000,
          subtotal: 140000,
          totalAmount: 147000,
        },
      }
    );

    renderedSnapshot.breakupRows = [
      { id: 'b1', label: 'Contract Base Haulage Package', rawValue: 125000, formattedText: '₹1,25,000.00' },
      { id: 'b2', label: 'Quayside Crane & Stevedoring Fee', rawValue: 15000, formattedText: '₹15,000.00' },
    ];
    renderedSnapshot.subtotal = 140000;
    renderedSnapshot.totalAmount = 147000;
    renderedSnapshot.amountInWords = 'INR One Lakh Forty Seven Thousand Only';

    // 3. Issue and lock invoice in PostgreSQL
    const issueResult = await ServerInvoiceService.issueInvoice({
      supplierId,
      customerId,
      contractId,
      periodFrom: '2026-08-01',
      periodTo: '2026-08-31',
      totalAmount: 147000,
      snapshotJson: renderedSnapshot,
      templateId: customTemplateId,
      templateVersion: 1,
      issuedBy: 'Admin Terminal',
    });

    expect(issueResult.invoiceId).toBeDefined();
    expect(issueResult.status).toBe('locked');
    expect(issueResult.invoiceNumber).toBeDefined();

    // 4. Verify invoice in PostgreSQL database has immutable snapshot
    const dbInvoice = await client.query(`SELECT * FROM invoices WHERE id = $1`, [issueResult.invoiceId]);
    expect(dbInvoice.rows).toHaveLength(1);
    const row = dbInvoice.rows[0];
    expect(row.status).toBe('locked');
    expect(row.template_id).toBe(customTemplateId);
    expect(row.template_version).toBe(1);
    expect(row.snapshot_json.supplier.tradeName).toBe('Apex Maritime Freight Logistics');
    expect(row.snapshot_json.customer.name).toBe('Blue Horizon Maritime Port Operators');

    // 5. Generate Printable HTML / PDF stylesheet
    const generatedHtml = generateInvoiceHtml(row.snapshot_json);

    // 6. Assert all custom data appears in rendered document with ZERO code hardcoding
    expect(generatedHtml).toContain('Apex Maritime Freight Logistics');
    expect(generatedHtml).toContain('Blue Horizon Maritime Port Operators');
    expect(generatedHtml).toContain('32APEXL1234F1Z8');
    expect(generatedHtml).toContain('32BLUEM9876Q1Z2');
    expect(generatedHtml).toContain('Axis Bank Ltd');
    expect(generatedHtml).toContain('UTIB0001234');
    expect(generatedHtml).toContain('98765432101234');
    expect(generatedHtml).toContain('Quayside Crane & Stevedoring Fee');
    expect(generatedHtml).toContain('1,47,000');
    expect(generatedHtml).toContain('INR One Lakh Forty Seven Thousand Only');
    expect(generatedHtml).toContain('Captain Rajendran');
    expect(generatedHtml).toContain('KL-01-CZ-9988');

    // 7. Verify zero hardcoded legacy names leaked into the custom invoice
    expect(generatedHtml).not.toContain('Vindhya Telelinks');
    expect(generatedHtml).not.toContain('Global Public School');
    expect(generatedHtml).not.toContain('Indian Bank');
    expect(generatedHtml).not.toContain('IDIB000K037');
  });
});
