// Template Engine Types - Declarative JSON Templates for Ledgers & Invoices

export type LedgerFieldType =
  | 'text'
  | 'number'
  | 'time'
  | 'duration'
  | 'money'
  | 'bool'
  | 'select'
  | 'tags'
  | 'photo'
  | 'formula';

export type BillingRole =
  | 'none'
  | 'km'
  | 'hours'
  | 'bata'
  | 'toll'
  | 'permit'
  | 'other';

export interface LedgerFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: LedgerFieldType;
  required?: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
  };
  visibility: {
    driverApp: boolean;
    officeGrid: boolean;
    printedLogbook: boolean;
  };
  billingRole: BillingRole;
  width?: string;
  align?: 'left' | 'center' | 'right';
  formula?: string; // If type === 'formula'
  options?: string[]; // If type === 'select'
}

export interface LedgerTemplate {
  id: string;
  name: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  description?: string;
  fields: LedgerFieldDefinition[];
  showTotalsRow: boolean;
  dayStatusLabels: Record<string, string>;
  printHeader: {
    title: string;
    subtitle?: string;
    orientation: 'portrait' | 'landscape';
    showVehiclePlate?: boolean;
    showCustomerName?: boolean;
    showDateRange?: boolean;
  };
  mappingProfile?: Record<string, string>; // e.g. { "DATE": "date", "TOTAL KM": "usedKm" }
  createdAt?: string;
  updatedAt?: string;
}

export type InvoiceDataFormat = 'money' | 'km' | 'HH:MM' | 'date' | 'text' | 'number';

export interface InvoiceColumnDefinition {
  id: string;
  label: string;
  source: string; // e.g. "row.date", "row.durationFormatted", "row.lineTotal", or formula expression
  format: InvoiceDataFormat;
  align: 'left' | 'center' | 'right';
  width?: string;
  show: boolean;
}

export interface BreakupRowDefinition {
  id: string;
  label: string;
  source: string; // Formula or context variable: "outputs.fixedAmount", "outputs.extraHoursAmount"
  condition?: string; // Optional safe expression: "outputs.extraHoursAmount > 0"
  format: 'money' | 'number' | 'text';
}

export interface InvoiceMetaField {
  key: string;
  label: string;
  source: string; // e.g. "invoice.number", "contract.agreementNo", "dates.period"
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  code: string; // e.g. 'FORMAT_1_SCHOOL', 'FORMAT_2_VTL'
  version: number;
  status: 'draft' | 'published' | 'archived';
  description?: string;
  pricingModelId: 'monthly_fixed' | 'per_trip_package' | 'per_km' | 'per_hour' | 'slab' | 'per_day';
  pageSetup: {
    orientation: 'portrait' | 'landscape';
    paperSize: 'A4' | 'Letter';
    marginMm: number;
  };
  header: {
    showSupplierLogo: boolean;
    showSupplierAddress: boolean;
    showRecipientDetails: boolean;
    titleText: string;
    metaFields: InvoiceMetaField[];
  };
  lineTable: {
    title?: string;
    columns: InvoiceColumnDefinition[];
    showSummaryRow?: boolean;
  };
  breakupRows: BreakupRowDefinition[];
  totals: {
    rounding: 'down' | 'nearest' | 'none';
    showInWords: boolean;
    gstBlock: boolean;
  };
  footer: {
    bankDetails: boolean;
    upiQr: boolean;
    termsAndConditions: string[];
    signatureBlock: {
      title: string;
      subtitle: string;
    };
    promoText?: string;
  };
  annexure: {
    attachLedger: boolean;
    ledgerTemplateId?: string;
  };
  styleTokens: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    tableBorder: 'clean' | 'grid' | 'minimal';
    compactDensity: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}
