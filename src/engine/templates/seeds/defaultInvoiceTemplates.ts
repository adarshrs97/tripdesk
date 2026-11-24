import { InvoiceTemplate } from '../types';
import { format1SchoolTemplate } from './format1School';
import { format2VTLTemplate } from './format2VTL';

export const regularTaxInvoiceTemplate: InvoiceTemplate = {
  id: 'template-inv-regular-gst',
  name: 'Regular GST Tax Invoice',
  code: 'REGULAR_TAX_INVOICE',
  version: 1,
  status: 'published',
  description: 'Standard GST tax invoice with SAC/HSN codes, itemized line items, intra-state (CGST+SGST) and inter-state (IGST) tax schedule, and bank NEFT details.',
  pricingModelId: 'per_trip_package',
  pageSetup: {
    orientation: 'portrait',
    paperSize: 'A4',
    marginMm: 12,
  },
  header: {
    showSupplierLogo: true,
    showSupplierAddress: true,
    showRecipientDetails: true,
    titleText: 'TAX INVOICE',
    metaFields: [
      { key: 'invoiceNo', label: 'Invoice No', source: 'invoice.number' },
      { key: 'invoiceDate', label: 'Date', source: 'invoice.date' },
      { key: 'dueDate', label: 'Due Date', source: 'invoice.dueDate' },
      { key: 'placeOfSupply', label: 'Place of Supply', source: 'invoice.placeOfSupply' },
      { key: 'reverseCharge', label: 'Reverse Charge (RCM)', source: 'invoice.rcmApplicable' },
    ],
  },
  lineTable: {
    title: 'Taxable Goods & Services',
    columns: [
      { id: 'col-sl', label: 'Sl', source: 'row.index', format: 'number', align: 'center', width: '6%', show: true },
      { id: 'col-desc', label: 'Service Description', source: 'row.description', format: 'text', align: 'left', width: '44%', show: true },
      { id: 'col-sac', label: 'HSN/SAC', source: 'row.sacHsn', format: 'text', align: 'center', width: '12%', show: true },
      { id: 'col-qty', label: 'Qty / Unit', source: 'row.quantityFormatted', format: 'text', align: 'right', width: '12%', show: true },
      { id: 'col-rate', label: 'Rate (₹)', source: 'row.rate', format: 'money', align: 'right', width: '12%', show: true },
      { id: 'col-total', label: 'Amount (₹)', source: 'row.netTotal', format: 'money', align: 'right', width: '14%', show: true },
    ],
    showSummaryRow: true,
  },
  breakupRows: [
    { id: 'b-subtotal', label: 'Taxable Value', source: 'outputs.taxableTotal', format: 'money' },
    { id: 'b-cgst', label: 'CGST (2.5%)', source: 'outputs.cgstAmount', format: 'money', condition: 'outputs.cgstAmount > 0' },
    { id: 'b-sgst', label: 'SGST (2.5%)', source: 'outputs.sgstAmount', format: 'money', condition: 'outputs.sgstAmount > 0' },
    { id: 'b-igst', label: 'IGST (5%)', source: 'outputs.igstAmount', format: 'money', condition: 'outputs.igstAmount > 0' },
    { id: 'b-round', label: 'Round Off', source: 'outputs.roundOff', format: 'money' },
  ],
  totals: {
    rounding: 'down',
    showInWords: true,
    gstBlock: true,
  },
  footer: {
    bankDetails: true,
    upiQr: true,
    termsAndConditions: [
      '1. Payment strictly due within agreed credit period from the invoice date.',
      '2. Interest @ 18% p.a. will be levied on delayed payments beyond 30 days.',
      '3. All disputes subject to Trivandrum jurisdiction only.',
    ],
    signatureBlock: {
      title: 'For City Tours & Travels',
      subtitle: 'Authorised Signatory',
    },
    promoText: 'Thank you for your business!',
  },
  annexure: {
    attachLedger: false,
  },
  styleTokens: {
    primaryColor: '#0b6e63',
    accentColor: '#10b981',
    fontFamily: 'Inter, sans-serif',
    tableBorder: 'grid',
    compactDensity: false,
  },
};

