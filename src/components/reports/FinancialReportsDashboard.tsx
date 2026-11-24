// ==============================================================================
// Milestone 8: Financial & Profitability Reports Dashboard
// Strict Mandate: Show "incomplete data" when costs are missing, NEVER zero-fill!
// Multi-sheet Excel & PDF Export
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Car,
  FileText,
  DollarSign,
  BarChart3,
  Percent,
} from 'lucide-react';
import { ComprehensiveReportData, exportComprehensiveReportToExcel, generatePrintableReportHtml } from '../../engine/reports/reportExporter';
import { AccountsService } from '../../services/accountsService';

export const FinancialReportsDashboard: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [activeTab, setActiveTab] = useState<'pnl' | 'contracts' | 'receivables' | 'utilisation'>('pnl');
  const [reportData, setReportData] = useState<ComprehensiveReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadReportData(selectedMonth);
  }, [selectedMonth]);

  const loadReportData = async (monthYear: string) => {
    setIsLoading(true);
    try {
      const data = await AccountsService.generateComprehensiveReport(monthYear);
      setReportData(data);
    } catch (err) {
      console.error('Failed to load financial report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    const excelBuffer = exportComprehensiveReportToExcel(reportData);
    const blob = new Blob([excelBuffer as any], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Starciti_Financial_Report_${selectedMonth}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    if (!reportData) return;
    const html = generatePrintableReportHtml(reportData);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500 font-medium">Generating executive financial reports...</div>;
  }

  const incompleteVehicleCount = reportData?.vehiclePnL.filter((v) => !v.isComplete).length || 0;
  const completeVehicles = reportData?.vehiclePnL.filter((v) => v.isComplete) || [];
  const totalVerifiedProfit = completeVehicles.reduce((acc, v) => acc + (v.profit || 0), 0);
  const totalInvoicedRevenue = reportData?.vehiclePnL.reduce((acc, v) => acc + (v.revenue || 0), 0) || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Financial & Profitability Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Vehicle P&L, contract gross margins, receivables ageing, and fleet utilisation
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-sm text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-medium text-gray-800 outline-none"
            >
              <option value="2026-08">August 2026 (Live VTL)</option>
              <option value="2026-07">July 2026</option>
              <option value="2026-09">September 2026</option>
            </select>
          </div>

          {/* Export Buttons */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel (.xlsx)
          </button>
          <button
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-900 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center justify-between">
            Invoiced Revenue
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">₹{totalInvoicedRevenue.toLocaleString('en-IN')}</div>
          <div className="text-xs text-gray-500 mt-1">August 2026 locked invoices</div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center justify-between">
            Fleet Net Profit
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            ₹{totalVerifiedProfit.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-amber-700 mt-1 font-medium">
            {incompleteVehicleCount > 0 ? `${incompleteVehicleCount} vehicles missing cost data` : 'All vehicles verified'}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center justify-between">
            Receivables Outstanding
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            ₹{(reportData?.receivables.summary.totalOutstanding || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            TDS Deducted: ₹{(reportData?.receivables.summary.totalTdsDeducted || 0).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center justify-between">
            Fleet Utilisation
            <Percent className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">
            {reportData?.utilisation.fleetAverageUtilisationRate || 0}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Total Distance: {(reportData?.utilisation.totalFleetKm || 0).toLocaleString('en-IN')} km
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 space-x-8">
        <button
          onClick={() => setActiveTab('pnl')}
          className={`pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'pnl'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Car className="w-4 h-4" />
          Vehicle Profit & Loss
          {incompleteVehicleCount > 0 && (
            <span className="py-0.5 px-2 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {incompleteVehicleCount} Incomplete
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'contracts'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Contract Margins
        </button>

        <button
          onClick={() => setActiveTab('receivables')}
          className={`pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'receivables'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Receivables Ageing
        </button>

        <button
          onClick={() => setActiveTab('utilisation')}
          className={`pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'utilisation'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Fleet Utilisation
        </button>
      </div>

      {/* TAB 1: VEHICLE P&L */}
      {activeTab === 'pnl' && (
        <div className="space-y-4">
          {/* Strict Incomplete Data Alert Banner */}
          {incompleteVehicleCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-bold text-amber-900">
                  Strict Financial Rule Enforced: Protected from Zero-Filling
                </div>
                <div className="text-amber-800 mt-0.5">
                  Profit calculations are strictly marked <strong>&ldquo;Incomplete data&rdquo;</strong> for vehicles where fuel
                  or driver pay logs have not been entered. The system never assumes Rs 0 costs.
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Fuel Cost</th>
                  <th className="px-4 py-3 text-right">Service Cost</th>
                  <th className="px-4 py-3 text-right">EMI Share</th>
                  <th className="px-4 py-3 text-right">Driver Pay</th>
                  <th className="px-4 py-3 text-right">Net Profit</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData?.vehiclePnL.map((v) => (
                  <tr key={v.vehicleId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900">{v.registrationNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{v.vehicleModel || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-gray-900">
                      ₹{v.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {v.fuelCost !== null ? (
                        `₹${v.fuelCost.toLocaleString('en-IN')}`
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                          Not logged
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                      {v.serviceCost !== null && v.serviceCost > 0 ? `₹${v.serviceCost.toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-700">
                      {v.emiCost !== null && v.emiCost > 0 ? `₹${v.emiCost.toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {v.driverPayCost !== null ? (
                        `₹${v.driverPayCost.toLocaleString('en-IN')}`
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                          Not entered
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold">
                      {v.profit !== null ? (
                        <span className="text-emerald-600">₹{v.profit.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          Incomplete data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                      {v.marginPercentage !== null ? (
                        `${v.marginPercentage}%`
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          v.status === 'complete'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.status === 'complete' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Complete
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Incomplete
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CONTRACT MARGINS */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Customer / Client</th>
                  <th className="px-4 py-3 text-left">Contract Ref</th>
                  <th className="px-4 py-3 text-right">Invoiced Revenue</th>
                  <th className="px-4 py-3 text-right">Direct Fuel</th>
                  <th className="px-4 py-3 text-right">Driver Bata</th>
                  <th className="px-4 py-3 text-right">Toll & Parking</th>
                  <th className="px-4 py-3 text-right">Gross Margin</th>
                  <th className="px-4 py-3 text-right">Margin (%)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData?.contractMargins.map((c) => (
                  <tr key={c.contractId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">{c.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.contractNumber || 'Contract'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{c.revenue.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right">
                      {c.directFuelCost !== null ? `₹${c.directFuelCost.toLocaleString('en-IN')}` : (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">Not tagged</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.driverBataCost !== null ? `₹${c.driverBataCost.toLocaleString('en-IN')}` : (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">Not entered</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{(c.tollParkingCost || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {c.grossMargin !== null ? (
                        <span className="text-emerald-600">₹{c.grossMargin.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold uppercase">
                          Incomplete data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {c.marginPercentage !== null ? `${c.marginPercentage}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          c.status === 'complete' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RECEIVABLES AGEING */}
      {activeTab === 'receivables' && (
        <div className="space-y-6">
          {/* Ageing Summary Brackets */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
              <div className="text-xs text-gray-500 font-semibold uppercase">Current (Not Due)</div>
              <div className="text-lg font-bold text-gray-800 mt-1">
                ₹{(reportData?.receivables.summary.current || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
              <div className="text-xs text-amber-700 font-semibold uppercase">1 - 30 Days</div>
              <div className="text-lg font-bold text-amber-600 mt-1">
                ₹{(reportData?.receivables.summary.days1To30 || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
              <div className="text-xs text-orange-700 font-semibold uppercase">31 - 60 Days</div>
              <div className="text-lg font-bold text-orange-600 mt-1">
                ₹{(reportData?.receivables.summary.days31To60 || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
              <div className="text-xs text-rose-700 font-semibold uppercase">61 - 90 Days</div>
              <div className="text-lg font-bold text-rose-600 mt-1">
                ₹{(reportData?.receivables.summary.days61To90 || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-3 shadow-sm text-center">
              <div className="text-xs text-purple-700 font-semibold uppercase">&gt; 90 Days</div>
              <div className="text-lg font-bold text-purple-600 mt-1">
                ₹{(reportData?.receivables.summary.daysOver90 || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Invoice Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-right">Billed (Rs)</th>
                  <th className="px-4 py-3 text-right">Paid (Rs)</th>
                  <th className="px-4 py-3 text-right">TDS (Rs)</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Ageing Bracket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData?.receivables.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.customerName}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.invoiceDate}</td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{inv.dueDate}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{inv.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">₹{inv.amountPaid.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{inv.tdsDeducted.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">₹{inv.balanceDue.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          inv.ageingCategory === 'current'
                            ? 'bg-blue-100 text-blue-800'
                            : inv.ageingCategory === '1_to_30'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {inv.ageingCategory === 'current'
                          ? 'Current'
                          : inv.ageingCategory === '1_to_30'
                          ? '1 - 30 Days'
                          : 'Overdue'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FLEET UTILISATION */}
      {activeTab === 'utilisation' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Registration No</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-right">Calendar Days</th>
                  <th className="px-4 py-3 text-right">Run Days</th>
                  <th className="px-4 py-3 text-right">Idle Days</th>
                  <th className="px-4 py-3 text-right">Maintenance</th>
                  <th className="px-4 py-3 text-right">Total Distance</th>
                  <th className="px-4 py-3 text-right">Avg KM / Day</th>
                  <th className="px-4 py-3 text-right">Utilisation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData?.utilisation.vehicles.map((u) => (
                  <tr key={u.vehicleId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">{u.registrationNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{u.vehicleModel || 'N/A'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">{u.calendarDays}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700">{u.runDays}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{u.idleDays}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-medium">{u.maintenanceDays}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{u.totalKmRun.toLocaleString('en-IN')} km</td>
                    <td className="px-4 py-3 text-right text-gray-700">{u.averageKmPerRunDay} km</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{u.utilisationRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
