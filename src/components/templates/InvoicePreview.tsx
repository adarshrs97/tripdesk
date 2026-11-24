import React from 'react';
import { RenderedInvoice } from '../../engine';
import { CheckCircle2, ShieldCheck, Building2, Phone, Mail, FileText } from 'lucide-react';

interface InvoicePreviewProps {
  invoice: RenderedInvoice;
  compact?: boolean;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, compact = false }) => {
  const isMinimal = invoice.styleTokens?.tableBorder === 'minimal';
  const primaryColor = invoice.styleTokens?.primaryColor || '#0B6E63';

  return (
    <div
      className={`bg-white text-gray-900 border border-gray-200 rounded-xl shadow-lg font-sans transition-all print:shadow-none print:border-none print:m-0 ${
        compact ? 'p-6 max-w-2xl' : 'p-8 max-w-4xl'
      }`}
      style={{ fontFamily: invoice.styleTokens?.fontFamily || 'Inter, sans-serif' }}
    >
      {/* Top Header & Supplier */}
      <div className="border-b border-gray-200 pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-display">
                {invoice.supplier.legalName}
              </h1>
            </div>
            {invoice.supplier.tradeName && (
              <p className="text-sm font-medium text-emerald-800 mt-0.5">
                {invoice.supplier.tradeName}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1 max-w-md leading-relaxed whitespace-pre-line">
              {invoice.supplier.address}
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600 mt-2">
              {invoice.supplier.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {invoice.supplier.phone}
                </span>
              )}
              {invoice.supplier.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {invoice.supplier.email}
                </span>
              )}
              {invoice.supplier.pan && (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono text-[11px]">
                  PAN: {invoice.supplier.pan}
                </span>
              )}
              {invoice.supplier.gstin && (
                <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-mono text-[11px] font-semibold">
                  GSTIN: {invoice.supplier.gstin}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span
              className="inline-block px-3 py-1 rounded-md text-sm font-bold tracking-wider uppercase mb-2"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              {invoice.title}
            </span>
            <div className="text-xs space-y-1 text-gray-600">
              {invoice.metaFields.map((field) => (
                <div key={field.key} className="flex justify-end gap-2">
                  <span className="text-gray-400 font-medium">{field.label}:</span>
                  <span className="font-semibold text-gray-900">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recipient / Billed To Block */}
      <div className="bg-gray-50/70 border border-gray-100 rounded-lg p-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
              Billed To
            </span>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-700" />
              {invoice.customer.name}
            </h2>
            {invoice.customer.tradeName && (
              <p className="text-xs text-gray-600 font-medium">{invoice.customer.tradeName}</p>
            )}
            <p className="text-xs text-gray-500 mt-1 max-w-md whitespace-pre-line">
              {invoice.customer.billingAddress}
            </p>
          </div>
          {invoice.customer.gstin && (
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 block">Customer GSTIN</span>
              <span className="font-mono text-xs font-semibold text-gray-800">{invoice.customer.gstin}</span>
            </div>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto mb-6">
        <table className={`w-full text-xs text-left ${isMinimal ? '' : 'border border-gray-200'}`}>
          <thead className="bg-gray-100 text-gray-700 uppercase font-semibold text-[10px] tracking-wider border-b border-gray-200">
            <tr>
              {invoice.columns.map((col) => (
                <th
                  key={col.id}
                  style={{ width: col.width }}
                  className={`px-3 py-2.5 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } border-r border-gray-200 last:border-r-0`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoice.rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                {row.cells.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-3 py-2 text-gray-800 ${
                      cell.align === 'right'
                        ? 'text-right font-medium'
                        : cell.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } border-r border-gray-100 last:border-r-0`}
                  >
                    {cell.formattedText}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Breakup Box & Totals Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left: Breakup or Notes */}
        <div>
          {invoice.breakupRows.length > 0 ? (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/40">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-2">
                Contract Calculation Breakup
              </span>
              <div className="space-y-1.5 text-xs">
                {invoice.breakupRows.map((b) => (
                  <div key={b.id} className="flex justify-between items-center text-gray-700 border-b border-gray-100 pb-1 last:border-b-0">
                    <span>{b.label}</span>
                    <span className="font-semibold text-gray-900">{b.formattedText}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic p-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              All items calculated pro-rata per confirmed contract terms.
            </div>
          )}
        </div>

        {/* Right: Totals Box */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Subtotal:</span>
            <span className="font-medium text-gray-900">
              ₹{invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {invoice.roundOff !== 0 && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Round Off (Down):</span>
              <span className="font-mono text-gray-700">
                {invoice.roundOff > 0 ? `+₹${invoice.roundOff.toFixed(2)}` : `-₹${Math.abs(invoice.roundOff).toFixed(2)}`}
              </span>
            </div>
          )}

          <div className="border-t border-gray-300 pt-2 flex justify-between items-baseline">
            <span className="text-sm font-bold text-gray-900">Total Payable:</span>
            <span
              className="text-xl font-bold font-display"
              style={{ color: primaryColor }}
            >
              ₹{invoice.totalAmount.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="border-t border-gray-200 pt-2">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
              Amount in Words
            </span>
            <p className="text-xs font-semibold text-gray-800 leading-snug">
              {invoice.amountInWords}
            </p>
          </div>
        </div>
      </div>

      {/* Footer: Bank Details & Signature */}
      <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
        <div>
          {invoice.bankDetails && (
            <div className="text-xs text-gray-600 space-y-0.5 bg-gray-50/70 p-3 rounded border border-gray-200">
              <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block mb-1">
                Bank & Payment Details
              </span>
              <p><span className="text-gray-400">Account Name:</span> <strong className="text-gray-800">{invoice.bankDetails.accountName}</strong></p>
              <p><span className="text-gray-400">Bank & Branch:</span> {invoice.bankDetails.bankName}, {invoice.bankDetails.branch}</p>
              <p><span className="text-gray-400">Account No:</span> <strong className="font-mono text-gray-900">{invoice.bankDetails.accountNo}</strong></p>
              <p><span className="text-gray-400">IFSC Code:</span> <strong className="font-mono text-gray-900">{invoice.bankDetails.ifsc}</strong></p>
            </div>
          )}

          {invoice.terms.length > 0 && (
            <div className="mt-3 text-[10px] text-gray-500 space-y-0.5">
              {invoice.terms.map((t, idx) => (
                <p key={idx}>{t}</p>
              ))}
            </div>
          )}
        </div>

        <div className="text-right flex flex-col items-end">
          <p className="text-xs font-semibold text-gray-800">{invoice.signature.title}</p>
          <div className="h-14 w-32 border-b border-gray-400 border-dashed mb-1 flex items-end justify-center">
            <ShieldCheck className="w-5 h-5 text-gray-300 mb-1" />
          </div>
          <p className="text-[11px] text-gray-500">{invoice.signature.subtitle}</p>
        </div>
      </div>

      {invoice.annexure.attachLedger && (
        <div className="mt-4 pt-3 border-t border-gray-100 text-right">
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 font-medium bg-emerald-50 px-2 py-0.5 rounded">
            <FileText className="w-3 h-3" />
            Verified Daily Trip Logbook attached as Annexure
          </span>
        </div>
      )}
    </div>
  );
};