export const billOfSupplyTemplate: InvoiceTemplate = {
  id: 'template-inv-bill-of-supply',
  name: 'Bill of Supply (Non-GST / Exempt)',
  code: 'BILL_OF_SUPPLY',
  version: 1,
  status: 'published',
  description: 'Issued for non-taxable services, exempt travel routes, or composition taxpayers with mandatory statutory composition notice.',
  pricingModelId: 'per_trip_package',
  pageSetup: {
    orientation: 'portrait',
    paperSize: 'A4',
    marginMm: 12,
  },
  header: {
    showSupplierLogo: false,
    showSupplierAddress: true,
    showRecipientDetails: true,
    titleText: 'BILL OF SUPPLY',
    metaFields: [
      { key: 'billNo', label: 'Bill No', source: 'invoice.number' },
      { key: 'billDate', label: 'Bill Date', source: 'invoice.date' },
      { key: 'statutoryNotice', label: 'Statutory Note', source: 'Exempt / Non-GST Passenger Transport' },
    ],
  },
  lineTable: {
    title: 'Particulars of Supply',
    columns: [
      { id: 'col-sl', label: 'Sl', source: 'row.index', format: 'number', align: 'center', width: '8%', show: true },
      { id: 'col-desc', label: 'Description', source: 'row.description', format: 'text', align: 'left', width: '60%', show: true },
      { id: 'col-qty', label: 'Qty', source: 'row.quantityFormatted', format: 'text', align: 'right', width: '14%', show: true },
      { id: 'col-amt', label: 'Total (₹)', source: 'row.netTotal', format: 'money', align: 'right', width: '18%', show: true },
    ],
  },
  breakupRows: [
    { id: 'b-subtotal', label: 'Total Amount', source: 'outputs.subtotal', format: 'money' },
    { id: 'b-discount', label: 'Discount', source: 'outputs.discountAmount', format: 'money', condition: 'outputs.discountAmount > 0' },
  ],
  totals: {
    rounding: 'down',
    showInWords: true,
    gstBlock: false,
  },
  footer: {
    bankDetails: true,
    upiQr: true,
    termsAndConditions: [
      '1. Composition taxable person, not eligible to collect tax on supplies.',
      '2. Subject to Trivandrum jurisdiction.',
    ],
    signatureBlock: {
      title: 'For StarCiti Group',
      subtitle: 'Authorised Signatory',
    },
  },
  annexure: { attachLedger: false },
  styleTokens: {
    primaryColor: '#334155',
    accentColor: '#64748b',
    fontFamily: 'system-ui',
    tableBorder: 'clean',
    compactDensity: true,
  },
};

export const proformaInvoiceTemplate: InvoiceTemplate = {
  id: 'template-inv-proforma',
  name: 'Proforma Invoice / Advance Estimate',
  code: 'PROFORMA_INVOICE',
  version: 1,
  status: 'published',
  description: 'Preliminary quotation and advance billing invoice before journey execution. Does not affect tax ledgers or accounts until confirmed.',
  pricingModelId: 'per_trip_package',
  pageSetup: { orientation: 'portrait', paperSize: 'A4', marginMm: 14 },
  header: {
    showSupplierLogo: true,
    showSupplierAddress: true,
    showRecipientDetails: true,
    titleText: 'PROFORMA INVOICE',
    metaFields: [
      { key: 'proformaNo', label: 'Proforma Ref', source: 'invoice.number' },
      { key: 'issueDate', label: 'Estimate Date', source: 'invoice.date' },
      { key: 'validity', label: 'Valid Until', source: 'invoice.validUntil' },
    ],
  },
  lineTable: {
    title: 'Estimated Tour & Rental Itinerary',
    columns: [
      { id: 'col-sl', label: 'Sl', source: 'row.index', format: 'number', align: 'center', width: '8%', show: true },
      { id: 'col-desc', label: 'Journey / Vehicle Spec', source: 'row.description', format: 'text', align: 'left', width: '56%', show: true },
      { id: 'col-days', label: 'Days / Trips', source: 'row.quantityFormatted', format: 'text', align: 'center', width: '16%', show: true },
      { id: 'col-est', label: 'Est. Amount (₹)', source: 'row.netTotal', format: 'money', align: 'right', width: '20%', show: true },
    ],
  },
  breakupRows: [
    { id: 'b-sub', label: 'Estimated Total', source: 'outputs.subtotal', format: 'money' },
    { id: 'b-tax', label: 'GST (5% Est.)', source: 'outputs.taxAmount', format: 'money' },
    { id: 'b-adv', label: 'Advance Required (50%)', source: 'outputs.advanceRequired', format: 'money' },
  ],
  totals: { rounding: 'down', showInWords: true, gstBlock: true },
  footer: {
    bankDetails: true,
    upiQr: true,
    termsAndConditions: [
      '1. This is a Proforma estimate and not a Tax Invoice.',
      '2. Booking is confirmed only upon receipt of 50% advance payment.',
      '3. Toll, parking, and interstate permits will be billed at actuals upon completion.',
    ],
    signatureBlock: { title: 'For City Tours & Travels', subtitle: 'Operations Desk' },
  },
  annexure: { attachLedger: false },
  styleTokens: { primaryColor: '#2563eb', accentColor: '#3b82f6', fontFamily: 'Inter', tableBorder: 'grid', compactDensity: false },
};

