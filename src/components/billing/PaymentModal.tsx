import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { PaymentMode } from '../../types';
import { PaymentService } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';

interface PaymentModalProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    customerId: string;
    customerPan?: string | null;
    defaultTdsRate?: number | null;
    totalAmount: number;
    totalPaid: number;
    totalTds: number;
    outstandingBalance: number;
  };
  onClose: () => void;
  onPaymentRecorded: () => void;
}

function getPanCategory(pan?: string | null): { code: string; label: string; defaultRate?: number } {
  if (!pan || pan.length < 4) {
    return { code: 'UNKNOWN', label: 'Unspecified Category (Confirm with CA)' };
  }
  const fourthChar = pan.charAt(3).toUpperCase();
  switch (fourthChar) {
    case 'C':
      return { code: 'COMPANY', label: 'Company / Corporate (Sec 194C standard 2%)', defaultRate: 2.0 };
    case 'P':
      return { code: 'INDIVIDUAL', label: 'Individual / Proprietorship (Sec 194C standard 1%)', defaultRate: 1.0 };
    case 'H':
      return { code: 'HUF', label: 'Hindu Undivided Family (Sec 194C standard 1%)', defaultRate: 1.0 };
    case 'F':
      return { code: 'FIRM', label: 'Partnership Firm / LLP (Sec 194C standard 2%)', defaultRate: 2.0 };
    case 'T':
      return { code: 'TRUST', label: 'Trust (Sec 194C)' };
    case 'A':
      return { code: 'AOP', label: 'Association of Persons' };
    default:
      return { code: fourthChar, label: `PAN Category '${fourthChar}' (Confirm with CA)` };
  }
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, onClose, onPaymentRecorded }) => {
  const { currentUser } = useAuth();
  const panCategory = getPanCategory(invoice.customerPan);

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState<PaymentMode>('bank_transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  // TDS controls: No pre-selected default unless configured per customer
  const initialRate = invoice.defaultTdsRate !== undefined && invoice.defaultTdsRate !== null
    ? invoice.defaultTdsRate
    : null;

  const [applyTds, setApplyTds] = useState(initialRate !== null && initialRate > 0);
  const [tdsRate, setTdsRate] = useState<number | null>(initialRate);
  const [customRateInput, setCustomRateInput] = useState<string>('');
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [amountReceived, setAmountReceived] = useState<number>(invoice.outstandingBalance);
  const [tdsDeducted, setTdsDeducted] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recalculate amounts when rate or applyTds changes
  useEffect(() => {
    const bal = invoice.outstandingBalance;
    const effectiveRate = isCustomRate ? parseFloat(customRateInput) || 0 : (tdsRate || 0);

    if (applyTds && effectiveRate > 0) {
      const calculatedTds = Math.round(bal * (effectiveRate / 100) * 100) / 100;
      const netReceived = Math.round((bal - calculatedTds) * 100) / 100;
      setTdsDeducted(calculatedTds);
      setAmountReceived(netReceived);
    } else {
      setTdsDeducted(0);
      setAmountReceived(bal);
    }
  }, [invoice.outstandingBalance, applyTds, tdsRate, isCustomRate, customRateInput]);

  const totalSettled = (Number(amountReceived) || 0) + (applyTds ? (Number(tdsDeducted) || 0) : 0);
  const remainingBalance = Math.max(0, invoice.outstandingBalance - totalSettled);
  const isOverpayment = totalSettled > invoice.outstandingBalance;
  const excessAmount = isOverpayment ? totalSettled - invoice.outstandingBalance : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountReceived <= 0 && tdsDeducted <= 0) {
      setErrorMsg('Payment amount received or TDS must be greater than zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await PaymentService.recordPayment({
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        paymentDate,
        amountReceived: Number(amountReceived),
        tdsDeducted: applyTds ? Number(tdsDeducted) : 0,
        tdsRate: applyTds ? Number(tdsRate) : 0,
        mode,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        createdBy: currentUser?.name || 'Staff',
      });

      onPaymentRecorded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 font-display text-sm">Record Customer Payment</h3>
              <p className="text-[11px] text-gray-500">Invoice #{invoice.invoiceNumber} • {invoice.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>

        {/* Invoice Balance Summary Banner */}
        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-[10px] text-gray-500 uppercase">Total Billed</span>
            <div className="font-bold text-gray-900 mt-0.5">₹{invoice.totalAmount.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase">Previously Paid</span>
            <div className="font-bold text-emerald-700 mt-0.5">
              ₹{(invoice.totalPaid + invoice.totalTds).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase">Balance Due</span>
            <div className="font-bold text-red-700 mt-0.5">₹{invoice.outstandingBalance.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Payment Mode *</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as PaymentMode)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="upi">UPI (GPay / PhonePe / QR)</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Reference / UTR / Cheque Number
            </label>
            <input
              type="text"
              placeholder="e.g. UTR20260901004928"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* TDS Section: User Controlled, CA Advisory, PAN Category */}
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-semibold text-emerald-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyTds}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setApplyTds(checked);
                    if (checked && tdsRate === null && !isCustomRate) {
                      // Set default if available from PAN category, else 2.0%
                      setTdsRate(panCategory.defaultRate || 2.0);
                    }
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Customer Deducted TDS (Tax Deducted at Source)</span>
              </label>

              {invoice.customerPan && (
                <span className="text-[10px] bg-white border border-emerald-200 px-2 py-0.5 rounded-md font-mono text-emerald-900 font-semibold">
                  PAN: {invoice.customerPan}
                </span>
              )}
            </div>

            {/* Deductee PAN Category & CA Advisory Notice */}
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500 font-medium">Deductee PAN Category:</span>
                <span className="font-semibold text-emerald-900">{panCategory.label}</span>
              </div>
              <p className="text-[10px] text-amber-800 bg-amber-50/80 p-1.5 rounded border border-amber-200/60 leading-tight">
                ⚠️ <strong>Confirm with your CA:</strong> Rate suggestions are operational guidelines based on Section 194C. Confirm applicable withholding rates with your chartered accountant.
              </p>
            </div>

            {applyTds && (
              <div className="space-y-2.5 pt-1">
                {/* Rate Selection Chips */}
                <div>
                  <span className="text-[11px] font-semibold text-gray-700 block mb-1.5">
                    Select TDS Withholding Rate:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1.0, 2.0, 5.0, 10.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setIsCustomRate(false);
                          setTdsRate(rate);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                          !isCustomRate && tdsRate === rate
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {rate.toFixed(1)}% {rate === 1.0 ? '(Individual)' : rate === 2.0 ? '(Company)' : ''}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsCustomRate(true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        isCustomRate
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Custom %
                    </button>
                  </div>
                </div>

                {/* Custom Rate Input */}
                {isCustomRate && (
                  <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-200">
                    <span className="text-[11px] text-gray-600 font-medium">Custom Rate:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="e.g. 0.75"
                      value={customRateInput}
                      onChange={(e) => setCustomRateInput(e.target.value)}
                      className="border border-emerald-300 rounded px-2 py-0.5 text-xs w-24 font-mono font-bold"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] text-gray-600 block mb-1">Net Received in Bank (₹)</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                      className="w-full border border-emerald-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-600 block mb-1">TDS Deducted (₹)</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={tdsDeducted}
                      onChange={(e) => setTdsDeducted(parseFloat(e.target.value) || 0)}
                      className="w-full border border-emerald-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {!applyTds && (
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Amount Received (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amountReceived}
                onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {/* Breakdown & Overpayment Notices */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-gray-600">
              <span>Total Settled Against Invoice:</span>
              <span className="font-bold font-mono text-gray-900">₹{totalSettled.toLocaleString('en-IN')}/-</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Remaining Balance After Payment:</span>
              <span className={`font-bold font-mono ${remainingBalance === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                ₹{remainingBalance.toLocaleString('en-IN')}/- {remainingBalance === 0 ? '(Fully Paid)' : '(Partially Paid)'}
              </span>
            </div>

            {isOverpayment && (
              <div className="bg-amber-100/70 p-2 rounded-lg text-amber-900 mt-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                <span>
                  <strong>Overpayment:</strong> ₹{excessAmount.toLocaleString('en-IN')} excess will be credited to {invoice.customerName}'s account balance.
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Office Remarks / Notes</label>
            <input
              type="text"
              placeholder="e.g. Cleared via HDFC Bank statement line item"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Record Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
