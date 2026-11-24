import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { PaymentService } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';

interface CreditDebitNoteModalProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    totalAmount: number;
    outstandingBalance: number;
  };
  onClose: () => void;
  onNoteCreated: () => void;
}

export const CreditDebitNoteModal: React.FC<CreditDebitNoteModalProps> = ({
  invoice,
  onClose,
  onNoteCreated,
}) => {
  const { currentUser } = useAuth();
  const [noteType, setNoteType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setErrorMsg('Note adjustment amount must be greater than zero.');
      return;
    }
    if (!reason || reason.trim().length < 5) {
      setErrorMsg('A mandatory justification reason (min 5 characters) is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await PaymentService.issueCreditDebitNote({
        originalInvoiceId: invoice.id,
        noteType,
        amount: Number(amount),
        reason: reason.trim(),
        createdBy: currentUser?.name || 'Staff',
      });

      onNoteCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to issue Credit/Debit Note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              noteType === 'credit' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {noteType === 'credit' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 font-display text-sm">Issue Credit / Debit Note</h3>
              <p className="text-[11px] text-gray-500">Linked to Invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Note Type Selector */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Adjustment Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNoteType('credit')}
                className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                  noteType === 'credit'
                    ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Credit Note (CN)
                <span className="block text-[10px] font-normal text-gray-500">Reduces Amount Due</span>
              </button>
              <button
                type="button"
                onClick={() => setNoteType('debit')}
                className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                  noteType === 'debit'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Debit Note (DN)
                <span className="block text-[10px] font-normal text-gray-500">Increases Amount Due</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Adjustment Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              required
              min="1"
              placeholder="e.g. 500"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Mandatory Justification Reason * (Min 5 chars)
            </label>
            <textarea
              required
              rows={3}
              placeholder={
                noteType === 'credit'
                  ? 'e.g. Rate adjustment agreed for holiday duty concession per email dated 28/08'
                  : 'e.g. Toll and permit charges omission from initial invoice Annexure'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1 text-[11px] text-gray-600">
            <div className="flex justify-between">
              <span>Original Billed Amount:</span>
              <span className="font-mono font-semibold">₹{invoice.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Outstanding:</span>
              <span className="font-mono font-semibold text-gray-900">₹{invoice.outstandingBalance.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 text-gray-800 font-bold">
              <span>Estimated New Balance:</span>
              <span className="font-mono text-emerald-800">
                ₹{Math.max(
                  0,
                  invoice.outstandingBalance + (noteType === 'debit' ? Number(amount) : -Number(amount))
                ).toLocaleString('en-IN')}
              </span>
            </div>
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
              className={`px-5 py-2 text-white rounded-xl font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 ${
                noteType === 'credit' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-amber-700 hover:bg-amber-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Issuing Note...' : `Issue ${noteType === 'credit' ? 'Credit' : 'Debit'} Note`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
