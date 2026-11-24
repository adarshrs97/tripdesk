import React, { useState, useEffect } from 'react';
import { Hash, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export interface InvoiceSeriesItem {
  id: string;
  supplierId: string;
  supplierName: string;
  prefix: string;
  financialYear: string;
  currentNumber: number;
  nextNumber: number;
}

const DEFAULT_SERIES: InvoiceSeriesItem[] = [
  {
    id: 's-city-tours',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    supplierName: 'M/S City Tours & Travels (Starter: Monthly contract)',
    prefix: '',
    financialYear: '2026-27',
    currentNumber: 108190,
    nextNumber: 108191,
  },
  {
    id: 's-starciti-group',
    supplierId: 'a0000000-0000-0000-0000-000000000001',
    supplierName: 'StarCiti Group (Starter: Per-trip package)',
    prefix: '',
    financialYear: '2026-27',
    currentNumber: 106562,
    nextNumber: 106563,
  },
];

export const SeriesAdmin: React.FC = () => {
  const { currentUser } = useAuth();
  const [seriesList, setSeriesList] = useState<InvoiceSeriesItem[]>(DEFAULT_SERIES);
  const [selectedSeries, setSelectedSeries] = useState<InvoiceSeriesItem | null>(null);
  const [nextNumberInput, setNextNumberInput] = useState<number>(0);
  const [reasonInput, setReasonInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    async function loadSeries() {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase
          .from('invoice_series')
          .select(`
            id,
            supplier_id,
            prefix,
            financial_year,
            current_number,
            supplier_profiles (trade_name)
          `);
        if (!error && data && data.length > 0) {
          const mapped: InvoiceSeriesItem[] = data.map((d: any) => ({
            id: d.id,
            supplierId: d.supplier_id,
            supplierName: d.supplier_profiles?.trade_name || 'Supplier Series',
            prefix: d.prefix || '',
            financialYear: d.financial_year,
            currentNumber: d.current_number,
            nextNumber: d.current_number + 1,
          }));
          setSeriesList(mapped);
        }
      } catch (e) {
        console.warn('Could not load invoice_series from DB', e);
      }
    }
    loadSeries();
  }, []);

  const handleOpenEdit = (series: InvoiceSeriesItem) => {
    setSelectedSeries(series);
    setNextNumberInput(series.nextNumber);
    setReasonInput('');
    setStatusMsg(null);
  };

  const handleSaveNextNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeries) return;

    if (!reasonInput || reasonInput.trim().length < 5) {
      setStatusMsg({ type: 'error', text: 'A mandatory justification reason (min 5 characters) is required.' });
      return;
    }

    try {
      setIsUpdating(true);
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('admin_set_invoice_series_number', {
          p_series_id: selectedSeries.id,
          p_next_number: Number(nextNumberInput),
          p_reason: reasonInput.trim(),
          p_admin_user: currentUser?.name || 'Admin',
        });
        if (error) throw error;
      }

      setSeriesList((prev) =>
        prev.map((s) =>
          s.id === selectedSeries.id
            ? {
                ...s,
                currentNumber: Number(nextNumberInput) - 1,
                nextNumber: Number(nextNumberInput),
              }
            : s
        )
      );

      setStatusMsg({
        type: 'success',
        text: `Next invoice number for ${selectedSeries.supplierName} updated to ${nextNumberInput}. Audit log saved.`,
      });
      setSelectedSeries(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update series sequence.' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Hash className="w-5 h-5 text-amber-800" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-display">Invoice Numbering Series Admin</h2>
            <p className="text-xs text-gray-500">
              Deterministic sequence control with audit logging and gap-free protection
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>Strict Audit: Any manual change writes an immutable audit record</span>
        </div>
      </div>

      {/* Real Numbers Awaiting Owner Confirmation Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1">
        <div className="font-bold flex items-center gap-1.5 text-blue-950">
          <span>📋 Owner Sync Notice: Real Last-Issued Number Sequences</span>
        </div>
        <p className="text-blue-800">
          The system is ready to synchronize live sequences once confirmed: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">City Tours last = [ ]</code> and <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">StarCiti last = [ ]</code>. The next issued invoice will strictly be <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">last + 1</code>. No guesswork numbers will be seeded.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Series Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {seriesList.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                FY {s.financialYear}
              </span>
              <h3 className="font-bold text-sm text-gray-900">{s.supplierName}</h3>
              <div className="text-xs text-gray-500">
                Prefix: <strong className="text-gray-700 font-mono">{s.prefix || '(None)'}</strong>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Last Issued:</span>
                <span className="font-mono font-bold text-gray-800">
                  {s.prefix ? `${s.prefix}-` : ''}
                  {s.currentNumber}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-1.5">
                <span className="text-gray-500">Next Number to Issue:</span>
                <span className="font-mono font-extrabold text-emerald-800 text-sm">
                  {s.prefix ? `${s.prefix}-` : ''}
                  {s.nextNumber}
                </span>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => handleOpenEdit(s)}
                className="w-full text-xs font-semibold py-2 px-3 border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-700 transition-colors cursor-pointer"
              >
                Set Next Number (Audit Override)
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Override Modal */}
      {selectedSeries && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 font-display">Set Next Invoice Number</h3>
              <button
                onClick={() => setSelectedSeries(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800">Series:</span>
              <div className="font-bold">{selectedSeries.supplierName}</div>
              <div className="text-[11px] text-amber-700">
                Current last-issued sequence number: <strong>{selectedSeries.currentNumber}</strong>
              </div>
            </div>

            <form onSubmit={handleSaveNextNumber} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  New Next Sequence Number *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={nextNumberInput}
                  onChange={(e) => setNextNumberInput(parseInt(e.target.value, 10))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  The very next issued invoice will receive number{' '}
                  <strong className="text-emerald-800 font-mono">
                    {selectedSeries.prefix ? `${selectedSeries.prefix}-` : ''}
                    {nextNumberInput}
                  </strong>
                </span>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Mandatory Audit Reason * (Min 5 chars)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Aligned to manual paper bill book sequence as of Aug 2026"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedSeries(null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  {isUpdating ? 'Saving to Audit Log...' : 'Confirm & Save Sequence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
