import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Printer,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { ledgerService, MonthApprovalStatus } from '../../services/ledgerService';
import { formatMinutesToHM } from '../../engine';

interface CustomerApprovalPortalProps {
  onBackToDesk: () => void;
}

export const CustomerApprovalPortal: React.FC<CustomerApprovalPortalProps> = ({ onBackToDesk }) => {
  const [approval, setApproval] = useState<MonthApprovalStatus>(() =>
    ledgerService.getApprovalStatus('vtl', '2026-08')
  );
  const entries = ledgerService.getEntries('vtl', '2026-08');

  // Form states - start strictly empty per security requirement
  const [coordinatorName, setCoordinatorName] = useState('');
  const [coordinatorDesignation, setCoordinatorDesignation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      const updated = ledgerService.approveMonth(
        'vtl',
        '2026-08',
        coordinatorName,
        coordinatorDesignation,
        notes
      );
      setApproval(updated);
      setIsSubmitting(false);
    }, 600);
  };

  const isApproved = approval.status === 'approved';

  // Compute stats
  const runDays = entries.filter((e) => e.dayStatus === 'RUN' || e.dayStatus === 'SUBSTITUTE').length;
  const totalKm = entries.reduce((sum, e) => sum + (e.usedKm || 0), 0);
  const totalExtraMins = entries.reduce((sum, e) => {
    if (e.dayStatus === 'RUN' || e.dayStatus === 'SUBSTITUTE') {
      const dur = e.durationMinutes || 0;
      return sum + Math.max(0, dur - 12 * 60);
    }
    return sum;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToDesk}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Starciti Fleet Desk</span>
          </button>

          <span className="text-xs text-gray-500 font-mono">
            Secure Token: <span className="bg-gray-200 px-2 py-0.5 rounded text-gray-800">{approval.token}</span>
          </span>
        </div>

        {/* Header Document Card */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
              Customer Coordinator Verification Portal
            </span>
            <h1 className="text-2xl font-bold text-gray-900 font-display mt-1">
              Monthly Vehicle Logbook Approval
            </h1>
            <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <span>Customer: <strong>M/S Vindhya Telelinks Ltd</strong></span>
              <span>•</span>
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>Billing Period: <strong>August 2026</strong></span>
            </p>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isApproved
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isApproved ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldCheck className="w-4 h-4 text-amber-600" />}
              <span>{isApproved ? 'Approved by Coordinator' : 'Pending Sign-Off'}</span>
            </span>
          </div>
        </div>

        {/* Highlight Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Contract Working Days</span>
            <span className="text-xl font-bold font-display text-gray-900 mt-1 block">
              {runDays} <span className="text-xs text-gray-400 font-normal">/ 30 Days</span>
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Total Distance Run</span>
            <span className="text-xl font-bold font-mono text-emerald-800 mt-1 block">
              {totalKm.toLocaleString()} <span className="text-xs font-normal text-gray-500">KM</span>
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Extra Hours Worked</span>
            <span className="text-xl font-bold font-mono text-amber-800 mt-1 block">
              {formatMinutesToHM(totalExtraMins)} <span className="text-xs font-normal text-gray-500">HRS</span>
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Vehicle & Driver</span>
            <span className="text-xs font-bold text-gray-900 mt-1 block font-mono">KL01 CP 3284</span>
            <span className="text-[11px] text-gray-500 block">Sujith Kumar S</span>
          </div>
        </div>

        {/* Read-Only Trip Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-display">Daily Trip Ledger Record</h3>
              <p className="text-[11px] text-gray-500">
                Verified daily odometer readings and duty hours submitted by Starciti.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Logbook</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-2.5 py-2.5 text-center">Status</th>
                  <th className="px-2.5 py-2.5 text-right">St. KM</th>
                  <th className="px-2.5 py-2.5 text-right">Cl. KM</th>
                  <th className="px-2.5 py-2.5 text-right font-bold text-emerald-900">Total KM</th>
                  <th className="px-2.5 py-2.5 text-center">Shift Hours</th>
                  <th className="px-2.5 py-2.5 text-center">Night Bata</th>
                  <th className="px-2.5 py-2.5 text-center">Outstation</th>
                  <th className="px-3 py-2.5">Route Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry, idx) => {
                  const isRun = entry.dayStatus === 'RUN' || entry.dayStatus === 'SUBSTITUTE';
                  return (
                    <tr key={entry.date} className={!isRun ? 'bg-gray-50/60 text-gray-400' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                      <td className="px-3 py-2 font-medium text-gray-900">{entry.date}</td>
                      <td className="px-2.5 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isRun ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                          {entry.dayStatus}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono">{entry.startKm ?? '-'}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{entry.closeKm ?? '-'}</td>
                      <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-800">{isRun ? entry.usedKm : '-'}</td>
                      <td className="px-2.5 py-2 text-center font-mono">
                        {isRun && entry.durationMinutes ? formatMinutesToHM(entry.durationMinutes) : '-'}
                      </td>
                      <td className="px-2.5 py-2 text-center font-medium text-gray-700">
                        {entry.nightBata ? '✓ Yes' : '-'}
                      </td>
                      <td className="px-2.5 py-2 text-center font-medium text-gray-700">
                        {entry.outstationBata ? '✓ Yes' : '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 truncate max-w-xs">{entry.remarks || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coordinator Sign-Off Box */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-gray-900 font-display">Coordinator Digital Sign-Off</h3>
          </div>

          {isApproved ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Logbook Approved for Invoice Issuance</span>
              </div>
              <p className="text-xs text-emerald-800">
                Approved by <strong>{approval.approvedBy}</strong> ({approval.coordinatorDesignation}) on{' '}
                {new Date(approval.approvedAt || Date.now()).toLocaleString('en-IN')}.
              </p>
              {approval.notes && (
                <p className="text-xs text-emerald-700 italic border-t border-emerald-200/60 pt-2 mt-2">
                  &ldquo;{approval.notes}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleApprove} className="space-y-4">
              <p className="text-xs text-gray-500">
                By clicking approve, you confirm that the daily run kilometres, duty hours, and outstation travels recorded above match your company site records.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 block">Coordinator Full Name</label>
                  <input
                    type="text"
                    required
                    value={coordinatorName}
                    onChange={(e) => setCoordinatorName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                    placeholder="e.g. Mr. A. Sharma"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 block">Designation / Department</label>
                  <input
                    type="text"
                    required
                    value={coordinatorDesignation}
                    onChange={(e) => setCoordinatorDesignation(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                    placeholder="e.g. Site In-Charge / Project Manager"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 block">Approval Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white"
                  placeholder="Verification remarks..."
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Recording Sign-Off...' : 'Approve Monthly Logbook'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
