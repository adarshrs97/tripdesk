import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle, Info, Sliders } from 'lucide-react';
import { ComplianceService } from '../../services/complianceService';
import { ComplianceSettings, DEFAULT_COMPLIANCE_SETTINGS } from '../../engine/compliance';
import { useAuth } from '../../context/AuthContext';

export const ComplianceSettingsManager: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [settings, setSettings] = useState<ComplianceSettings>(DEFAULT_COMPLIANCE_SETTINGS);
  const [windowsStr, setWindowsStr] = useState<string>('60, 30, 7');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    ComplianceService.getSettings().then((s) => {
      setSettings(s);
      setWindowsStr((s.alertWindowsDays || [60, 30, 7]).join(', '));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setStatusMsg(null);

    try {
      // Parse alert windows
      const parsedWindows = windowsStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
        .sort((a, b) => b - a);

      const updated: ComplianceSettings = {
        ...settings,
        alertWindowsDays: parsedWindows.length > 0 ? parsedWindows : [60, 30, 7],
      };

      await ComplianceService.updateSettings(updated);
      setSettings(updated);
      setStatusMsg({
        type: 'success',
        text: 'Fleet compliance thresholds updated successfully in database.',
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to update compliance settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-display">Compliance & Reminder Settings</h2>
            <p className="text-xs text-gray-500">
              Configure reminder windows for RC, Insurance, Pollution, Permit, Fitness, Licences, EMI and Maintenance
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Real Data Integrity Mandate:</span> Expiry alerts are generated strictly from verified entered dates.
          Unprovided fields are marked &quot;Not Provided&quot; on checklists and never trigger phantom expiry alerts.
        </div>
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
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-gray-200/80 space-y-5 shadow-xs">
        <div>
          <label className="block text-gray-900 font-bold text-xs mb-1">
            Document Expiry Alert Windows (Days before expiry) *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 60, 30, 7"
            value={windowsStr}
            onChange={(e) => setWindowsStr(e.target.value)}
            disabled={!isAdmin}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Comma-separated day thresholds. Default: <strong>60, 30, 7</strong> days. Notice at 60d, Warning at 30d, Critical at 7d.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-900 font-bold text-xs mb-1">
              Routine Service Warning (KM before due) *
            </label>
            <input
              type="number"
              required
              value={settings.serviceKmWarningThreshold}
              onChange={(e) => setSettings({ ...settings, serviceKmWarningThreshold: parseInt(e.target.value, 10) || 500 })}
              disabled={!isAdmin}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Warns when vehicle odometer is within X kilometres of next service interval. Default: 500 KM.
            </p>
          </div>

          <div>
            <label className="block text-gray-900 font-bold text-xs mb-1">
              Routine Service Date Warning (Days before periodic date) *
            </label>
            <input
              type="number"
              required
              value={settings.serviceDaysWarningThreshold}
              onChange={(e) => setSettings({ ...settings, serviceDaysWarningThreshold: parseInt(e.target.value, 10) || 14 })}
              disabled={!isAdmin}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Warns when periodic service date is within X days. Default: 14 days.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-900 font-bold text-xs mb-1">
              Monthly Vehicle EMI Reminder (Days before due day) *
            </label>
            <input
              type="number"
              required
              value={settings.emiDaysWarningThreshold}
              onChange={(e) => setSettings({ ...settings, emiDaysWarningThreshold: parseInt(e.target.value, 10) || 5 })}
              disabled={!isAdmin}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Days in advance to alert finance office before auto-debit due day. Default: 5 days.
            </p>
          </div>

          <div>
            <label className="block text-gray-900 font-bold text-xs mb-1">
              Police Clearance Certificate Validity (Months) *
            </label>
            <input
              type="number"
              required
              value={settings.policeClearanceValidityMonths}
              onChange={(e) => setSettings({ ...settings, policeClearanceValidityMonths: parseInt(e.target.value, 10) || 12 })}
              disabled={!isAdmin}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Police verification validity duration in Kerala. Default: 12 months.
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Thresholds...' : 'Save Compliance Thresholds'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