export const tripSheetTemplate: InvoiceTemplate = {
  id: 'template-inv-trip-sheet',
  name: 'Trip Sheet / Driver Duty Slip',
  code: 'TRIP_SHEET_DRIVER',
  version: 1,
  status: 'published',
  description: 'Physical or digital driver duty slip designed for guest sign-off, starting/ending odometer verification, and fuel tracking.',
  pricingModelId: 'per_day',
  pageSetup: { orientation: 'portrait', paperSize: 'A4', marginMm: 10 },
  header: {
    showSupplierLogo: false,
    showSupplierAddress: true,
    showRecipientDetails: true,
    titleText: 'TRIP SHEET / DUTY SLIP',
    metaFields: [
      { key: 'dutySlipNo', label: 'Duty Slip #', source: 'invoice.number' },
      { key: 'date', label: 'Duty Date', source: 'invoice.date' },
      { key: 'vehicleNo', label: 'Vehicle No', source: 'contract.vehiclePlate' },
      { key: 'driver', label: 'Driver', source: 'contract.driverName' },
    ],
  },
  lineTable: {
    title: 'Route & Transit Log',
    columns: [
      { id: 'c-date', label: 'Date', source: 'row.date', format: 'text', align: 'center', width: '14%', show: true },
      { id: 'c-route', label: 'Route / Places Visited', source: 'row.description', format: 'text', align: 'left', width: '38%', show: true },
      { id: 'c-stkm', label: 'Start KM', source: 'row.startKm', format: 'number', align: 'right', width: '12%', show: true },
      { id: 'c-clkm', label: 'Close KM', source: 'row.closeKm', format: 'number', align: 'right', width: '12%', show: true },
      { id: 'c-tkm', label: 'Run KM', source: 'row.usedKm', format: 'number', align: 'right', width: '10%', show: true },
      { id: 'c-time', label: 'Hours', source: 'row.durationFormatted', format: 'text', align: 'center', width: '14%', show: true },
    ],
  },
  breakupRows: [
    { id: 'b-km', label: 'Total Distance', source: 'outputs.totalKmUsed', format: 'text' },
    { id: 'b-hrs', label: 'Total Duty Hours', source: 'outputs.totalDutyHours', format: 'text' },
  ],
  totals: { rounding: 'none', showInWords: false, gstBlock: false },
  footer: {
    bankDetails: false,
    upiQr: false,
    termsAndConditions: [
      'I hereby certify that the vehicle reported on time and the above meter reading and hours are correct.',
    ],
    signatureBlock: { title: 'Guest / Officer Signature', subtitle: 'Signature & Designation' },
  },
  annexure: { attachLedger: false },
  styleTokens: { primaryColor: '#0f172a', accentColor: '#475569', fontFamily: 'monospace', tableBorder: 'grid', compactDensity: true },
};

