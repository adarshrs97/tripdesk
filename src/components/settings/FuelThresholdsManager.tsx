import React, { useState, useEffect } from 'react';
import { Fuel, Save, CheckCircle2, AlertCircle, Info, Sparkles } from 'lucide-react';
import { ExpenseService } from '../../services/expenseService';
import {
  VehicleFuelSettings,
  FuelType,
  getFuelUnit,
  calibrateVehicleThresholds,
} from '../../engine/expenses';
import { useAuth } from '../../context/AuthContext';

export const FuelThresholdsManager: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [settings, setSettings] = useState<VehicleFuelSettings[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const data = await ExpenseService.getFuelSettings();
      setSettings(data);
    } catch (err: any) {
      console.error('Failed to load fuel settings:', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (vehicleType: string, field: keyof VehicleFuelSettings, val: any) => {
    setSettings((prev) =>
      prev.map((s) => {
        if (s.vehicleType === vehicleType) {
          const updated = { ...s, [field]: val };
          if (field === 'fuelType') {
            updated.unit = getFuelUnit(val as FuelType);
          }
          return updated;
        }
        return s;
      })
    );
  };

  const handleCalibrate = async (vehicleType: string) => {
    try {
      const allLogs = await ExpenseService.getFuelLogs('all');
      const targetSetting = settings.find((s) => s.vehicleType === vehicleType);
      if (!targetSetting) return;

      const vehicleLogs = allLogs.filter((l) => l.vehicleType === vehicleType);
      const res = calibrateVehicleThresholds(vehicleLogs, targetSetting.fuelType, 3);

      if (res.status === 'calibrated' && res.recommendedMin !== null && res.recommendedMax !== null && res.recommendedTarget !== null) {
        setSettings((prev) =>
          prev.map((s) =>
            s.vehicleType === vehicleType
              ? {
                  ...s,
                  minKml: res.recommendedMin!,
                  maxKml: res.recommendedMax!,
                  targetKml: res.recommendedTarget!,
                  isDefaultAssumption: false,
                  note: `calibrated from last ${res.nFullFills} full fills`,
                }
              : s
          )
        );
        setStatusMsg({
          type: 'success',
          text: `Calibrated ${vehicleType.toUpperCase()} from ${res.nFullFills} full fills: average ${res.averageEconomy} ${res.unit} (recommended range: ${res.recommendedMin} - ${res.recommendedMax} ${res.unit})`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message,
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Calibration error: ${err.message}`,
      });
    }
  };

  const handleSave = async (setting: VehicleFuelSettings) => {
    if (!isAdmin) return;
    setIsSaving(true);
    setStatusMsg(null);

    try {
      await ExpenseService.updateFuelSettings(setting);
      setStatusMsg({
        type: 'success',
        text: `Fuel thresholds for ${setting.vehicleType.toUpperCase()} updated successfully!`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to update settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Fuel className="w-5 h-5 text-amber-800" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-display">Fuel Efficiency & Check Thresholds</h2>
            <p className="text-xs text-gray-500">
              Configure fuel types (diesel, petrol, CNG, electric), efficiency units (km/L, km/kg, km/kWh), and calibration rules
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Full-Tank Policy & Calibrated Economy:</span> Fuel efficiency is strictly calculated between consecutive 100% full fills.
          Single partial fills accumulate volume and never raise outlier warnings. Vehicles with fewer than 2 full fills have outlier checks suppressed.
          Seeded values below are tagged <em>default assumption (editable)</em> and can be calibrated automatically from the last N full fills once real fuel data exists.
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

      {/* Threshold Cards by Vehicle Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settings.map((s) => {
          const unit = s.unit || getFuelUnit(s.fuelType);
          return (
            <div
              key={s.vehicleType}
              className="bg-white p-5 rounded-2xl border border-gray-200/80 space-y-4 hover:shadow-xs transition-shadow"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 font-display uppercase tracking-wide text-sm">
                      {s.vehicleType} Fleet
                    </h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      s.isDefaultAssumption !== false
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {s.note || (s.isDefaultAssumption !== false ? 'default assumption (editable)' : 'calibrated')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-gray-400">Fuel:</span>
                    <select
                      disabled={!isAdmin}
                      value={s.fuelType}
                      onChange={(e) => handleChange(s.vehicleType, 'fuelType', e.target.value as FuelType)}
                      className="text-[11px] font-medium border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 capitalize"
                    >
                      <option value="diesel">Diesel (km/L)</option>
                      <option value="petrol">Petrol (km/L)</option>
                      <option value="cng">CNG (km/kg)</option>
                      <option value="electric">Electric (km/kWh)</option>
                      <option value="other">Other (km/unit)</option>
                    </select>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold block">
                    Target: {s.targetKml} {unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Min ({unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    disabled={!isAdmin}
                    value={s.minKml}
                    onChange={(e) => handleChange(s.vehicleType, 'minKml', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 font-mono font-bold bg-gray-50 focus:bg-white text-xs"
                  />
                  <span className="text-[10px] text-gray-400">Below flags low outlier</span>
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Max ({unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    disabled={!isAdmin}
                    value={s.maxKml}
                    onChange={(e) => handleChange(s.vehicleType, 'maxKml', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 font-mono font-bold bg-gray-50 focus:bg-white text-xs"
                  />
                  <span className="text-[10px] text-gray-400">Above flags high outlier</span>
                </div>

                <div>
                  <label className="block text-gray-600 font-semibold mb-1">Target ({unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    disabled={!isAdmin}
                    value={s.targetKml}
                    onChange={(e) => handleChange(s.vehicleType, 'targetKml', parseFloat(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 font-mono font-bold bg-gray-50 focus:bg-white text-xs"
                  />
                  <span className="text-[10px] text-gray-400">Standard baseline</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={s.receiptPhotoMandatory}
                    onChange={(e) => handleChange(s.vehicleType, 'receiptPhotoMandatory', e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-medium">Mandatory receipt photo upload</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCalibrate(s.vehicleType)}
                    className="px-2.5 py-1.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-semibold flex items-center gap-1 cursor-pointer text-xs transition-colors"
                    title="Calibrate thresholds from last 3 full fills"
                  >
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    <span>Calibrate from full fills</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleSave(s)}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Rules</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
