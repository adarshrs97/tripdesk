import React, { useState, useEffect } from 'react';
import { Printer } from 'lucide-react';
import { CustomerStatementRow, ReceivablesAgeingBucket } from '../../types';

interface CustomerStatementModalProps {
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    billingAddress?: string;
    gstin?: string | null;
    pan?: string | null;
  };
  onClose: () => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({ customer, onClose }) => {
  const [statementData, setStatementData] = useState<{
    openingBalance: number;
    rows: CustomerStatementRow[];
    closingBalance: number;
    ageing: ReceivablesAgeingBucket;
  } | null>(null);

  useEffect(() => {
    // Generate statement rows from customer data
    const rows: CustomerStatementRow[] = [
      {
        date: '2026-08-31',
        type: 'invoice',
        referenceNo: '108191',
        description: 'Monthly Car Rental Charges - August 2026 (KL-01-CP-3284)',
        debit: 68662.0,
        credit: 0,
        runningBalance: 68662.0,
      },
    ];

    setStatementData({
      openingBalance: 0,
      rows,
      closingBalance: 68662.0,
      ageing: {
        current: 68662.0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        totalOutstanding: 68662.0,
      },
    });
  }, [customer.id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
              <h2 className="text-xl font-bold font-display text-gray-900">
                Customer Statement of Account
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              M/S CITY TOURS & TRAVELS • Killipalam, Trivandrum, Kerala
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 px-2 py-1 text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Customer & Statement Meta */}
        <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Billed To:</span>
            <div className="font-bold text-gray-900 text-sm">{customer.name}</div>
            <div className="text-gray-600 text-[11px] leading-relaxed">
              {customer.billingAddress || 'CC No. 40/1072A, Palarivattom, Cochin, Kerala'}
            </div>
            {customer.gstin && (
              <div className="text-gray-500 text-[11px]">
                GSTIN: <span className="font-mono text-gray-800">{customer.gstin}</span>
              </div>
            )}
          </div>

          <div className="text-right space-y-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Statement Summary</span>
            <div>Date: <strong className="text-gray-900">{new Date().toISOString().split('T')[0]}</strong></div>
            <div>Period: <strong className="text-gray-900">01/08/2026 to 31/08/2026</strong></div>
            <div className="pt-1 text-sm font-bold text-emerald-800">
              Net Outstanding: ₹{(statementData?.closingBalance || 0).toLocaleString('en-IN')}/-
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/80 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Doc #</th>
                <th className="py-2.5 px-3">Transaction Description</th>
                <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                <th className="py-2.5 px-3 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statementData?.rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">{r.date}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{r.referenceNo}</td>
                  <td className="py-2.5 px-3 text-gray-700">{r.description}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-gray-900">
                    {r.debit > 0 ? `₹${r.debit.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                    {r.credit > 0 ? `₹${r.credit.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">
                    ₹{r.runningBalance.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ageing Breakdown Footer */}
        {statementData && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              Receivables Ageing Analysis
            </span>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">Current</span>
                <span className="font-bold text-emerald-700">₹{statementData.ageing.current.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">1-30 Days</span>
                <span className="font-bold text-gray-700">₹{statementData.ageing.days1to30.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">31-60 Days</span>
                <span className="font-bold text-amber-700">₹{statementData.ageing.days31to60.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">61-90 Days</span>
                <span className="font-bold text-orange-700">₹{statementData.ageing.days61to90.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">90+ Days</span>
                <span className="font-bold text-red-700">₹{statementData.ageing.days90plus.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-gray-400 pt-2 border-t border-gray-100">
          Starciti Fleet & Billing Desk • Computer generated statement • Valid without physical signature
        </div>
      </div>
    </div>
  );
};