export const agentPlainTemplate: InvoiceTemplate = {
  id: 'template-inv-agent-plain',
  name: 'Agent Plain (White-Label / No Logo)',
  code: 'AGENT_PLAIN_INVOICE',
  version: 1,
  status: 'published',
  description: 'Unbranded clean billing statement for travel agents, aggregators, and corporate desks who re-bill clients under their own letterhead.',
  pricingModelId: 'per_trip_package',
  pageSetup: { orientation: 'portrait', paperSize: 'A4', marginMm: 12 },
  header: {
    showSupplierLogo: false,
    showSupplierAddress: true,
    showRecipientDetails: true,
    titleText: 'STATEMENT OF CHARGES',
    metaFields: [
      { key: 'refNo', label: 'Reference No', source: 'invoice.number' },
      { key: 'date', label: 'Date', source: 'invoice.date' },
      { key: 'guestName', label: 'Passenger / Guest', source: 'invoice.guestName' },
    ],
  },
  lineTable: {
    title: 'Service Summary',
    columns: [
      { id: 'col-sl', label: 'Sl', source: 'row.index', format: 'number', align: 'center', width: '8%', show: true },
      { id: 'col-desc', label: 'Description', source: 'row.description', format: 'text', align: 'left', width: '64%', show: true },
      { id: 'col-amt', label: 'Charges (₹)', source: 'row.netTotal', format: 'money', align: 'right', width: '28%', show: true },
    ],
  },
  breakupRows: [
    { id: 'b-sub', label: 'Subtotal', source: 'outputs.subtotal', format: 'money' },
    { id: 'b-comm', label: 'Less Agent Commission', source: 'outputs.agentCommission', format: 'money', condition: 'outputs.agentCommission > 0' },
  ],
  totals: { rounding: 'down', showInWords: true, gstBlock: false },
  footer: {
    bankDetails: true,
    upiQr: false,
    termsAndConditions: ['Confidential statement for contracted partner.'],
    signatureBlock: { title: 'Authorised Signatory', subtitle: 'Desk Coordinator' },
  },
  annexure: { attachLedger: false },
  styleTokens: { primaryColor: '#475569', accentColor: '#94a3b8', fontFamily: 'sans-serif', tableBorder: 'clean', compactDensity: true },
};

export const creditDebitNoteTemplate: InvoiceTemplate = {
  id: 'template-inv-credit-debit-note',
  name: 'Credit / Debit Note',
  code: 'CREDIT_DEBIT_NOTE_TEMPLATE',
  version: 1,
  status: 'published',
  description: 'Statutory GST Credit Note or Debit Note linked to an original invoice for post-sale adjustments, toll waivers, or corrections.',
  pricingModelId: 'per_trip_package',
  pageSetup: { orientation: 'portrait', paperSize: 'A4', marginMm: 14 },
  header: {
    showSupplierLogo: true,
    showSupplierAddress: true,
    showRecipientDetails: true,
    titleText: 'CREDIT / DEBIT NOTE',
    metaFields: [
      { key: 'noteNo', label: 'Note No', source: 'invoice.number' },
      { key: 'noteDate', label: 'Note Date', source: 'invoice.date' },
      { key: 'originalInvNo', label: 'Original Invoice #', source: 'invoice.originalInvoiceNumber' },
      { key: 'originalInvDate', label: 'Original Invoice Date', source: 'invoice.originalInvoiceDate' },
      { key: 'reason', label: 'Reason for Adjustment', source: 'invoice.adjustmentReason' },
    ],
  },
  lineTable: {
    title: 'Adjustment Line Items',
    columns: [
      { id: 'col-sl', label: 'Sl', source: 'row.index', format: 'number', align: 'center', width: '8%', show: true },
      { id: 'col-desc', label: 'Adjustment Description', source: 'row.description', format: 'text', align: 'left', width: '60%', show: true },
      { id: 'col-amt', label: 'Net Adjustment (₹)', source: 'row.netTotal', format: 'money', align: 'right', width: '32%', show: true },
    ],
  },
  breakupRows: [
    { id: 'b-adj', label: 'Net Adjustment Amount', source: 'outputs.subtotal', format: 'money' },
    { id: 'b-tax', label: 'GST Adjustment', source: 'outputs.taxAmount', format: 'money', condition: 'outputs.taxAmount > 0' },
  ],
  totals: { rounding: 'down', showInWords: true, gstBlock: true },
  footer: {
    bankDetails: false,
    upiQr: false,
    termsAndConditions: [
      '1. Issued under Section 34 of the CGST Act, 2017.',
      '2. Adjustments reflect against the customer balance receivable.',
    ],
    signatureBlock: { title: 'For City Tours & Travels', subtitle: 'Authorised Signatory' },
  },
  annexure: { attachLedger: false },
  styleTokens: { primaryColor: '#b91c1c', accentColor: '#ef4444', fontFamily: 'Inter', tableBorder: 'grid', compactDensity: true },
};

export const ALL_BUILT_IN_INVOICE_TEMPLATES: InvoiceTemplate[] = [
  format2VTLTemplate,
  format1SchoolTemplate,
  regularTaxInvoiceTemplate,
  billOfSupplyTemplate,
  proformaInvoiceTemplate,
  tripSheetTemplate,
  agentPlainTemplate,
  creditDebitNoteTemplate,
];
