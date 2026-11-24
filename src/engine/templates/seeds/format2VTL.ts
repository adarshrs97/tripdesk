import { InvoiceTemplate } from '../types';

export const format2VTLTemplate: InvoiceTemplate = {
  id: 'template-inv-format2-vtl',
  name: 'Starter: Monthly contract',
  code: 'STARTER_MONTHLY_CONTRACT',
  version: 1,
  status: 'published',
  description: 'Starter preset for monthly fixed-contract billing with included km/hours and pro-rata extra hours, km, and bata breakup.',
  pricingModelId: 'monthly_fixed',
  pageSetup: {
    orientation: 'portrait',
    paperSize: 'A4',
    marginMm: 14,
  },
  header: {
    showSupplierLogo: false, // Format 2 uses bold text header for M/S City Tours & Travels
    showSupplierAddress: true,
    showRecipientDetails: true,
    titleText: 'INVOICE',
    metaFields: [
      { key: 'invoiceNo', label: 'Invoice No', source: 'invoice.number' },
      { key: 'invoiceDate', label: 'Date', source: 'invoice.date' },
      { key: 'agreementNo', label: 'Agreement No & Date', source: 'contract.agreementNo' },
      { key: 'period', label: 'Period', source: 'invoice.periodText' },
      { key: 'vehiclePlate', label: 'Vehicle No', source: 'contract.vehiclePlate' },
      { key: 'driverName', label: 'Driver Name', source: 'contract.driverName' },
      { key: 'sacCode', label: 'SAC Code', source: 'contract.sacCode' },
    ],
  },
  lineTable: {
    title: 'Particulars',
    columns: [
      {
        id: 'col-sl-no',
        label: 'Sl No',
        source: 'row.index',
        format: 'number',
        align: 'center',
        width: '8%',
        show: true,
      },
      {
        id: 'col-particulars',
        label: 'Description of Service',
        source: 'row.description',
        format: 'text',
        align: 'left',
        width: '72%',
        show: true,
      },
      {
        id: 'col-amount',
        label: 'Amount (₹)',
        source: 'row.amount',
        format: 'money',
        align: 'right',
        width: '20%',
        show: true,
      },
    ],
    showSummaryRow: false,
  },
  breakupRows: [
    {
      id: 'brk-fixed',
      label: 'Fixed Charges for 3000 Kms / 30 Days',
      source: 'outputs.fixedAmount',
      condition: 'outputs.fixedAmount > 0',
      format: 'money',
    },
    {
      id: 'brk-extra-km',
      label: 'Extra Running (Km)',
      source: 'outputs.extraKmAmount',
      condition: 'outputs.extraKmAmount > 0',
      format: 'money',
    },
    {
      id: 'brk-extra-hours',
      label: 'Extra Working Hours (pro-rata)',
      source: 'outputs.extraHoursAmount',
      condition: 'outputs.extraHoursAmount > 0',
      format: 'money',
    },
    {
      id: 'brk-outstation-bata',
      label: 'Outstation Night Halt Bata',
      source: 'outputs.outstationBataAmount',
      condition: 'outputs.outstationBataAmount > 0',
      format: 'money',
    },
    {
      id: 'brk-night-bata',
      label: 'Driver Night Bata',
      source: 'outputs.nightBataAmount',
      condition: 'outputs.nightBataAmount > 0',
      format: 'money',
    },
    {
      id: 'brk-toll-permit',
      label: 'Toll & Permit Charges',
      source: 'outputs.tollPermitAmount',
      condition: 'outputs.tollPermitAmount > 0',
      format: 'money',
    },
  ],
  totals: {
    rounding: 'down',
    showInWords: true,
    gstBlock: false,
  },
  footer: {
    bankDetails: true,
    upiQr: false,
    termsAndConditions: [
      '1. Payment should be made by Cheque / RTGS / NEFT in favour of M/S CITY TOURS & TRAVELS.',
      '2. In case of any clarification, please revert within 7 working days.',
    ],
    signatureBlock: {
      title: 'For City Tours & Travels',
      subtitle: 'Authorized Signatory',
    },
    promoText: 'Thank you for your business!',
  },
  annexure: {
    attachLedger: true,
    ledgerTemplateId: 'template-ledger-vtl',
  },
  styleTokens: {
    primaryColor: '#1F2937', // Formal Slate/Charcoal matching PDF
    accentColor: '#3B82F6',
    fontFamily: 'Inter, sans-serif',
    tableBorder: 'grid',
    compactDensity: true,
  },
};

export const starterMonthlyContractTemplate = format2VTLTemplate;
