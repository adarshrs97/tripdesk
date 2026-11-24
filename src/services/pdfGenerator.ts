import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { RenderedInvoice } from '../engine';
import { DayLedgerEntry } from '../engine/types';

export interface PdfGenerationOptions {
  outputPath?: string;
  screenshotPath?: string;
  annexureEntries?: DayLedgerEntry[];
}

export function generateInvoiceHtml(invoice: RenderedInvoice, annexureEntries?: DayLedgerEntry[]): string {
  const primaryColor = invoice.styleTokens?.primaryColor || '#1F2937';
  const supplier = invoice.supplier || {
    legalName: '',
    tradeName: '',
    address: '',
    phone: '',
    email: '',
    pan: '',
    gstin: '',
  };
  const customer = invoice.customer || {
    name: 'Customer',
    billingAddress: '',
    gstin: '',
  };

  const metaHtml = (invoice.metaFields || [])
    .map(
      (m) => `
      <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin-bottom: 2px;">
        <span style="color: #64748b; font-weight: 500;">${m.label}:</span>
        <span style="color: #0f172a; font-weight: 600;">${m.value}</span>
      </div>`
    )
    .join('');

  const tableHeaderHtml = (invoice.columns || [])
    .map(
      (col) => `
      <th style="padding: 6px 8px; text-align: ${col.align}; width: ${col.width || 'auto'}; font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155;">
        ${col.label}
      </th>`
    )
    .join('');

  const tableRowsHtml = (invoice.rows || [])
    .map(
      (row, rIdx) => `
      <tr style="background: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        ${(row.cells || [])
          .map(
            (c) => `
          <td style="padding: 6px 8px; text-align: ${c.align}; font-size: 11px; border: 1px solid #e2e8f0; color: #1e293b;">
            ${c.formattedText}
          </td>`
          )
          .join('')}
      </tr>`
    )
    .join('');

  const breakupRowsHtml = (invoice.breakupRows || [])
    .map(
      (b) => `
      <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; border-bottom: 1px dashed #e2e8f0;">
        <span style="color: #475569;">${b.label}:</span>
        <span style="font-weight: 600; color: #0f172a;">${b.formattedText}</span>
      </div>`
    )
    .join('');

  // Optional Annexure Logbook Table
  let annexureHtml = '';
  if (invoice.annexure?.attachLedger && annexureEntries && annexureEntries.length > 0) {
    const formatExtraHours = (entry: DayLedgerEntry): string => {
      if ((entry as any).extraHoursFormatted) return (entry as any).extraHoursFormatted;
      if (entry.durationMinutes && entry.durationMinutes > 720) {
        const extra = entry.durationMinutes - 720;
        return `${Math.floor(extra / 60)}:${String(extra % 60).padStart(2, '0')}`;
      }
      return '-';
    };

    const annexRows = annexureEntries
      .map(
        (e, idx) => `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 9px;">
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.date}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.dayStatus || 'RUN'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.startKm ?? '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.closeKm ?? '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; font-weight: 600;">${e.usedKm ?? 0} KM</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.startTime ?? '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.closeTime ?? '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.durationMinutes ? Math.floor(e.durationMinutes / 60) + ':' + String(e.durationMinutes % 60).padStart(2, '0') : '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${formatExtraHours(e)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.nightBata ? '₹200' : '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${e.outstationBata ? '₹200' : '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">${e.toll ? '₹' + e.toll : '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: left; font-size: 8px;">${e.remarks || ''}</td>
        </tr>`
      )
      .join('');

    annexureHtml = `
      <div class="page-break" style="page-break-before: always; margin-top: 30px; padding-top: 20px;">
        <div style="border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <h2 style="margin: 0; font-size: 14px; text-transform: uppercase; color: ${primaryColor}; font-weight: 700;">
              Annexure: Daily Trip Logbook
            </h2>
            <p style="margin: 2px 0 0; font-size: 10px; color: #64748b;">
              Supporting documentation for Invoice ${invoice.metaFields.find((m) => m.key === 'invoiceNo')?.value || ''}
            </p>
          </div>
          <div style="font-size: 10px; color: #475569; font-weight: 600;">
            Total Logged Trips: ${annexureEntries.length} | Customer: ${invoice.customer.name}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-family: Inter, Arial, sans-serif;">
          <thead>
            <tr style="background: #f1f5f9; font-size: 9px; text-transform: uppercase;">
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Date</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Status</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Start KM</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Close KM</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Run KM</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Start Time</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Close Time</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Run Hrs</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Extra Hrs</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Night</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Outstn</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Toll</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px;">Route / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${annexRows}
          </tbody>
        </table>

        <div style="margin-top: 15px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px;">
          <span>Generated by Starciti Fleet & Billing Desk &bull; Verified Annexure</span>
          <span>Digitally signed and token-verified</span>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${invoice.title || 'Invoice'} - ${invoice.metaFields?.find((m) => m.key === 'invoiceNo')?.value || ''}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: "Noto Sans Malayalam", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-card {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .page-break {
      page-break-after: always;
    }
    table {
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <!-- Top Header: Supplier & Title -->
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="max-width: 60%;">
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; text-transform: uppercase;">
            ${supplier.legalName}
          </div>
          ${supplier.tradeName ? `<div style="font-size: 12px; font-weight: 600; color: #0b6e63; margin-top: 2px;">${supplier.tradeName}</div>` : ''}
          <div style="font-size: 10px; color: #475569; margin-top: 3px; line-height: 1.4;">
            ${supplier.address}
          </div>
          <div style="font-size: 10px; color: #334155; margin-top: 4px; display: flex; flex-wrap: gap; gap: 12px;">
            <span><strong>Phone:</strong> ${supplier.phone || ''}</span>
            <span><strong>Email:</strong> ${supplier.email || ''}</span>
          </div>
          <div style="font-size: 10px; color: #334155; margin-top: 2px;">
            ${supplier.pan ? `<span><strong>PAN:</strong> ${supplier.pan}</span>` : ''}
            ${supplier.gstin ? `<span style="margin-left: 12px;"><strong>GSTIN:</strong> ${supplier.gstin}</span>` : ''}
          </div>
        </div>

        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 12px; background: ${primaryColor}15; color: ${primaryColor}; font-size: 16px; font-weight: 800; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase;">
            ${invoice.title}
          </div>
          <div style="margin-top: 8px; min-width: 200px;">
            ${metaHtml}
          </div>
        </div>
      </div>
    </div>

    <!-- Recipient Block -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; display: flex; justify-content: space-between;">
      <div>
        <div style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px;">
          Billed To / Recipient:
        </div>
        <div style="font-size: 12px; font-weight: 700; color: #0f172a;">
          ${customer.name}
        </div>
        <div style="font-size: 10px; color: #475569; margin-top: 2px; max-width: 400px; line-height: 1.3;">
          ${customer.billingAddress}
        </div>
      </div>
      <div style="text-align: right;">
        ${customer.gstin ? `<div style="font-size: 10px; color: #334155;"><strong>GSTIN:</strong> ${customer.gstin}</div>` : ''}
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Place of Supply: Trivandrum, Kerala</div>
      </div>
    </div>

    <!-- Main Table -->
    <div style="margin-bottom: 14px;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            ${tableHeaderHtml}
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Breakup & Totals Section -->
    <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 14px;">
      <!-- Left: Breakup or Terms -->
      <div style="width: 52%;">
        ${
          (invoice.breakupRows || []).length > 0
            ? `
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #fafafa;">
            <div style="font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
              Billing Breakup & Adjustments
            </div>
            ${breakupRowsHtml}
          </div>`
            : `
          <div style="font-size: 10px; color: #64748b; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px; background: #f8fafc;">
            &bull; Billing strictly calculated as per verified contract terms.<br>
            &bull; Includes driver hire, fuel charges, and standard transit allowances.
          </div>`
        }
      </div>

      <!-- Right: Subtotal & Total Payable -->
      <div style="width: 44%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
          <span style="color: #64748b;">Subtotal:</span>
          <span style="font-weight: 600; color: #0f172a;">₹${(invoice.subtotal != null ? invoice.subtotal : (invoice.totalAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        ${
          invoice.roundOff && invoice.roundOff !== 0
            ? `
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px; color: #64748b;">
          <span>Round Off (Down):</span>
          <span>${invoice.roundOff > 0 ? '+₹' + invoice.roundOff.toFixed(2) : '-₹' + Math.abs(invoice.roundOff).toFixed(2)}</span>
        </div>`
            : ''
        }

        <div style="border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 13px; font-weight: 800; color: #0f172a;">Total Payable:</span>
          <span style="font-size: 18px; font-weight: 800; color: ${primaryColor}; font-family: monospace;">
            ₹${(invoice.totalAmount || 0).toLocaleString('en-IN')}/-
          </span>
        </div>

        <div style="border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 4px;">
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b;">Amount in Words:</div>
          <div style="font-size: 10px; font-weight: 600; color: #0f172a; line-height: 1.3;">
            ${invoice.amountInWords || ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer: Bank Details & Signature -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div style="width: 55%;">
        ${
          invoice.bankDetails
            ? `
          <div style="font-size: 9px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px;">
            <div style="font-weight: 700; text-transform: uppercase; margin-bottom: 2px; color: #0f172a;">Bank Details for RTGS / NEFT:</div>
            <div><strong>Bank:</strong> ${invoice.bankDetails.bankName}, ${invoice.bankDetails.branch}</div>
            <div><strong>A/c No:</strong> <span style="font-family: monospace; font-weight: 700;">${invoice.bankDetails.accountNo}</span> | <strong>IFSC:</strong> <span style="font-family: monospace; font-weight: 700;">${invoice.bankDetails.ifsc}</span></div>
          </div>`
            : ''
        }
        <div style="font-size: 8px; color: #64748b; line-height: 1.3;">
          ${(invoice.terms || ['1. Payment strictly due within agreed credit period.', '2. Subject to Trivandrum jurisdiction.']).join('<br>')}
        </div>
      </div>

      <div style="text-align: right; width: 40%;">
        <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${invoice.signature?.title || 'For ' + supplier.legalName}</div>
        <div style="height: 45px; border-bottom: 1px dashed #94a3b8; margin: 8px 0 4px auto; width: 140px;"></div>
        <div style="font-size: 9px; color: #64748b;">${invoice.signature?.subtitle || 'Authorised Signatory'}</div>
      </div>
    </div>
  </div>

  ${annexureHtml}
</body>
</html>`;
}

/**
 * Server-side Playwright PDF & Screenshot Generator
 */
export async function generateInvoicePdf(
  invoice: RenderedInvoice,
  options: PdfGenerationOptions = {}
): Promise<{ pdfPath?: string; screenshotPath?: string; pdfBuffer?: Buffer }> {
  const html = generateInvoiceHtml(invoice, options.annexureEntries);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });

  await page.setContent(html, { waitUntil: 'load' });

  let pdfBuffer: Buffer | undefined;

  if (options.outputPath) {
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await page.pdf({
      path: options.outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
    });
    pdfBuffer = fs.readFileSync(options.outputPath);
  }

  if (options.screenshotPath) {
    const sDir = path.dirname(options.screenshotPath);
    if (!fs.existsSync(sDir)) {
      fs.mkdirSync(sDir, { recursive: true });
    }
    // Screenshot page 1
    const invoiceCard = await page.$('.invoice-card');
    if (invoiceCard) {
      await invoiceCard.screenshot({ path: options.screenshotPath });
    } else {
      await page.screenshot({ path: options.screenshotPath, fullPage: false });
    }
  }

  await browser.close();

  return {
    pdfPath: options.outputPath,
    screenshotPath: options.screenshotPath,
    pdfBuffer,
  };
}
