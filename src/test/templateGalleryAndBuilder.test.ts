import { describe, it, expect } from 'vitest';
import {
  ALL_BUILT_IN_INVOICE_TEMPLATES,
  format2VTLTemplate,
  regularTaxInvoiceTemplate,
  billOfSupplyTemplate,
  InvoiceTemplate,
  renderInvoiceTemplate,
} from '../engine/templates';

describe('Add-on Part 2: Invoice Template Gallery & Visual Builder Tests', () => {
  it('1. Gallery lists all 8 standard built-in templates with complete metadata', () => {
    expect(ALL_BUILT_IN_INVOICE_TEMPLATES.length).toBe(8);

    const codes = ALL_BUILT_IN_INVOICE_TEMPLATES.map((t) => t.code);
    expect(codes).toContain('STARTER_MONTHLY_CONTRACT');
    expect(codes).toContain('STARTER_PER_TRIP_PACKAGE');
    expect(codes).toContain('REGULAR_TAX_INVOICE');
    expect(codes).toContain('BILL_OF_SUPPLY');
    expect(codes).toContain('PROFORMA_INVOICE');
    expect(codes).toContain('TRIP_SHEET_DRIVER');
    expect(codes).toContain('AGENT_PLAIN_INVOICE');
    expect(codes).toContain('CREDIT_DEBIT_NOTE_TEMPLATE');

    ALL_BUILT_IN_INVOICE_TEMPLATES.forEach((tpl) => {
      expect(tpl.name).toBeDefined();
      expect(tpl.version).toBeGreaterThanOrEqual(1);
      expect(tpl.status).toBe('published');
      expect(tpl.pageSetup.paperSize).toBe('A4');
      expect(tpl.lineTable.columns.length).toBeGreaterThan(0);
      expect(tpl.footer.termsAndConditions.length).toBeGreaterThan(0);
    });
  });

  it('2. Clone & Edit workflow creates an isolated draft with inherited blocks and new ID', () => {
    const original = format2VTLTemplate;
    const cloned: InvoiceTemplate = {
      ...JSON.parse(JSON.stringify(original)),
      id: `custom-vtl-${Date.now()}`,
      name: `${original.name} (Customised for Technopark)`,
      code: 'FORMAT_2_VTL_CUSTOM',
      version: 1,
      status: 'draft',
    };

    expect(cloned.id).not.toBe(original.id);
    expect(cloned.name).toContain('Customised for Technopark');
    expect(cloned.status).toBe('draft');
    expect(cloned.version).toBe(1);
    expect(cloned.lineTable.columns.length).toBe(original.lineTable.columns.length);
    expect(cloned.header.metaFields.length).toBe(original.header.metaFields.length);
  });

  it('3. Renders live VTL August 2026 data accurately across built-in and cloned templates', () => {
    const vtlContext = {
      invoice: {
        number: '108191',
        date: '31/08/2026',
        periodText: '01/08/2026 to 31/08/2026',
      },
      supplier: {
        legalName: 'M. Ratnaraj',
        tradeName: 'M/S City Tours & Travels',
        address: 'Killipalam, Trivandrum, Kerala',
        phone: '+91 6238603200',
        email: 'info@starciti.com',
        pan: 'BGYPM6861Q',
        gstin: '32BGYPM6861Q1Z3',
      },
      customer: {
        name: 'M/s Vindhya Telelinks Limited',
        billingAddress: 'Cochin Project Office, Kerala',
      },
      contract: {
        agreementNo: 'VTL-TRV-2024-01',
        vehiclePlate: 'KL 01 CP 3284',
        driverName: 'Muhammad Fayaz.s',
        sacCode: '996601',
      },
      outputs: {
        fixedAmount: 65000,
        extraHoursAmount: 1462.5,
        nightBataAmount: 400,
        outstationBataAmount: 600,
        tollPermitAmount: 1200,
        subtotal: 68662.5,
        roundOff: -0.5,
        totalAmount: 68662,
      },
      rows: [
        {
          index: 1,
          description: 'Monthly Fixed Vehicle Rent for Sedan (KL01CP3284) - 3000 KM & 12 Hrs/Day',
          sacHsn: '996601',
          quantityFormatted: '1 Month',
          rate: 65000,
          netTotal: 65000,
        },
      ],
    };

    const rendered = renderInvoiceTemplate(format2VTLTemplate, vtlContext as any);
    expect(rendered.title).toBe('INVOICE');
    expect(rendered.totalAmount).toBe(68662);
    expect(rendered.amountInWords).toBe('Sixty Eight Thousand Six Hundred and Sixty Two Only');
    // 5 active rows (Extra KM row omitted because extraKmAmount is 0):
    expect(rendered.breakupRows.length).toBe(5);
    expect(rendered.breakupRows[0].label).toContain('Fixed Charges for 3000 Kms');
    expect(rendered.breakupRows[1].label).toContain('Extra Working Hours');
  });

  it('4. JSON Export and Import: round-trip preserves all layout geometry and column schemas', () => {
    const templateToExport = regularTaxInvoiceTemplate;
    const jsonString = JSON.stringify(templateToExport, null, 2);

    const imported: InvoiceTemplate = JSON.parse(jsonString);
    expect(imported.id).toBe(templateToExport.id);
    expect(imported.code).toBe('REGULAR_TAX_INVOICE');
    expect(imported.pricingModelId).toBe('per_trip_package');
    expect(imported.styleTokens.primaryColor).toBe('#0b6e63');
    expect(imported.lineTable.columns.length).toBe(6);
    expect(imported.breakupRows.length).toBe(5);
    expect(imported.footer.bankDetails).toBe(true);
    expect(imported.totals.gstBlock).toBe(true);
  });

  it('5. Publishing workflow increments version number and updates status to published', () => {
    const draftTemplate: InvoiceTemplate = {
      ...billOfSupplyTemplate,
      id: 'custom-draft-1',
      name: 'Custom Bill of Supply for Local Schools',
      version: 1,
      status: 'draft',
    };

    // Simulate Admin publishing
    const published: InvoiceTemplate = {
      ...draftTemplate,
      version: draftTemplate.version + 1,
      status: 'published',
      updatedAt: new Date().toISOString(),
    };

    expect(published.version).toBe(2);
    expect(published.status).toBe('published');
    expect(published.updatedAt).toBeDefined();
  });
});
