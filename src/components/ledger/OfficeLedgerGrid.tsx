import React, { useState, useMemo } from 'react';
import {
  DayLedgerEntry,
  detectLedgerAnomalies,
  calculateTripDurationMinutes,
  formatMinutesToHM,
  parseTimeString,
  LedgerAnomaly,
} from '../../engine';
import { ledgerService, MonthApprovalStatus } from '../../services/ledgerService';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Smartphone,
  Check,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { ExcelImportWizard } from './ExcelImportWizard';

interface OfficeLedgerGridProps {
  onOpenDriverView: () => void;
  onOpenCustomerApproval: () => void;
  onOpenMonthClose?: () => void;
}

export const OfficeLedgerGrid: React.FC<OfficeLedgerGridProps> = ({
  onOpenDriverView,
  onOpenCustomerApproval,
  onOpenMonthClose,
}) => {
  const [entries, setEntries] = useState<DayLedgerEntry[]>(() => ledgerService.getEntries('vtl', '2026-08'));
  const [approvalStatus] = useState<MonthApprovalStatus>(() =>
    ledgerService.getApprovalStatus('vtl', '2026-08')
  );

  // Anomaly review drawer state
  const [isAnomalyDrawerOpen, setIsAnomalyDrawerOpen] = useState(false);
  const [acknowledgedAnomalies, setAcknowledgedAnomalies] = useState<Set<string>>(new Set());

  // WhatsApp share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Excel Import Wizard view state
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  // KM gap threshold (default 15 km from confirmed settings)
  const kmGapThreshold = 15;
  const includedHoursPerDay = 12;

  // Run anomaly detection
  const anomalies = useMemo(() => {
    return detectLedgerAnomalies(entries, { kmGapThreshold, maxDailyHours: 16 });
  }, [entries, kmGapThreshold]);

  const activeAnomalies = useMemo(() => {
    return anomalies.filter((a) => !acknowledgedAnomalies.has(a.id));
  }, [anomalies, acknowledgedAnomalies]);

  // Lookup anomalies by entry date
  const anomaliesByDate = useMemo(() => {
    const map = new Map<string, LedgerAnomaly[]>();
    for (const a of anomalies) {
      const list = map.get(a.entryDate) || [];
      list.push(a);
      map.set(a.entryDate, list);
    }
    return map;
  }, [anomalies]);

  // Handle cell edit
  const handleCellChange = (date: string, field: keyof DayLedgerEntry, value: any) => {
    setEntries((prev) => {
      const updated = prev.map((entry) => {
        if (entry.date !== date) return entry;

        const next: DayLedgerEntry = { ...entry, [field]: value };

        // Recalculate KM if start or close changed
        if (field === 'startKm' || field === 'closeKm') {
          const stVal = field === 'startKm' ? (value === '' ? null : Number(value)) : (entry.startKm ?? null);
          const clVal = field === 'closeKm' ? (value === '' ? null : Number(value)) : (entry.closeKm ?? null);
          if (stVal !== null && clVal !== null && !isNaN(stVal) && !isNaN(clVal)) {
            next.usedKm = Math.max(0, clVal - stVal);
          }
        }

        // Recalculate duration & extra hours if times changed
        if (field === 'startTime' || field === 'closeTime') {
          const stTime = field === 'startTime' ? value : entry.startTime;
          const clTime = field === 'closeTime' ? value : entry.closeTime;
          if (stTime && clTime) {
            try {
              const dur = calculateTripDurationMinutes(stTime, clTime, entry.endsNextDay);
              next.durationMinutes = dur;

              // Auto-suggest night bata if start < 06:00 or close > 22:00
              const sMin = parseTimeString(stTime);
              const cMin = parseTimeString(clTime);
              if (sMin < 360 || cMin > 1320) {
                // If not explicitly set, auto-suggest
                if (next.nightBata === undefined) {
                  next.nightBata = true;
                }
              }
            } catch {
              // Ignore partial time parsing
            }
          }
        }

        // If status changed to Sunday/Holiday/No Run, clear run values
        if (field === 'dayStatus' && value !== 'RUN' && value !== 'SUBSTITUTE') {
          next.usedKm = 0;
          next.durationMinutes = 0;
        }

        return next;
      });

      return updated;
    });
  };

  // Auto-fill Start KM from preceding Close KM
  const handleAutoFillStartKm = (date: string, rowIndex: number) => {
    if (rowIndex === 0) return;
    // Find previous day with a close KM
    for (let i = rowIndex - 1; i >= 0; i--) {
      const prev = entries[i];
      if (prev.closeKm !== null && prev.closeKm !== undefined) {
        handleCellChange(date, 'startKm', prev.closeKm);
        break;
      }
    }
  };

  // Summary aggregation calculations
  const totals = useMemo(() => {
    let runDays = 0;
    let totalKm = 0;
    let totalExtraMinutes = 0;
    let nightBataDays = 0;
    let outstationBataDays = 0;
    let totalPermit = 0;

    for (const e of entries) {
      if (e.dayStatus === 'RUN' || e.dayStatus === 'SUBSTITUTE') {
        runDays++;
        totalKm += e.usedKm || 0;

        const dur = e.durationMinutes || 0;
        const extraMins = Math.max(0, dur - includedHoursPerDay * 60);
        totalExtraMinutes += extraMins;

        if (e.nightBata) nightBataDays++;
        if (e.outstationBata) outstationBataDays++;
        totalPermit += (e.permit || 0) + (e.toll || 0);
      }
    }

    const extraHoursDecimal = Math.round((totalExtraMinutes / 60) * 100) / 100;
    const extraHoursAmount = extraHoursDecimal * 150;
    const nightBataAmount = nightBataDays * 200;
    const outstationBataAmount = outstationBataDays * 200;
    const fixedAmount = 65000;
    const estimatedTotal = Math.floor(
      fixedAmount + extraHoursAmount + nightBataAmount + outstationBataAmount + totalPermit
    );

    return {
      runDays,
      totalKm,
      totalExtraMinutes,
      extraHoursFormatted: formatMinutesToHM(totalExtraMinutes),
      extraHoursAmount,
      nightBataDays,
      nightBataAmount,
      outstationBataDays,
      outstationBataAmount,
      totalPermit,
      estimatedTotal,
    };
  }, [entries, includedHoursPerDay]);

  const approvalUrl = `https://starciti.desk/approve/${approvalStatus.token}`;

  const copyApprovalUrl = () => {
    navigator.clipboard?.writeText(approvalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (isImportWizardOpen) {
    return (
      <ExcelImportWizard
        onImportComplete={() => {
          setIsImportWizardOpen(false);
          setEntries(ledgerService.getEntries('vtl', '2026-08'));
        }}
        onCancel={() => setIsImportWizardOpen(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Context Controls */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 font-display">Daily Trip Ledger</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  August 2026
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Contract: <strong>VTL Dedicated Car</strong> (KL01 CP 3284 • Sujith Kumar S) — M/S Vindhya Telelinks Ltd
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Anomaly Badge */}
          {activeAnomalies.length > 0 ? (
            <button
              onClick={() => setIsAnomalyDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{activeAnomalies.length} Flagged Anomalies</span>
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Continuity & Hours Verified
            </span>
          )}

          {/* Customer Approval Status Pill */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition border ${
              approvalStatus.status === 'approved'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>
              {approvalStatus.status === 'approved'
                ? `Approved by ${approvalStatus.approvedBy || 'Coordinator'}`
                : 'Share WhatsApp Sign-Off'}
            </span>
          </button>

          {/* Driver PWA View Button */}
          <button
            onClick={onOpenDriverView}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-medium transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-gray-600" />
            <span>Driver PWA View</span>
          </button>

          {/* Excel Import Wizard Button */}
          <button
            onClick={() => setIsImportWizardOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Excel Logbook</span>
          </button>

          {/* Month Close Button */}
          {onOpenMonthClose && (
            <button
              onClick={onOpenMonthClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Generate Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 31-Day Ledger Table (Office View matching Excel Aug Sheet) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10 border-b border-gray-200 shadow-xs">
              <tr>
                <th className="px-2.5 py-3 text-center w-12 border-r border-gray-200">Day</th>
                <th className="px-3 py-3 w-28 border-r border-gray-200">Date</th>
                <th className="px-2.5 py-3 w-28 border-r border-gray-200 text-center">Status</th>
                <th className="px-2.5 py-3 text-right w-24 border-r border-gray-200">St. KM</th>
                <th className="px-2.5 py-3 text-right w-24 border-r border-gray-200">Cl. KM</th>
                <th className="px-2.5 py-3 text-right w-20 border-r border-gray-200 bg-emerald-50/50 text-emerald-950 font-bold">Total KM</th>
                <th className="px-2.5 py-3 text-center w-20 border-r border-gray-200">St. Time</th>
                <th className="px-2.5 py-3 text-center w-20 border-r border-gray-200">Cl. Time</th>
                <th className="px-2.5 py-3 text-center w-20 border-r border-gray-200">Total Hrs</th>
                <th className="px-2.5 py-3 text-center w-20 border-r border-gray-200 bg-amber-50/50 text-amber-950 font-bold">Extra Hrs</th>
                <th className="px-2 py-3 text-center w-16 border-r border-gray-200">Night</th>
                <th className="px-2 py-3 text-center w-16 border-r border-gray-200">Outstn</th>
                <th className="px-2.5 py-3 text-right w-20 border-r border-gray-200">Permit</th>
                <th className="px-3 py-3 border-r border-gray-200">Remarks / Route</th>
                <th className="px-2 py-3 text-center w-10">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {entries.map((entry, idx) => {
                const dateObj = new Date(entry.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = dateObj.getDate();
                const isRun = entry.dayStatus === 'RUN' || entry.dayStatus === 'SUBSTITUTE';
                const rowAnomalies = anomaliesByDate.get(entry.date) || [];
                const durMinutes = entry.durationMinutes || 0;
                const extraMinutes = Math.max(0, durMinutes - includedHoursPerDay * 60);

                return (
                  <tr
                    key={entry.date}
                    className={`transition-colors ${
                      !isRun
                        ? 'bg-gray-100/70 text-gray-400'
                        : rowAnomalies.length > 0
                        ? 'bg-amber-50/30 hover:bg-amber-50/50'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-gray-50'
                        : 'bg-gray-50/40 hover:bg-gray-100/50'
                    }`}
                  >
                    {/* Day Number */}
                    <td className="px-2 py-2 text-center font-mono font-semibold text-gray-500 border-r border-gray-100">
                      {dayNum}
                    </td>

                    {/* Date & Weekday */}
                    <td className="px-3 py-2 border-r border-gray-100 font-medium text-gray-800 whitespace-nowrap">
                      <span>{entry.date}</span>
                      <span className={`ml-1.5 text-[10px] font-bold ${dayName === 'Sun' ? 'text-red-600' : 'text-gray-600'}`}>
                        ({dayName})
                      </span>
                    </td>

                    {/* Day Status */}
                    <td className="px-2 py-1.5 border-r border-gray-100">
                      <select
                        value={entry.dayStatus}
                        onChange={(e) => handleCellChange(entry.date, 'dayStatus', e.target.value)}
                        aria-label={`Day status for ${entry.date}`}
                        className={`w-full text-xs font-semibold rounded px-1.5 py-1 border transition ${
                          entry.dayStatus === 'RUN'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : entry.dayStatus === 'SUNDAY'
                            ? 'bg-gray-200 text-gray-700 border-gray-300'
                            : entry.dayStatus === 'HOLIDAY'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        <option value="RUN">Run</option>
                        <option value="SUNDAY">Sunday</option>
                        <option value="HOLIDAY">Holiday (Onam)</option>
                        <option value="NO_RUN">No Run</option>
                        <option value="LEAVE">Driver Leave</option>
                        <option value="BREAKDOWN">Breakdown</option>
                        <option value="SUBSTITUTE">Substitute</option>
                      </select>
                    </td>

                    {/* Start KM with double click auto-fill */}
                    <td className="px-1.5 py-1 border-r border-gray-100 text-right">
                      {isRun ? (
                        <div className="relative group">
                          <input
                            type="number"
                            value={entry.startKm ?? ''}
                            onChange={(e) => handleCellChange(entry.date, 'startKm', e.target.value)}
                            onDoubleClick={() => handleAutoFillStartKm(entry.date, idx)}
                            aria-label={`Start KM for ${entry.date}`}
                            className="w-full text-right font-mono text-xs font-medium border border-transparent hover:border-gray-300 focus:border-emerald-500 rounded px-1.5 py-0.5 bg-transparent focus:bg-white text-gray-800"
                            placeholder="St KM"
                            title="Double-click to auto-fill from previous close KM"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Close KM */}
                    <td className="px-1.5 py-1 border-r border-gray-100 text-right">
                      {isRun ? (
                        <input
                          type="number"
                          value={entry.closeKm ?? ''}
                          onChange={(e) => handleCellChange(entry.date, 'closeKm', e.target.value)}
                          aria-label={`Close KM for ${entry.date}`}
                          className="w-full text-right font-mono text-xs font-medium border border-transparent hover:border-gray-300 focus:border-emerald-500 rounded px-1.5 py-0.5 bg-transparent focus:bg-white text-gray-800"
                          placeholder="Cl KM"
                        />
                      ) : (
                        <span className="text-gray-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Total KM (Computed) */}
                    <td className="px-2.5 py-2 border-r border-gray-100 text-right font-mono font-bold bg-emerald-50/20 text-emerald-900">
                      {isRun ? (entry.usedKm !== null && entry.usedKm !== undefined ? entry.usedKm : 0) : 0}
                    </td>

                    {/* Start Time */}
                    <td className="px-1.5 py-1 border-r border-gray-100 text-center">
                      {isRun ? (
                        <input
                          type="text"
                          value={entry.startTime ?? ''}
                          onChange={(e) => handleCellChange(entry.date, 'startTime', e.target.value)}
                          aria-label={`Start time for ${entry.date}`}
                          className="w-full text-center font-mono text-xs border border-transparent hover:border-gray-300 focus:border-emerald-500 rounded px-1 py-0.5 bg-transparent focus:bg-white text-gray-800"
                          placeholder="05:00"
                        />
                      ) : (
                        <span className="text-gray-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Close Time */}
                    <td className="px-1.5 py-1 border-r border-gray-100 text-center">
                      {isRun ? (
                        <input
                          type="text"
                          value={entry.closeTime ?? ''}
                          onChange={(e) => handleCellChange(entry.date, 'closeTime', e.target.value)}
                          aria-label={`Close time for ${entry.date}`}
                          className="w-full text-center font-mono text-xs border border-transparent hover:border-gray-300 focus:border-emerald-500 rounded px-1 py-0.5 bg-transparent focus:bg-white text-gray-800"
                          placeholder="18:00"
                        />
                      ) : (
                        <span className="text-gray-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Total Hours (Computed) */}
                    <td className="px-2 py-2 border-r border-gray-100 text-center font-mono text-xs text-gray-700">
                      {isRun && durMinutes > 0 ? formatMinutesToHM(durMinutes) : '-'}
                    </td>

                    {/* Extra Hours (Computed) */}
                    <td className="px-2 py-2 border-r border-gray-100 text-center font-mono text-xs font-bold text-amber-900 bg-amber-50/20">
                      {isRun && extraMinutes > 0 ? formatMinutesToHM(extraMinutes) : '-'}
                    </td>

                    {/* Night Bata Toggle */}
                    <td className="px-1 py-1 border-r border-gray-100 text-center">
                      {isRun && (
                        <input
                          type="checkbox"
                          checked={entry.nightBata || false}
                          onChange={(e) => handleCellChange(entry.date, 'nightBata', e.target.checked)}
                          aria-label={`Night bata for ${entry.date}`}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer h-3.5 w-3.5"
                          title="Night Bata toggle (Auto-suggest when start < 06:00 or close > 22:00)"
                        />
                      )}
                    </td>

                    {/* Outstation Bata Toggle */}
                    <td className="px-1 py-1 border-r border-gray-100 text-center">
                      {isRun && (
                        <input
                          type="checkbox"
                          checked={entry.outstationBata || false}
                          onChange={(e) => handleCellChange(entry.date, 'outstationBata', e.target.checked)}
                          aria-label={`Outstation bata for ${entry.date}`}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer h-3.5 w-3.5"
                          title="Outstation Halt Bata toggle"
                        />
                      )}
                    </td>

                    {/* Permit / Toll */}
                    <td className="px-1.5 py-1 border-r border-gray-100 text-right">
                      {isRun ? (
                        <input
                          type="number"
                          value={entry.permit ?? ''}
                          onChange={(e) => handleCellChange(entry.date, 'permit', e.target.value === '' ? null : Number(e.target.value))}
                          aria-label={`Permit toll for ${entry.date}`}
                          className="w-full text-right font-mono text-xs border border-transparent hover:border-gray-300 focus:border-emerald-500 rounded px-1 py-0.5 bg-transparent focus:bg-white text-gray-800"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-gray-500 font-mono">-</span>
                      )}
                    </td>

                    {/* Remarks / Route */}
                    <td className="px-2 py-1 border-r border-gray-100">
                      <input
                        type="text"
                        value={entry.remarks ?? ''}
                        onChange={(e) => handleCellChange(entry.date, 'remarks', e.target.value)}
                        aria-label={`Remarks for ${entry.date}`}
                        className="w-full text-xs text-gray-800 border border-transparent hover:border-gray-300 focus:border-emerald-500 rounded px-1.5 py-0.5 bg-transparent focus:bg-white truncate"
                        placeholder="Route, destination, site remarks"
                      />
                    </td>

                    {/* Alert Icon */}
                    <td className="px-1 py-1 text-center">
                      {rowAnomalies.length > 0 && (
                        <button
                          onClick={() => setIsAnomalyDrawerOpen(true)}
                          aria-label={`View anomalies for ${entry.date}`}
                          className="p-1 rounded hover:bg-amber-100 text-amber-600"
                          title={rowAnomalies.map((a) => a.title).join(', ')}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Live Aggregated Totals Footer Row */}
        <div className="bg-gray-900 text-white p-4 border-t border-gray-800 flex flex-wrap items-center justify-between gap-4 text-xs font-sans">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Run Days</span>
              <span className="font-bold text-sm text-emerald-400">
                {totals.runDays} <span className="text-xs text-gray-400 font-normal">/ 31</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Total KM</span>
              <span className="font-mono font-bold text-sm text-white">
                {totals.totalKm.toLocaleString()} KM
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Extra Hours</span>
              <span className="font-mono font-bold text-sm text-amber-400">
                {totals.extraHoursFormatted} <span className="text-[10px] font-normal text-gray-300">(₹{totals.extraHoursAmount.toFixed(2)})</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Night Bata</span>
              <span className="font-bold text-white">
                {totals.nightBataDays}d <span className="text-gray-400">(₹{totals.nightBataAmount})</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Outstation</span>
              <span className="font-bold text-white">
                {totals.outstationBataDays}d <span className="text-gray-400">(₹{totals.outstationBataAmount})</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Permit & Toll</span>
              <span className="font-mono font-bold text-white">
                ₹{totals.totalPermit}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Estimated Month Total</span>
            <span className="font-display font-bold text-lg text-emerald-400">
              ₹{totals.estimatedTotal.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Review Queue Drawer */}
      {isAnomalyDrawerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-end z-50">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-bold text-gray-900 font-display">Ledger Anomaly Review</h2>
                </div>
                <button
                  onClick={() => setIsAnomalyDrawerOpen(false)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Automated continuous checks for KM gaps (&gt;{kmGapThreshold}km), duty hours, holiday runs, and bata rules.
              </p>

              <div className="mt-4 space-y-3">
                {anomalies.map((a) => {
                  const isAck = acknowledgedAnomalies.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 transition ${
                        isAck
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : a.severity === 'critical'
                          ? 'bg-red-50 border-red-200'
                          : a.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 flex items-center gap-1.5">
                          <span className="font-mono text-gray-500">{a.entryDate}</span>
                          <span>•</span>
                          <span>{a.title}</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            a.severity === 'critical'
                              ? 'bg-red-200 text-red-900'
                              : a.severity === 'warning'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-blue-200 text-blue-900'
                          }`}
                        >
                          {a.severity}
                        </span>
                      </div>
                      <p className="text-gray-600 leading-relaxed">{a.description}</p>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => {
                            setAcknowledgedAnomalies((prev) => {
                              const next = new Set(prev);
                              if (next.has(a.id)) next.delete(a.id);
                              else next.add(a.id);
                              return next;
                            });
                          }}
                          className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded transition ${
                            isAck
                              ? 'bg-gray-200 text-gray-700'
                              : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-300'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{isAck ? 'Acknowledged' : 'Acknowledge Note'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setIsAnomalyDrawerOpen(false)}
                className="w-full py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition"
              >
                Close Review Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Sign-Off Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-gray-900 font-display">Customer Logbook Sign-Off</h3>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Share this secure tokenised web link with the customer coordinator (e.g. at Vindhya Telelinks Ltd). They can review all August trips and click one button to sign off before invoice generation.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Tokenised Link</span>
              <div className="font-mono text-emerald-800 break-all select-all">{approvalUrl}</div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={copyApprovalUrl}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition"
              >
                <Check className="w-4 h-4" />
                <span>{copiedLink ? 'Copied to Clipboard!' : 'Copy Link'}</span>
              </button>
              <button
                onClick={() => {
                  setIsShareModalOpen(false);
                  onOpenCustomerApproval();
                }}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold transition"
              >
                Open Approval Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
