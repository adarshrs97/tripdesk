// ==============================================================================
// Milestone 8: Receivables Ageing Engine
// ==============================================================================

export interface InvoiceReceivableItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  supplierName: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;     // YYYY-MM-DD
  totalAmount: number;
  amountPaid: number;
  tdsDeducted: number;
  balanceDue: number;
  status: string;
}

export interface AgeingBucketTotals {
  current: number;      // Not yet due
  days1To30: number;    // 1-30 days overdue
  days31To60: number;   // 31-60 days overdue
  days61To90: number;   // 61-90 days overdue
  daysOver90: number;   // > 90 days overdue
  totalOutstanding: number;
  totalTdsDeducted: number;
}

export interface CustomerAgeingSummary {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  daysOver90: number;
  totalOutstanding: number;
  totalTdsDeducted: number;
  oldestDueDate: string;
}

export interface ReceivablesAgeingReport {
  asOfDate: string;
  summary: AgeingBucketTotals;
  customerSummaries: CustomerAgeingSummary[];
  invoices: (InvoiceReceivableItem & {
    daysOverdue: number;
    ageingCategory: 'current' | '1_to_30' | '31_to_60' | '61_to_90' | 'over_90';
  })[];
}

/**
 * Calculates days between two date strings (YYYY-MM-DD)
 */
function getDaysDifference(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str).getTime();
  const d2 = new Date(date2Str).getTime();
  const diffTime = d1 - d2;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generates Receivables Ageing Analysis as of a specific date
 */
export function calculateReceivablesAgeing(
  invoices: InvoiceReceivableItem[],
  asOfDateStr: string = new Date().toISOString().slice(0, 10)
): ReceivablesAgeingReport {
  const summary: AgeingBucketTotals = {
    current: 0,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    daysOver90: 0,
    totalOutstanding: 0,
    totalTdsDeducted: 0,
  };

  const customerMap = new Map<string, CustomerAgeingSummary>();

  const classifiedInvoices = invoices.map((inv) => {
    const balanceDue = Math.max(
      0,
      Math.round((inv.totalAmount - inv.amountPaid - inv.tdsDeducted) * 100) / 100
    );

    // Days overdue: positive if asOfDate > dueDate
    const daysOverdue = getDaysDifference(asOfDateStr, inv.dueDate);

    let ageingCategory: 'current' | '1_to_30' | '31_to_60' | '61_to_90' | 'over_90';

    if (daysOverdue <= 0) {
      ageingCategory = 'current';
      summary.current += balanceDue;
    } else if (daysOverdue <= 30) {
      ageingCategory = '1_to_30';
      summary.days1To30 += balanceDue;
    } else if (daysOverdue <= 60) {
      ageingCategory = '31_to_60';
      summary.days31To60 += balanceDue;
    } else if (daysOverdue <= 90) {
      ageingCategory = '61_to_90';
      summary.days61To90 += balanceDue;
    } else {
      ageingCategory = 'over_90';
      summary.daysOver90 += balanceDue;
    }

    summary.totalOutstanding += balanceDue;
    summary.totalTdsDeducted += inv.tdsDeducted;

    // Customer aggregation
    if (!customerMap.has(inv.customerId)) {
      customerMap.set(inv.customerId, {
        customerId: inv.customerId,
        customerName: inv.customerName,
        invoiceCount: 0,
        current: 0,
        days1To30: 0,
        days31To60: 0,
        days61To90: 0,
        daysOver90: 0,
        totalOutstanding: 0,
        totalTdsDeducted: 0,
        oldestDueDate: inv.dueDate,
      });
    }

    const cSummary = customerMap.get(inv.customerId)!;
    cSummary.invoiceCount += 1;
    cSummary.totalOutstanding += balanceDue;
    cSummary.totalTdsDeducted += inv.tdsDeducted;

    if (daysOverdue <= 0) cSummary.current += balanceDue;
    else if (daysOverdue <= 30) cSummary.days1To30 += balanceDue;
    else if (daysOverdue <= 60) cSummary.days31To60 += balanceDue;
    else if (daysOverdue <= 90) cSummary.days61To90 += balanceDue;
    else cSummary.daysOver90 += balanceDue;

    if (inv.dueDate < cSummary.oldestDueDate) {
      cSummary.oldestDueDate = inv.dueDate;
    }

    return {
      ...inv,
      balanceDue,
      daysOverdue,
      ageingCategory,
    };
  });

  // Round summary figures to 2 decimal places
  summary.current = Math.round(summary.current * 100) / 100;
  summary.days1To30 = Math.round(summary.days1To30 * 100) / 100;
  summary.days31To60 = Math.round(summary.days31To60 * 100) / 100;
  summary.days61To90 = Math.round(summary.days61To90 * 100) / 100;
  summary.daysOver90 = Math.round(summary.daysOver90 * 100) / 100;
  summary.totalOutstanding = Math.round(summary.totalOutstanding * 100) / 100;
  summary.totalTdsDeducted = Math.round(summary.totalTdsDeducted * 100) / 100;

  return {
    asOfDate: asOfDateStr,
    summary,
    customerSummaries: Array.from(customerMap.values()),
    invoices: classifiedInvoices,
  };
}
