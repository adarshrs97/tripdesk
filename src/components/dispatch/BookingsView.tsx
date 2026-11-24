import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Car,
  User,
  AlertTriangle,
  ShieldAlert,
  FileCheck,
  Clock,
  Phone,
} from 'lucide-react';
import { Booking } from '../../engine/dispatch/types';
import { DispatchService } from '../../services/dispatchService';
import { FlagsService } from '../../services/flagsService';
import { InternalFlag } from '../../engine/flags';

interface BookingsViewProps {
  onNavigateToInvoice?: (invoiceId: string) => void;
  onNavigateToTripPlanning?: () => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  onNavigateToInvoice,
  onNavigateToTripPlanning,
}) => {
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Allocation Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocatingBooking, setAllocatingBooking] = useState<Booking | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('10000000-0000-0000-0000-000000000001');
  const [selectedDriverId, setSelectedDriverId] = useState('d0000000-0000-0000-0000-000000000001');
  const [overrideReason, setOverrideReason] = useState('');
  const [resurfacedFlags, setResurfacedFlags] = useState<InternalFlag[]>([]);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  // Duty Slip Modal State
  const [showDutySlipModal, setShowDutySlipModal] = useState(false);
  const [dutyPassengerName, setDutyPassengerName] = useState('');
  const [dutyPassengerPhone, setDutyPassengerPhone] = useState('');
  const [dutyReportingTime, setDutyReportingTime] = useState('08:30');
  const [dutyOpeningKm, setDutyOpeningKm] = useState('155622');

  // Real Fleet Vehicles & Drivers from owner records
  const FLEET_VEHICLES = [
    { id: '10000000-0000-0000-0000-000000000001', plate: 'KL 01 CP 3284', model: 'Maruti Suzuki 7-Seat AC' },
    { id: '10000000-0000-0000-0000-000000000002', plate: 'KL 82 4889', model: 'Ertiga' },
    { id: '10000000-0000-0000-0000-000000000003', plate: 'KL 74 E 3694', model: 'Attached (Substitute)' },
    { id: '10000000-0000-0000-0000-000000000004', plate: 'KL 21 M 2378', model: 'Dzire' },
  ];

  const FLEET_DRIVERS = [
    { id: 'd0000000-0000-0000-0000-000000000001', name: 'Hemanth Kumar', phone: '+91 94470 99887' },
    { id: 'd0000000-0000-0000-0000-000000000002', name: 'Muhammad Fayaz.s', phone: '+91 98471 11223' },
    { id: 'd0000000-0000-0000-0000-000000000003', name: 'Asheerkhan', phone: '+91 97455 33445' },
    { id: 'd0000000-0000-0000-0000-000000000004', name: 'Afzal', phone: '+91 99950 66778' },
  ];

  const loadData = async () => {
    const list = await DispatchService.getBookings();
    setBookings(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check flags whenever vehicle or driver changes in allocation modal
  useEffect(() => {
    const checkFlags = async () => {
      const vFlags = await FlagsService.getFlagsForEntity('vehicle', selectedVehicleId);
      const dFlags = await FlagsService.getFlagsForEntity('driver', selectedDriverId);
      setResurfacedFlags([...vFlags, ...dFlags].filter((f) => f.isActive));
    };
    if (showAllocateModal) {
      checkFlags();
    }
  }, [selectedVehicleId, selectedDriverId, showAllocateModal]);

  const handleOpenAllocate = (b: Booking) => {
    setAllocatingBooking(b);
    setOverrideReason('');
    setAllocationError(null);
    setShowAllocateModal(true);
  };

  const handleConfirmAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingBooking) return;

    const veh = FLEET_VEHICLES.find((v) => v.id === selectedVehicleId)!;
    const drv = FLEET_DRIVERS.find((d) => d.id === selectedDriverId)!;

    try {
      await DispatchService.allocateVehicleAndDriver(allocatingBooking.id, {
        vehicleId: veh.id,
        vehiclePlate: veh.plate,
        vehicleModel: veh.model,
        driverId: drv.id,
        driverName: drv.name,
        driverPhone: drv.phone,
        overrideReason: overrideReason.trim() || undefined,
      });

      setShowAllocateModal(false);
      await loadData();
    } catch (err: any) {
      setAllocationError(err.message);
    }
  };

  const handleOpenDutySlipModal = (b: Booking) => {
    setAllocatingBooking(b);
    setDutyPassengerName(b.customerName);
    setDutyPassengerPhone(b.customerPhone);
    setShowDutySlipModal(true);
  };

  const handleCreateDutySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingBooking) return;

    await DispatchService.createDutySlip(allocatingBooking.id, {
      reportingTime: dutyReportingTime,
      openingKm: parseFloat(dutyOpeningKm) || 100000,
      openingTime: dutyReportingTime,
      passengerName: dutyPassengerName,
      passengerPhone: dutyPassengerPhone,
    });

    setShowDutySlipModal(false);
    await loadData();
    if (onNavigateToTripPlanning) {
      onNavigateToTripPlanning();
    }
  };

  const handleConvertToInvoice = async (b: Booking) => {
    const confirmIssue = window.confirm(
      `Generate final invoice for Booking ${b.bookingNumber}?\nAgreed Total: ₹${b.agreedEstimatedTotal.toLocaleString('en-IN')}\nAdvance Deducted: ₹${b.advanceAmountReceived.toLocaleString('en-IN')}\n\nNote: Uses TEST series on this machine.`
    );
    if (!confirmIssue) return;

    try {
      const res = await DispatchService.convertBookingToInvoice(b.id, 'TEST');
      alert(`Invoice Issued Successfully!\nInvoice No: ${res.invoiceNumber}\nNet Receivable: ₹${res.netPayable.toLocaleString('en-IN')}`);
      await loadData();
      if (onNavigateToInvoice) {
        onNavigateToInvoice(res.invoiceId);
      }
    } catch (err: any) {
      alert(`Invoice generation failed: ${err.message}`);
    }
  };

  const hasAvoidFlag = resurfacedFlags.some((f) => f.severity === 'avoid');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-card border border-line p-5 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-brand" />
            Confirmed Bookings &amp; Vehicle Dispatch
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Assign vehicles and drivers with strict internal flag checks (caution alerts &amp; avoid blocks). Generate duty slips and convert to final invoices.
          </p>
        </div>

        <div className="text-xs font-semibold text-ink-soft bg-paper border border-line px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span>Active Bookings:</span>
          <span className="font-mono text-ink font-bold">{bookings.length}</span>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-card border border-line rounded-xl overflow-hidden shadow-xs">
        <table className="min-w-full divide-y divide-line text-xs">
          <thead className="bg-paper text-ink-soft font-semibold uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Booking Ref</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Pickup &amp; Schedule</th>
              <th className="px-4 py-3 text-left">Allocated Fleet</th>
              <th className="px-4 py-3 text-right">Estimated &amp; Advance</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                  No confirmed bookings yet. Convert an active quote or capture an enquiry.
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="hover:bg-paper/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-mono font-bold text-brand">{b.bookingNumber}</div>
                    <div className="text-[10px] text-ink-faint mt-0.5">{b.supplierName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{b.customerName}</div>
                    <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-ink-faint" />
                      {b.customerPhone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-ink font-medium truncate max-w-xs">{b.pickupAddress} &rarr; {b.destination}</div>
                    <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-ink-faint" />
                      {b.pickupDateTime.replace('T', ' ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {b.allocatedVehiclePlate ? (
                      <div>
                        <div className="font-semibold text-ink flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-brand" />
                          {b.allocatedVehiclePlate}
                        </div>
                        <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-ink-faint" />
                          {b.allocatedDriverName}
                        </div>
                        {b.overrideReason && (
                          <span className="inline-block mt-1 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Override Logged
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-amber-700 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Pending Fleet Allocation
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="font-mono font-bold text-ink">
                      ₹{b.agreedEstimatedTotal.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium">
                      Adv: ₹{b.advanceAmountReceived.toLocaleString('en-IN')} ({b.advancePaymentMode || 'N/A'})
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        b.status === 'completed'
                          ? 'bg-purple-100 text-purple-800'
                          : b.status === 'dispatched'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                    {b.status !== 'completed' && (
                      <button
                        onClick={() => handleOpenAllocate(b)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-paper border border-line text-ink hover:border-brand"
                      >
                        {b.allocatedVehiclePlate ? 'Re-assign' : 'Allocate Fleet'}
                      </button>
                    )}

                    {b.allocatedVehiclePlate && !b.dutySlipId && (
                      <button
                        onClick={() => handleOpenDutySlipModal(b)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-brand-tint text-brand-dark hover:bg-brand hover:text-white transition-colors"
                      >
                        Duty Slip
                      </button>
                    )}

                    {b.status !== 'completed' ? (
                      <button
                        onClick={() => handleConvertToInvoice(b)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs"
                      >
                        Issue Invoice
                      </button>
                    ) : (
                      <span className="text-[11px] text-purple-700 font-semibold font-mono">
                        {b.invoiceId}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Fleet Allocation Modal with Flag Resurfacing */}
      {showAllocateModal && allocatingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-line max-w-lg w-full p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Car className="w-5 h-5 text-brand" />
              Allocate Vehicle &amp; Driver for Booking {allocatingBooking.bookingNumber}
            </h3>

            {allocationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{allocationError}</div>
              </div>
            )}

            <form onSubmit={handleConfirmAllocation} className="space-y-4">
              <div>
                <label className="block font-semibold text-ink mb-1">Select Fleet Vehicle</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg font-semibold text-ink focus:border-brand focus:outline-none"
                >
                  {FLEET_VEHICLES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} - {v.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Select Driver</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg font-semibold text-ink focus:border-brand focus:outline-none"
                >
                  {FLEET_DRIVERS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* INTERNAL FLAGS RESURFACING PANEL */}
              {resurfacedFlags.length > 0 && (
                <div className="p-3.5 bg-paper rounded-xl border border-line space-y-2">
                  <div className="font-bold text-ink flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Internal Staff Notes &amp; Caution Flags Resurfaced:
                  </div>
                  <div className="space-y-2">
                    {resurfacedFlags.map((flag) => (
                      <div
                        key={flag.id}
                        className={`p-2.5 rounded-lg border text-[11px] ${
                          flag.severity === 'avoid'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : flag.severity === 'caution'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{flag.title}</span>
                          <span className="uppercase text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-white/70">
                            {flag.severity}
                          </span>
                        </div>
                        <div className="text-[10px] mt-0.5 opacity-90">{flag.description}</div>
                      </div>
                    ))}
                  </div>

                  {hasAvoidFlag && (
                    <div className="pt-2">
                      <label className="block font-bold text-rose-800 mb-1">
                        Administrative Override Reason (Mandatory to override AVOID flag):
                      </label>
                      <input
                        type="text"
                        required
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="State operational reason or management authorization..."
                        className="w-full px-2.5 py-1.5 border border-rose-300 rounded bg-white text-xs text-rose-900 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 border border-line rounded-lg text-ink hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hasAvoidFlag && !overrideReason.trim()}
                  className={`px-4 py-2 rounded-lg font-semibold text-white shadow-xs transition-colors ${
                    hasAvoidFlag && !overrideReason.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-brand hover:bg-brand-dark'
                  }`}
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duty Slip Creation Modal */}
      {showDutySlipModal && allocatingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-line max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-brand" />
              Generate Trip Duty Slip
            </h3>

            <form onSubmit={handleCreateDutySlip} className="space-y-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Passenger Name</label>
                <input
                  type="text"
                  required
                  value={dutyPassengerName}
                  onChange={(e) => setDutyPassengerName(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Passenger Phone</label>
                <input
                  type="text"
                  required
                  value={dutyPassengerPhone}
                  onChange={(e) => setDutyPassengerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Reporting Time</label>
                  <input
                    type="time"
                    required
                    value={dutyReportingTime}
                    onChange={(e) => setDutyReportingTime(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Opening Odometer (KM)</label>
                  <input
                    type="number"
                    required
                    value={dutyOpeningKm}
                    onChange={(e) => setDutyOpeningKm(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowDutySlipModal(false)}
                  className="px-4 py-2 border border-line rounded-lg text-ink hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark shadow-xs"
                >
                  Generate Duty Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
