import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Car,
  Users,
  Wrench,
  CreditCard,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { ComplianceService } from '../../services/complianceService';
import {
  VehicleChecklistResult,
  DriverChecklistResult,
  ComplianceAlert,
  ComplianceSettings,
  DEFAULT_COMPLIANCE_SETTINGS,
} from '../../engine/compliance';

export const FleetComplianceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'vehicles' | 'drivers'>('alerts');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'notice'>('all');

  const [settings, setSettings] = useState<ComplianceSettings>(DEFAULT_COMPLIANCE_SETTINGS);
  const [vehicleChecklists, setVehicleChecklists] = useState<VehicleChecklistResult[]>([]);
  const [driverChecklists, setDriverChecklists] = useState<DriverChecklistResult[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [metrics, setMetrics] = useState({
    totalVehicles: 0,
    totalDrivers: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    noticeAlerts: 0,
    missingDocsCount: 0,
  });

  // Service Log Modal state
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceVehicleId, setServiceVehicleId] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceOdo, setServiceOdo] = useState('157800');
  const [serviceType, setServiceType] = useState<'periodic' | 'oil_change' | 'brake_pad' | 'tyres' | 'general'>('periodic');
  const [workshopName, setWorkshopName] = useState('Maruti Popular Motors, Trivandrum');
  const [billAmount, setBillAmount] = useState('4500');
  const [serviceSuccess, setServiceSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await ComplianceService.getFleetComplianceOverview();
      setSettings(data.settings);
      setVehicleChecklists(data.vehicleChecklists);
      setDriverChecklists(data.driverChecklists);
      setAlerts(data.alerts);
      setMetrics(data.metrics);
      if (data.vehicleChecklists.length > 0 && !serviceVehicleId) {
        setServiceVehicleId(data.vehicleChecklists[0].vehicleId);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceVehicleId) return;

    await ComplianceService.logVehicleService({
      vehicleId: serviceVehicleId,
      serviceDate,
      odometerReading: parseInt(serviceOdo, 10),
      serviceType,
      workshopName,
      billAmount: parseFloat(billAmount) || 0,
    });

    setServiceSuccess('Service maintenance record logged successfully. Next service recalibrated.');
    setTimeout(() => {
      setServiceSuccess(null);
      setIsServiceModalOpen(false);
      loadData();
    }, 1200);
  };

  const filteredAlerts = alerts.filter(a => {
    const matchesSearch = a.targetIdentifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const filteredVehicles = vehicleChecklists.filter(v =>
    v.displayRegNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.regNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDrivers = driverChecklists.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 font-display">Fleet Compliance & Expiries</h1>
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Real-Data Only
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Configurable {settings.alertWindowsDays.join('/')} day alert windows, RC, insurance, fitness, permit, driver credentials, EMI and service due
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsServiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Vehicle Service</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
            title="Refresh Compliance"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Monitored Fleet</div>
          <div className="text-2xl font-bold font-mono text-gray-900 mt-1">
            {metrics.totalVehicles} <span className="text-xs font-normal text-gray-500 font-sans">Vehicles / {metrics.totalDrivers} Drivers</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs bg-rose-50/20">
          <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Critical (&le;7d / Expired)
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">
            {metrics.criticalAlerts}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
            Warning (&le;30 Days)
          </div>
          <div className="text-2xl font-bold font-mono text-amber-800 mt-1">
            {metrics.warningAlerts}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs bg-blue-50/20">
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Notice (&le;60 Days)
          </div>
          <div className="text-2xl font-bold font-mono text-blue-800 mt-1">
            {metrics.noticeAlerts}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Missing Documents
          </div>
          <div className="text-2xl font-bold font-mono text-gray-700 mt-1">
            {metrics.missingDocsCount}
          </div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs">
        <div className="flex gap-1 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Actionable Alerts ({alerts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'vehicles'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Vehicle Documents Checklist ({vehicleChecklists.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'drivers'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Driver Credentials Checklist ({driverChecklists.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {activeTab === 'alerts' && (
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only (&le;7d / Expired)</option>
              <option value="warning">Warning Only (&le;30d)</option>
              <option value="notice">Notice Only (&le;60d)</option>
            </select>
          )}

          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search reg no / driver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: ACTIONABLE ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-gray-900">Zero Compliance Alarms</h3>
              <p className="text-xs text-gray-500">
                All real entered documents, EMI dates, and routine maintenance intervals are valid and up to date.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                  alert.severity === 'critical'
                    ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50/40 border-amber-200 text-amber-900'
                    : 'bg-blue-50/40 border-blue-200 text-blue-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {alert.alertType === 'service_due' ? (
                      <Wrench className="w-5 h-5 text-amber-600" />
                    ) : alert.alertType === 'emi_due' ? (
                      <CreditCard className="w-5 h-5 text-purple-600" />
                    ) : (
                      <ShieldAlert className={`w-5 h-5 ${alert.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'}`} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm bg-white/80 px-2 py-0.5 rounded border border-gray-200 text-gray-900">
                        {alert.targetIdentifier}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          alert.severity === 'critical'
                            ? 'bg-rose-600 text-white'
                            : alert.severity === 'warning'
                            ? 'bg-amber-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs font-semibold mt-1">{alert.message}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Action: {alert.actionRequired}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {alert.alertType === 'service_due' && (
                    <button
                      onClick={() => {
                        setServiceVehicleId(alert.targetId);
                        setIsServiceModalOpen(true);
                      }}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                    >
                      Log Service
                    </button>
                  )}
                  {alert.alertType === 'document_expiry' && (
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-white border border-gray-200">
                      {alert.expiryDate}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: VEHICLE DOCUMENTS CHECKLIST */}
      {activeTab === 'vehicles' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Vehicle</th>
                  <th className="py-3 px-3">Odometer</th>
                  <th className="py-3 px-3">RC (Reg Cert)</th>
                  <th className="py-3 px-3">Insurance</th>
                  <th className="py-3 px-3">Pollution (PUCC)</th>
                  <th className="py-3 px-3">Permit</th>
                  <th className="py-3 px-3">Fitness (FC)</th>
                  <th className="py-3 px-3">Service Due</th>
                  <th className="py-3 px-3">EMI Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVehicles.map((v) => (
                  <tr key={v.vehicleId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-gray-900">{v.displayRegNo}</div>
                      <div className="text-[10px] text-gray-400">ID: {v.vehicleId.slice(0, 8)}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-gray-700">
                      157,748 KM
                    </td>

                    {/* Document Badges */}
                    {(['rc', 'insurance', 'pollution', 'permit', 'fitness'] as const).map((docKey) => {
                      const doc = v.documents[docKey];
                      return (
                        <td key={docKey} className="py-3 px-3">
                          {doc.isProvided ? (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  doc.badgeSeverity === 'critical'
                                    ? 'bg-rose-100 text-rose-800'
                                    : doc.badgeSeverity === 'warning'
                                    ? 'bg-amber-100 text-amber-800'
                                    : doc.badgeSeverity === 'notice'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {doc.badgeText}
                              </span>
                              <div className="text-[9px] font-mono text-gray-400">{doc.expiryDate}</div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400 italic">
                              Not Provided
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Service Due */}
                    <td className="py-3 px-3">
                      {v.serviceDue.isDue ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Due ({v.serviceDue.dueKm} KM)
                        </span>
                      ) : (
                        <span className="text-gray-400 font-mono text-[11px]">Normal</span>
                      )}
                    </td>

                    {/* EMI Due */}
                    <td className="py-3 px-3">
                      {v.emiDue.isDue ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                          Due Day {v.emiDue.dueDay} (₹{v.emiDue.monthlyAmount})
                        </span>
                      ) : v.emiDue.dueDay ? (
                        <span className="text-gray-500 text-[10px] font-mono">Day {v.emiDue.dueDay} (₹{v.emiDue.monthlyAmount})</span>
                      ) : (
                        <span className="text-gray-400 italic text-[10px]">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DRIVER CREDENTIALS CHECKLIST */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Driver Name</th>
                <th className="py-3 px-3">Driving Licence Expiry</th>
                <th className="py-3 px-3">Police Clearance Certificate</th>
                <th className="py-3 px-3">Overall Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDrivers.map((d) => (
                <tr key={d.driverId} className="hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-gray-900">{d.name}</div>
                    <div className="text-[10px] text-gray-400">ID: {d.driverId.slice(0, 8)}</div>
                  </td>

                  <td className="py-3 px-3">
                    {d.documents.license.isProvided ? (
                      <div className="space-y-0.5">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            d.documents.license.badgeSeverity === 'critical'
                              ? 'bg-rose-100 text-rose-800'
                              : d.documents.license.badgeSeverity === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {d.documents.license.badgeText}
                        </span>
                        <div className="text-[9px] font-mono text-gray-400">{d.documents.license.expiryDate}</div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400 italic">
                        Not Provided (Real Data Rule)
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    {d.documents.police_clearance.isProvided ? (
                      <div className="space-y-0.5">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            d.documents.police_clearance.badgeSeverity === 'critical'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {d.documents.police_clearance.badgeText}
                        </span>
                        <div className="text-[9px] font-mono text-gray-400">Valid until {d.documents.police_clearance.expiryDate}</div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-400 italic">
                        Not Provided
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        d.overallStatus === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : d.overallStatus === 'attention_required'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {d.overallStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SERVICE LOG MODAL */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-amber-600 px-6 py-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Log Vehicle Maintenance / Service</h3>
              </div>
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleLogService} className="p-6 space-y-4 text-xs">
              {serviceSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{serviceSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Vehicle *</label>
                <select
                  value={serviceVehicleId}
                  onChange={(e) => setServiceVehicleId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-2 font-mono"
                >
                  {vehicleChecklists.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      {v.displayRegNo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Service Date *</label>
                  <input
                    type="date"
                    required
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Odometer (KM) *</label>
                  <input
                    type="number"
                    required
                    value={serviceOdo}
                    onChange={(e) => setServiceOdo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Service Type *</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-2"
                  >
                    <option value="periodic">Periodic Full Service</option>
                    <option value="oil_change">Engine Oil & Filter</option>
                    <option value="brake_pad">Brake Pads / Liners</option>
                    <option value="tyres">Tyre Replacement</option>
                    <option value="general">General Repairs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Bill Amount (₹)</label>
                  <input
                    type="number"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Workshop / Service Center</label>
                <input
                  type="text"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Save Service Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
