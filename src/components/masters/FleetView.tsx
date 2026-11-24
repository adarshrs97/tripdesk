import React, { useState, useEffect } from 'react';
import { Vehicle, Driver, MastersService } from '../../services/mastersService';
import { FlagsService } from '../../services/flagsService';
import { InternalFlag } from '../../engine/flags';
import { EntityFlagBadge } from '../flags/EntityFlagBadge';
import {
  Car,
  User,
  Plus,
  Gauge,
  Phone,
} from 'lucide-react';

export const FleetView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [allFlags, setAllFlags] = useState<InternalFlag[]>([]);

  useEffect(() => {
    async function loadData() {
      const [vList, dList, fList] = await Promise.all([
        MastersService.getVehicles(),
        MastersService.getDrivers(),
        FlagsService.getFlags({ isActive: true }),
      ]);
      setVehicles(vList);
      setDrivers(dList);
      setAllFlags(fList);
    }
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-card border border-line p-5 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <Car className="w-5 h-5 text-brand" />
            Fleet Inventory &amp; Workforce
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Real fleet data from contracts and ledger sheets. Track vehicle registrations, odometers, and KM continuity jump thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-paper border border-line rounded-lg">
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'vehicles' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              Vehicles ({vehicles.length})
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'drivers' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              Drivers ({drivers.length})
            </button>
          </div>

          <button
            onClick={() => alert(`Add ${activeTab === 'vehicles' ? 'Vehicle' : 'Driver'}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add {activeTab === 'vehicles' ? 'Vehicle' : 'Driver'}</span>
          </button>
        </div>
      </div>

      {/* VEHICLES TAB */}
      {activeTab === 'vehicles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {vehicles.length === 0 ? (
            <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3">
              <Car className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="text-base font-bold text-gray-900">No Vehicles in Fleet</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Add your owned, hired, or attached vehicles to track odometers, fuel efficiency, and compliance.
              </p>
            </div>
          ) : (
            vehicles.map((v) => {
            const vFlags = allFlags.filter(
              (f) => f.entityType === 'vehicle' && (f.entityId === v.id || f.entityId === v.regNo || f.entityId === v.displayRegNo)
            );
            return (
              <div
                key={v.id}
                className="bg-card border border-line rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-4 hover:border-brand/40 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-ink block">
                          {v.displayRegNo}
                        </span>
                        <EntityFlagBadge flags={vFlags} compact />
                      </div>
                      <span className="text-xs text-ink-soft">
                        {v.makeModel || 'Model: Not provided'}
                      </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-brand-tint text-brand uppercase">
                      {v.vehicleType}
                    </span>
                  </div>

                <div className="mt-4 pt-3 border-t border-line space-y-2 text-xs text-ink-soft">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-ink-faint">
                      <Gauge className="w-3.5 h-3.5 text-brand" />
                      Current Odometer:
                    </span>
                    <span className="font-mono font-bold text-ink">
                      {v.currentOdometer.toLocaleString()} KM
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">KM Gap Warning:</span>
                    <span className="font-mono font-semibold text-amber-ink bg-amber-tint px-1.5 py-0.2 rounded">
                      &gt; {v.kmGapThreshold} km jump
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Seats / Ownership:</span>
                    <span>{v.seats} Seats · <strong className="capitalize">{v.ownership}</strong></span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Fuel &amp; Efficiency:</span>
                    <span className="font-semibold text-ink capitalize">
                      {v.fuelType || 'diesel'} ({v.fuelType === 'cng' ? 'km/kg' : v.fuelType === 'electric' ? 'km/kWh' : 'km/L'})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Service Interval:</span>
                    <span className="font-mono text-ink font-semibold">
                      {(v.serviceIntervalKm || 10000).toLocaleString()} KM
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-line/40 text-[11px]">
                    <span className="text-ink-faint">Compliance Expiries:</span>
                    <span className="font-mono text-ink-faint italic">
                      {v.pollutionExpiry || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                <span className="text-[11px] text-ink-faint">
                  Normalised: <code className="bg-paper px-1 rounded">{v.regNo}</code>
                </span>
                <button
                  onClick={() => alert(`Edit ${v.displayRegNo}`)}
                  className="text-brand font-semibold hover:underline"
                >
                  Edit &rarr;
                </button>
              </div>
            </div>
          );
        }))}
        </div>
      )}

      {/* DRIVERS TAB */}
      {activeTab === 'drivers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {drivers.length === 0 ? (
            <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3">
              <User className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="text-base font-bold text-gray-900">No Drivers Registered</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Add permanent or temporary drivers to assign duties and track daily bata.
              </p>
            </div>
          ) : (
            drivers.map((d) => {
            const dFlags = allFlags.filter(
              (f) => f.entityType === 'driver' && (f.entityId === d.id || f.entityId.toLowerCase() === d.name.toLowerCase())
            );
            return (
              <div
                key={d.id}
                className="bg-card border border-line rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-4 hover:border-brand/40 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-bold text-sm text-ink">
                          {d.name}
                        </h3>
                        <EntityFlagBadge flags={dFlags} compact />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-ink-soft mt-0.5">
                        <Phone className="w-3 h-3 text-ink-faint" />
                        <span>{d.phone || 'Phone: Not provided'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-paper border border-line text-ink-soft uppercase">
                      {d.driverType}
                    </span>
                  </div>

                <div className="mt-4 pt-3 border-t border-line space-y-2 text-xs text-ink-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">License No:</span>
                    <span className="font-mono text-[11px] text-ink-faint italic">
                      {d.licenseNo || 'Not provided'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">Police Clearance:</span>
                    <span className="text-[11px] text-ink-faint italic">
                      {d.policeClearanceDate || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                <span className="text-[11px] text-brand font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active Duty
                </span>
                <button
                  onClick={() => alert(`Edit driver ${d.name}`)}
                  className="text-brand font-semibold hover:underline"
                >
                  Profile &rarr;
                </button>
              </div>
            </div>
          );
        }))}
        </div>
      )}
    </div>
  );
};
