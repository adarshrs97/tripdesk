import React, { useState, useEffect } from 'react';
import {
  Fuel,
  Camera,
  AlertTriangle,
  CheckCircle2,
  X,
  Upload,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ExpenseService } from '../../services/expenseService';
import { MastersService, Vehicle } from '../../services/mastersService';
import {
  VehicleFuelSettings,
  VehicleCategory,
  validateFuelEntry,
} from '../../engine/expenses';

interface DriverFuelLogModalProps {
  onClose: () => void;
  onEntryLogged?: () => void;
}

export const DriverFuelLogModal: React.FC<DriverFuelLogModalProps> = ({
  onClose,
  onEntryLogged,
}) => {
  const { currentUser } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelSettings, setFuelSettings] = useState<VehicleFuelSettings[]>([]);

  // Form Fields
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('10000000-0000-0000-0000-000000000001');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [odometerReading, setOdometerReading] = useState<string>('156450');
  const [previousOdometer, setPreviousOdometer] = useState<number>(156000);
  const [isFullTank, setIsFullTank] = useState<boolean>(true);
  const [receiptNumber, setReceiptNumber] = useState<string>('IOCL-98432');
  const [fuelLitres, setFuelLitres] = useState<string>('25.0');
  const [ratePerLitre, setRatePerLitre] = useState<string>('96.50');
  const [fuelStation, setFuelStation] = useState<string>('Indian Oil Killipalam');
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string>('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    MastersService.getVehicles().then((v) => {
      setVehicles(v);
      if (v.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(v[0].id);
      }
    });
    ExpenseService.getFuelSettings().then(setFuelSettings);
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  useEffect(() => {
    if (selectedVehicle?.currentOdometer) {
      setPreviousOdometer(selectedVehicle.currentOdometer);
    }
  }, [selectedVehicle]);
  const vehicleCategory = ((selectedVehicle as any)?.vehicleType || 'sedan').toLowerCase() as VehicleCategory;
  const currentSettings = fuelSettings.find((s) => s.vehicleType === vehicleCategory);

  const numOdo = parseFloat(odometerReading) || 0;
  const numLitres = parseFloat(fuelLitres) || 0;
  const numRate = parseFloat(ratePerLitre) || 0;
  const totalAmount = Math.round(numLitres * numRate * 100) / 100;

  // Live client-side anomaly preview
  const liveValidation = numLitres > 0
    ? validateFuelEntry(
        {
          driverId: currentUser?.driverId || 'd0000000-0000-0000-0000-000000000001',
          vehicleId: selectedVehicleId,
          vehicleType: vehicleCategory,
          entryDate,
          odometerReading: numOdo,
          previousOdometer,
          isFullTank,
          receiptNumber: receiptNumber.trim() || undefined,
          fuelLitres: numLitres,
          ratePerLitre: numRate,
          receiptPhotoUrl,
        },
        previousOdometer,
        currentSettings
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await ExpenseService.submitFuelEntry({
        driverId: currentUser?.driverId || 'd0000000-0000-0000-0000-000000000001',
        vehicleId: selectedVehicleId,
        vehicleType: vehicleCategory,
        entryDate,
        odometerReading: numOdo,
        previousOdometer,
        isFullTank,
        receiptNumber: receiptNumber.trim() || undefined,
        fuelLitres: numLitres,
        ratePerLitre: numRate,
        fuelStation: fuelStation.trim(),
        receiptPhotoUrl: receiptPhotoUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setSuccessMsg('Fuel entry submitted successfully to the office review queue.');
      setTimeout(() => {
        if (onEntryLogged) onEntryLogged();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit fuel log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display">Log Fuel Entry & Receipt</h2>
              <p className="text-xs text-amber-100">Driver expenses & fuel checks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Vehicle & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Vehicle *</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs bg-white font-mono"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.regNo} ({v.vehicleType || 'Car'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Date *</label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs bg-white"
              />
            </div>
          </div>

          {/* Odometer & Economy Indicator */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Odometer Reading (KM) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. 156450"
                  value={odometerReading}
                  onChange={(e) => setOdometerReading(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-mono font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-medium mb-1">Previous Odometer</label>
                <input
                  type="number"
                  disabled
                  value={previousOdometer}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-mono bg-gray-100 text-gray-600"
                />
              </div>
            </div>

            {/* Live Economy Calculation Badge */}
            {liveValidation?.kmPerLitre !== null && liveValidation?.kmPerLitre !== undefined && (
              <div
                className={`p-2 rounded-lg flex items-center justify-between text-xs font-semibold ${
                  liveValidation.anomalies.length > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-700" />
                  Calculated Economy:
                </span>
                <span className="font-mono text-sm font-bold">
                  {liveValidation.kmPerLitre} km/L
                </span>
              </div>
            )}

            {/* Anomaly Alerts */}
            {liveValidation?.anomalies && liveValidation.anomalies.length > 0 && (
              <div className="space-y-1 pt-1">
                {liveValidation.anomalies.map((anom, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${
                      anom.severity === 'critical'
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>{anom.code.replace(/_/g, ' ')}:</strong> {anom.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Litres, Rate, Total Amount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Fuel Litres *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="25.0"
                value={fuelLitres}
                onChange={(e) => setFuelLitres(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-mono font-bold bg-white"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Rate / Litre *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="96.50"
                value={ratePerLitre}
                onChange={(e) => setRatePerLitre(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-mono bg-white"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Total (₹)</label>
              <input
                type="text"
                disabled
                value={`₹${totalAmount.toLocaleString('en-IN')}`}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-mono font-bold bg-amber-50 text-amber-900"
              />
            </div>
          </div>

          {/* Full Tank Toggle & POS Receipt Serial */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isFullTankCheck"
                checked={isFullTank}
                onChange={(e) => setIsFullTank(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="isFullTankCheck" className="text-xs font-semibold text-gray-800 cursor-pointer select-none">
                Full Tank Fill (100% Top-Up)
              </label>
            </div>
            <div>
              <input
                type="text"
                placeholder="Receipt / Bill No."
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-mono"
              />
            </div>
          </div>
          <div className="text-[11px] text-gray-500 -mt-1 px-1">
            {isFullTank ? (
              <span className="text-emerald-700 font-medium">✓ Full-Tank Method: Economy computed from previous full tank.</span>
            ) : (
              <span className="text-amber-700 font-medium">ℹ Partial Fill: Volume accumulates into next full fill (No outlier flags raised).</span>
            )}
          </div>

          {/* Fuel Station & Receipt Photo */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Fuel Station</label>
            <input
              type="text"
              placeholder="e.g. Indian Oil Killipalam"
              value={fuelStation}
              onChange={(e) => setFuelStation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs bg-white"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Receipt Photo URL *</label>
            <div className="flex gap-2">
              <input
                type="url"
                required
                placeholder="https://storage.starciti.com/..."
                value={receiptPhotoUrl}
                onChange={(e) => setReceiptPhotoUrl(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-xs font-mono bg-white"
              />
              <button
                type="button"
                onClick={() => setReceiptPhotoUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400')}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg flex items-center gap-1 text-gray-700 cursor-pointer"
                title="Simulate Camera Snap"
              >
                <Camera className="w-4 h-4 text-amber-700" />
                <span className="hidden sm:inline">Camera</span>
              </button>
            </div>
            {receiptPhotoUrl && (
              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
                <img
                  src={receiptPhotoUrl}
                  alt="Receipt Preview"
                  className="w-12 h-12 object-cover rounded-lg border border-gray-300"
                />
                <span className="text-[11px] text-gray-500 truncate flex-1">
                  Receipt photo verified for settlement upload
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Trip / Route Notes</label>
            <input
              type="text"
              placeholder="e.g. Outstation run to Kanyakumari with AC on continuously"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Fuel Log'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
