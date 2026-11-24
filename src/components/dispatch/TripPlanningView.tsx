import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Printer,
  Car,
} from 'lucide-react';
import { DutySlip } from '../../engine/dispatch/types';
import { DispatchService } from '../../services/dispatchService';

export const TripPlanningView: React.FC = () => {
  const [dutySlips, setDutySlips] = useState<DutySlip[]>([]);
  const [selectedSlip, setSelectedSlip] = useState<DutySlip | null>(null);

  const loadData = async () => {
    const list = await DispatchService.getDutySlips();
    setDutySlips(list);
    if (!selectedSlip && list.length > 0) {
      setSelectedSlip(list[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-card border border-line p-5 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand" />
            Trip Planning &amp; Duty Slip Roster
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Driver-vehicle dispatch calendar, reporting schedules, and printable physical duty slips.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-line text-ink bg-paper rounded-lg text-xs font-semibold hover:border-brand transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print Active Duty Slip
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Duty Slips List */}
        <div className="lg:col-span-4 bg-card border border-line rounded-xl p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Dispatched Duty Slips ({dutySlips.length})
          </h3>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {dutySlips.map((slip) => (
              <div
                key={slip.id}
                onClick={() => setSelectedSlip(slip)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedSlip?.id === slip.id
                    ? 'bg-paper border-brand shadow-xs'
                    : 'border-line hover:border-brand/40 bg-white'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono font-bold text-brand">{slip.slipNumber}</span>
                  <span className="text-[10px] text-ink-soft font-mono">{slip.dutyDate}</span>
                </div>
                <div className="font-semibold text-ink">{slip.passengerName}</div>
                <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                  <Car className="w-3 h-3 text-ink-faint" />
                  {slip.vehiclePlate} ({slip.driverName})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Printable Physical Duty Slip Preview */}
        <div className="lg:col-span-8 bg-card border border-line rounded-xl p-6 shadow-xs space-y-4">
          {selectedSlip ? (
            <div className="bg-white border border-gray-300 rounded-xl p-8 shadow-xs text-xs space-y-6">
              {/* Slip Header */}
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold font-heading text-gray-900">STARCITI FLEET / CITY TOURS</h3>
                  <div className="text-[11px] text-gray-500">Corporate &amp; Tourist Vehicle Duty Slip</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm text-gray-900">{selectedSlip.slipNumber}</div>
                  <div className="text-[11px] text-gray-500">Date: {selectedSlip.dutyDate}</div>
                </div>
              </div>

              {/* Reporting & Passenger Info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">Passenger &amp; Reporting:</span>
                  <div className="font-bold text-gray-900 mt-0.5">{selectedSlip.passengerName}</div>
                  <div className="text-gray-600">Phone: {selectedSlip.passengerPhone}</div>
                  <div className="text-gray-600">Reporting Address: {selectedSlip.reportingAddress}</div>
                  <div className="text-gray-600">Reporting Time: {selectedSlip.reportingTime}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">Assigned Fleet &amp; Driver:</span>
                  <div className="font-bold text-gray-900 mt-0.5">{selectedSlip.vehiclePlate}</div>
                  <div className="text-gray-600">Model: {selectedSlip.vehicleModel}</div>
                  <div className="text-gray-600">Driver: {selectedSlip.driverName}</div>
                  <div className="text-gray-600">Driver Phone: {selectedSlip.driverPhone}</div>
                </div>
              </div>

              {/* Odometer & Timing Grid */}
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-gray-100 text-gray-700 font-semibold text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Reading Type</th>
                    <th className="px-3 py-2 text-left">Odometer (KM)</th>
                    <th className="px-3 py-2 text-left">Time (Hrs)</th>
                    <th className="px-3 py-2 text-left">Remarks / Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  <tr>
                    <td className="px-3 py-2 text-gray-700 font-sans font-semibold">Starting / Reporting</td>
                    <td className="px-3 py-2 font-bold text-gray-900">{selectedSlip.openingKm} km</td>
                    <td className="px-3 py-2 text-gray-800">{selectedSlip.openingTime}</td>
                    <td className="px-3 py-2 text-gray-500 font-sans">Garage / Reporting Base</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-gray-700 font-sans font-semibold">Closing / Release</td>
                    <td className="px-3 py-2 text-gray-400">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                    <td className="px-3 py-2 text-gray-400">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                    <td className="px-3 py-2 text-gray-400 font-sans">[ Passenger Drop Spot ]</td>
                  </tr>
                </tbody>
              </table>

              {/* Expenses on Actuals */}
              <div className="grid grid-cols-3 gap-3 border border-gray-200 p-3 rounded-lg text-[11px]">
                <div>
                  <span className="text-gray-500">Tolls Paid (₹):</span>
                  <div className="font-mono font-semibold text-gray-800 mt-0.5">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</div>
                </div>
                <div>
                  <span className="text-gray-500">Parking Charges (₹):</span>
                  <div className="font-mono font-semibold text-gray-800 mt-0.5">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</div>
                </div>
                <div>
                  <span className="text-gray-500">Permit / Border (₹):</span>
                  <div className="font-mono font-semibold text-gray-800 mt-0.5">[ &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; ]</div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 border-t flex justify-between items-end text-center text-[10px] text-gray-500">
                <div className="space-y-8">
                  <div className="border-b border-gray-400 w-40 mx-auto" />
                  <div>Driver Signature</div>
                </div>
                <div className="space-y-8">
                  <div className="border-b border-gray-400 w-40 mx-auto" />
                  <div>Guest / Coordinator Sign-Off</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-ink-soft">Select a duty slip to view.</div>
          )}
        </div>
      </div>
    </div>
  );
};
