// Dynamic Template Renderer - Evaluates JSON Invoice Templates against Billing Outputs
import { InvoiceTemplate, InvoiceColumnDefinition } from './types';
import { evaluateFormula } from './expressionEngine';
import { inrWords, applyRounding } from '../currency';
import { formatMinutesToHM } from '../duration';

export interface RenderContext {
  invoice: {
    id?: string;
    number: string;
    date: string;
    periodText?: string;
    status?: string;
  };
  supplier: {
    legalName: string;
    tradeName?: string;
    address: string;
    phone: string;
    email?: string;
    pan?: string;
    gstin?: string;
    bankName?: string;
    bankAccountNo?: string;
    bankIfsc?: string;
    bankBranch?: string;
    upiId?: string;
    logoUrl?: string;
  };
  customer: {
    name: string;
    tradeName?: string;
    billingAddress: string;
    gstin?: string;
    contactPerson?: string;
    phone?: string;
  };
  contract: {
    name: string;
    agreementNo?: string;
    vehiclePlate?: string;
    driverName?: string;
    sacCode?: string;
  };
  outputs: Record<string, any>;
  rows: Record<string, any>[];
}

export interface RenderedColumnHeader {
  id: string;
  label: string;
  align: 'left' | 'center' | 'right';
  width?: string;
}

export interface RenderedCell {
  columnId: string;
  rawValue: any;
  formattedText: string;
  align: 'left' | 'center' | 'right';
}

export interface RenderedRow {
  index: number;
  cells: RenderedCell[];
}

export interface RenderedBreakupItem {
  id: string;
  label: string;
  rawValue: any;
  formattedText: string;
}

export interface RenderedInvoice {
  templateId: string;
  templateVersion: number;
  title: string;
  supplier: RenderContext['supplier'];
  customer: RenderContext['customer'];
  metaFields: { key: string; label: string; value: string }[];
  columns: RenderedColumnHeader[];
  rows: RenderedRow[];
  breakupRows: RenderedBreakupItem[];
  subtotal: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
  terms: string[];
  signature: {
    title: string;
    subtitle: string;
  };
  bankDetails?: {
    accountName: string;
    bankName: string;
    branch: string;
    accountNo: string;
    ifsc: string;
    upiId?: string;
  };
  styleTokens: InvoiceTemplate['styleTokens'];
  annexure: InvoiceTemplate['annexure'];
}

export function formatValue(val: any, format: InvoiceColumnDefinition['format']): string {
  if (val === null || val === undefined || val === '') return '-';

  switch (format) {
    case 'money': {
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
      if (isNaN(num)) return '-';
      return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case 'km': {
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (isNaN(num)) return '-';
      return `${Math.round(num * 100) / 100} KM`;
    }
    case 'HH:MM': {
      if (typeof val === 'number') {
        return formatMinutesToHM(val);
      }
      return String(val);
    }
    case 'number': {
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (isNaN(num)) return '-';
      return num.toLocaleString('en-IN');
    }
    case 'date':
    case 'text':
    default:
      return String(val);
  }
}

/**
 * Pure function: renders an InvoiceTemplate with runtime context into RenderedInvoice.
 */
export function renderInvoiceTemplate(
  template: InvoiceTemplate,
  context: RenderContext
): RenderedInvoice {
  // 1. Meta fields
  const metaFields = template.header.metaFields.map((field) => {
    const val = evaluateFormula(field.source, context);
    return {
      key: field.key,
      label: field.label,
      value: val !== null && val !== undefined ? String(val) : '-',
    };
  });

  // 2. Visible table columns
  const visibleColumns = template.lineTable.columns.filter((c) => c.show !== false);
  const columnHeaders: RenderedColumnHeader[] = visibleColumns.map((c) => ({
    id: c.id,
    label: c.label,
    align: c.align,
    width: c.width,
  }));

  // 3. Render line rows
  const renderedRows: RenderedRow[] = context.rows.map((row, index) => {
    const rowContext = { ...context, ...row, row: { ...row, index: index + 1 } };
    const cells: RenderedCell[] = visibleColumns.map((col) => {
      const rawValue = evaluateFormula(col.source, rowContext);
      const formattedText = formatValue(rawValue, col.format);
      return {
        columnId: col.id,
        rawValue,
        formattedText,
        align: col.align,
      };
    });
    return {
      index: index + 1,
      cells,
    };
  });

  // 4. Render breakup rows
  const renderedBreakup: RenderedBreakupItem[] = [];
  for (const item of template.breakupRows) {
    if (item.condition) {
      const conditionMet = evaluateFormula(item.condition, context);
      if (!conditionMet) continue;
    }
    const rawVal = evaluateFormula(item.source, context);
    if (rawVal !== null && rawVal !== undefined) {
      renderedBreakup.push({
        id: item.id,
        label: item.label,
        rawValue: rawVal,
        formattedText: formatValue(rawVal, item.format),
      });
    }
  }

  // 5. Compute subtotal & totals
  const subtotal = Number(context.outputs.subtotal || context.outputs.totalAmount || 0);
  const rounding = applyRounding(subtotal, template.totals.rounding);
  const totalAmount = rounding.rounded;
  const roundOff = rounding.roundOff;
  const amountInWords = inrWords(totalAmount);

  // 6. Bank details
  const bankDetails = template.footer.bankDetails && context.supplier.bankAccountNo
    ? {
        accountName: context.supplier.legalName || context.supplier.tradeName || '',
        bankName: context.supplier.bankName || '',
        branch: context.supplier.bankBranch || '',
        accountNo: context.supplier.bankAccountNo || '',
        ifsc: context.supplier.bankIfsc || '',
        upiId: context.supplier.upiId,
      }
    : undefined;

  const signatureTitle = template.footer.signatureBlock.title
    ? (template.footer.signatureBlock.title.startsWith('For ') && context.supplier.tradeName
        ? `For ${context.supplier.tradeName}`
        : template.footer.signatureBlock.title)
    : 'Authorised Signatory';

  return {
    templateId: template.id,
    templateVersion: template.version,
    title: template.header.titleText,
    supplier: context.supplier,
    customer: context.customer,
    metaFields,
    columns: columnHeaders,
    rows: renderedRows,
    breakupRows: renderedBreakup,
    subtotal,
    roundOff,
    totalAmount,
    amountInWords,
    terms: template.footer.termsAndConditions,
    signature: {
      title: signatureTitle,
      subtitle: template.footer.signatureBlock.subtitle || 'Authorised Signatory',
    },
    bankDetails,
    styleTokens: template.styleTokens,
    annexure: template.annexure,
  };
}
