import React, { useState, useEffect } from 'react';
import {
  Fuel,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PauseCircle,
  Plus,
  Search,
  Receipt,
  Eye,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ExpenseService } from '../../services/expenseService';
import { FuelLogRecord } from '../../engine/expenses';
import { DriverFuelLogModal } from './DriverFuelLogModal';

export const FuelExpensesReviewQueue: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdminOrStaff = currentUser?.role === 'admin' || currentUser?.role === 'staff';

  const [filter, setFilter] = useState<'pending' | 'held' | 'approved' | 'all'>('pending');
  const [logs, setLogs] = useState<FuelLogRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Review & Hold Modal state
  const [selectedLogForHold, setSelectedLogForHold] = useState<FuelLogRecord | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadLogs = async () => {
    try {
      const data = await ExpenseService.getFuelLogs(filter);
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load fuel logs:', err);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const handleApprove = async (id: string) => {
    try {
      await ExpenseService.reviewFuelEntry({
        id,
        action: 'approve',
        reviewedBy: currentUser?.id || '',
      });
      setStatusMsg({ type: 'success', text: 'Fuel entry approved for driver settlement.' });
      loadLogs();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to approve entry.' });
    }
  };

  const handleConfirmHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogForHold) return;

    try {
      await ExpenseService.reviewFuelEntry({
        id: selectedLogForHold.id,
        action: 'hold',
        heldReason: holdReason.trim(),
        reviewedBy: currentUser?.id || '',
      });
      setStatusMsg({
        type: 'success',
        text: 'Entry held from driver settlement. Reason logged into audit trail.',
      });
      setSelectedLogForHold(null);
      setHoldReason('');
      loadLogs();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to hold entry.' });
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.fuelStation?.toLowerCase().includes(q) ||
      l.notes?.toLowerCase().includes(q) ||
      l.heldReason?.toLowerCase().includes(q) ||
      l.entryDate.includes(q)
    );
  });

  const pendingCount = logs.filter((l) => l.status === 'submitted').length;
  const heldCount = logs.filter((l) => l.status === 'held_from_settlement').length;
  const approvedCount = logs.filter((l) => l.status === 'approved').length;
  const totalLitres = logs.reduce((sum, l) => sum + l.fuelLitres, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
            <Fuel className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-display">Fuel & Driver Expenses Review Desk</h1>
            <p className="text-xs text-gray-500">
              Audit fuel economy (KM/L), receipt photos, odometer rollbacks, and manage held settlements
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsLogModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Log Driver Fuel Entry</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            )}
            {statusMsg.text}
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-gray-200/80">
          <div className="flex justify-between items-center text-xs text-amber-700 font-semibold mb-1">
            <span>Pending Review</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">{pendingCount}</div>
          <span className="text-[11px] text-gray-400">Claims awaiting office check</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80">
          <div className="flex justify-between items-center text-xs text-rose-700 font-semibold mb-1">
            <span>Held from Settlement</span>
            <PauseCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700">{heldCount}</div>
          <span className="text-[11px] text-gray-400">Blocked payout with reason</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80">
          <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold mb-1">
            <span>Approved Claims</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">{approvedCount}</div>
          <span className="text-[11px] text-gray-400">Ready for driver payout</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80">
          <div className="flex justify-between items-center text-xs text-gray-600 font-semibold mb-1">
            <span>Total Fleet Volume</span>
            <Receipt className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900">{totalLitres.toFixed(1)} L</div>
          <span className="text-[11px] text-gray-400">Diesel / Petrol recorded</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === 'pending' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('held')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === 'held' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Held from Settlement ({heldCount})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === 'approved' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Records ({logs.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by station, notes, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-xl text-xs bg-gray-50/50 focus:bg-white"
            />
          </div>
        </div>

        {/* Fuel Logs Table */}
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Vehicle</th>
                <th className="py-2.5 px-3">Odometer</th>
                <th className="py-2.5 px-3">Economy</th>
                <th className="py-2.5 px-3">Litres & Rate</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Station & Photo</th>
                <th className="py-2.5 px-3">Status / Anomalies</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    No fuel expense entries found for this filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const hasAnomalies = log.anomalies && log.anomalies.length > 0;
                  const hasRollback = log.anomalies?.some((a) => a.code === 'ODOMETER_ROLLBACK');

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        log.status === 'held_from_settlement' ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-medium text-gray-800">{log.entryDate}</td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-gray-900">KL01CP3284</div>
                        <div className="text-[10px] text-gray-500 uppercase">{log.vehicleType || 'Sedan'}</div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-gray-900">{log.odometerReading} KM</div>
                        {log.previousOdometer && (
                          <div className="text-[10px] text-gray-400">Prev: {log.previousOdometer}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {log.isFullTank && log.kmPerLitre !== undefined ? (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-[11px] ${
                                hasRollback
                                  ? 'bg-red-100 text-red-800'
                                  : log.kmPerLitre < 15
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {log.kmPerLitre} km/L
                            </span>
                            <div className="text-[9px] text-emerald-700 font-semibold uppercase tracking-wider">Full Tank</div>
                          </div>
                        ) : log.isFullTank ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-medium">
                            Initial Full Tank
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium">
                            Partial (Accumulating)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div>{log.fuelLitres} L</div>
                        <div className="text-[10px] text-gray-400">@ ₹{log.ratePerLitre}/L</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-gray-900">
                        ₹{log.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3">
                        <div className="truncate max-w-[140px] text-gray-700">{log.fuelStation || 'Station Not Specified'}</div>
                        {log.receiptPhotoUrl ? (
                          <button
                            onClick={() => setSelectedPhotoUrl(log.receiptPhotoUrl || null)}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-0.5 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Photo</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-rose-500 italic">No receipt attached</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'held_from_settlement'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {log.status.replace(/_/g, ' ')}
                          </span>

                          {hasAnomalies && (
                            <div className="flex flex-wrap gap-1">
                              {log.anomalies.map((anom, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-semibold flex items-center gap-0.5"
                                  title={anom.message}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {anom.code.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}

                          {log.heldReason && (
                            <div className="text-[10px] text-rose-800 bg-rose-50 p-1.5 rounded border border-rose-200 mt-1">
                              <strong>Held Reason:</strong> {log.heldReason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isAdminOrStaff && (
                          <div className="flex justify-end items-center gap-1.5">
                            {log.status !== 'approved' && (
                              <button
                                onClick={() => handleApprove(log.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Approve for Driver Settlement"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                            )}

                            {log.status !== 'held_from_settlement' && (
                              <button
                                onClick={() => {
                                  setSelectedLogForHold(log);
                                  setHoldReason('');
                                }}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Hold from Driver Settlement"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                                <span>Hold</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Reason Modal for Held from Settlement */}
      {selectedLogForHold && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <PauseCircle className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 font-display">Hold from Driver Settlement</h3>
                <p className="text-xs text-gray-500">Mandatory justification is required by policy</p>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div><strong>Vehicle:</strong> KL01CP3284 ({selectedLogForHold.entryDate})</div>
              <div><strong>Claim Amount:</strong> ₹{selectedLogForHold.totalAmount.toLocaleString('en-IN')} ({selectedLogForHold.fuelLitres} L)</div>
              {selectedLogForHold.kmPerLitre && (
                <div><strong>Economy:</strong> {selectedLogForHold.kmPerLitre} km/L</div>
              )}
            </div>

            <form onSubmit={handleConfirmHold} className="space-y-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1 text-xs">
                  Justification Reason (Mandatory) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Economy of 10.0 km/L indicates excess idling or fuel siphoning. Driver must provide explanation."
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs bg-white focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLogForHold(null)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!holdReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                >
                  Confirm Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Photo Lightbox Modal */}
      {selectedPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhotoUrl(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
              <span className="font-semibold text-xs flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-amber-400" />
                Verified Receipt Photo
              </span>
              <button
                onClick={() => setSelectedPhotoUrl(null)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-gray-100 flex items-center justify-center">
              <img
                src={selectedPhotoUrl}
                alt="Fuel Receipt"
                className="max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Driver Log Fuel Modal */}
      {isLogModalOpen && (
        <DriverFuelLogModal
          onClose={() => setIsLogModalOpen(false)}
          onEntryLogged={loadLogs}
        />
      )}
    </div>
  );
};
