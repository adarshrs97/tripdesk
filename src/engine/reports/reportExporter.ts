// ==============================================================================
// Milestone 8: Multi-Sheet Excel & PDF Report Exporter
// ==============================================================================

import * as XLSX from 'xlsx';
import { VehiclePnLResult, ContractMarginResult } from './pnlEngine';
import { ReceivablesAgeingReport } from './receivablesEngine';
import { FleetUtilisationSummary } from './utilisationEngine';

export interface ComprehensiveReportData {
  monthYear: string;
  generatedAt: string;
  firmName: string;
  vehiclePnL: VehiclePnLResult[];
  contractMargins: ContractMarginResult[];
  receivables: ReceivablesAgeingReport;
  utilisation: FleetUtilisationSummary;
}

/**
 * Builds a multi-sheet Excel workbook and returns the binary buffer.
 */
export function exportComprehensiveReportToExcel(data: ComprehensiveReportData): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: Executive Overview
  const totalRevenue = data.vehiclePnL.reduce((acc, v) => acc + (v.revenue || 0), 0);
  const completeVehicles = data.vehiclePnL.filter((v) => v.isComplete);
  const totalProfit = completeVehicles.reduce((acc, v) => acc + (v.profit || 0), 0);
  const incompleteCount = data.vehiclePnL.filter((v) => !v.isComplete).length;

  const overviewRows = [
    ['STARCITI FLEET & BILLING DESK - EXECUTIVE REPORT'],
    ['Firm / Group:', data.firmName],
    ['Reporting Month:', data.monthYear],
    ['Generated Date:', data.generatedAt],
    [],
    ['KEY PERFORMANCE INDICATORS', 'VALUE', 'UNIT / STATUS'],
    ['Total Fleet Invoiced Revenue', totalRevenue, 'INR'],
    ['Fleet Net Profit (Complete Cost Data)', totalProfit, 'INR'],
    ['Vehicles with Incomplete Cost Data', incompleteCount, 'Vehicles (Protected from Zero-Fill)'],
    ['Total Receivables Outstanding', data.receivables.summary.totalOutstanding, 'INR'],
    ['Total TDS Deducted Across Invoices', data.receivables.summary.totalTdsDeducted, 'INR'],
    ['Total Fleet Distance Run', data.utilisation.totalFleetKm, 'KM'],
    ['Fleet Average Utilisation Rate', `${data.utilisation.fleetAverageUtilisationRate}%`, 'Run Days / Total Days'],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Executive_Overview');

  // 2. Sheet 2: Vehicle P&L
  const pnlHeaders = [
    'Registration No',
    'Model',
    'Month',
    'Revenue (Rs)',
    'Fuel Cost (Rs)',
    'Service Cost (Rs)',
    'EMI Share (Rs)',
    'Driver Pay (Rs)',
    'Total Costs (Rs)',
    'Net Profit (Rs)',
    'Margin (%)',
    'Status',
    'Missing Cost Items / Remarks',
  ];

  const pnlRows = data.vehiclePnL.map((v) => [
    v.registrationNumber,
    v.vehicleModel || 'N/A',
    v.monthYear,
    v.revenue,
    v.fuelCost ?? 'Not logged',
    v.serviceCost ?? 'None / 0',
    v.emiCost ?? 'None / 0',
    v.driverPayCost ?? 'Not entered',
    v.totalCosts !== null ? v.totalCosts : 'Incomplete data',
    v.profit !== null ? v.profit : 'Incomplete data',
    v.marginPercentage !== null ? `${v.marginPercentage}%` : 'Incomplete data',
    v.status === 'complete' ? 'Complete' : 'INCOMPLETE DATA',
    v.missingCostItems.length > 0 ? v.missingCostItems.join('; ') : 'All costs verified',
  ]);

  const wsPnL = XLSX.utils.aoa_to_sheet([pnlHeaders, ...pnlRows]);
  XLSX.utils.book_append_sheet(wb, wsPnL, 'Vehicle_PnL');

  // 3. Sheet 3: Contract Margins
  const contractHeaders = [
    'Customer Name',
    'Contract Ref',
    'Month',
    'Contract Revenue (Rs)',
    'Direct Fuel (Rs)',
    'Driver Bata (Rs)',
    'Toll & Parking (Rs)',
    'Total Direct Costs (Rs)',
    'Gross Margin (Rs)',
    'Margin (%)',
    'Status',
    'Missing Cost Items',
  ];

  const contractRows = data.contractMargins.map((c) => [
    c.customerName,
    c.contractNumber || 'Contract',
    c.monthYear,
    c.revenue,
    c.directFuelCost ?? 'Not logged',
    c.driverBataCost ?? 'Not entered',
    c.tollParkingCost ?? 0,
    c.totalDirectCosts !== null ? c.totalDirectCosts : 'Incomplete data',
    c.grossMargin !== null ? c.grossMargin : 'Incomplete data',
    c.marginPercentage !== null ? `${c.marginPercentage}%` : 'Incomplete data',
    c.status === 'complete' ? 'Complete' : 'INCOMPLETE DATA',
    c.missingCostItems.length > 0 ? c.missingCostItems.join('; ') : 'Verified',
  ]);

  const wsContract = XLSX.utils.aoa_to_sheet([contractHeaders, ...contractRows]);
  XLSX.utils.book_append_sheet(wb, wsContract, 'Contract_Margins');

  // 4. Sheet 4: Receivables Ageing
  const ageingHeaders = [
    'Invoice Number',
    'Customer Name',
    'Invoice Date',
    'Due Date',
    'Total Billed (Rs)',
    'Paid (Rs)',
    'TDS Deducted (Rs)',
    'Balance Due (Rs)',
    'Days Overdue',
    'Ageing Bracket',
  ];

  const ageingRows = data.receivables.invoices.map((inv) => [
    inv.invoiceNumber,
    inv.customerName,
    inv.invoiceDate,
    inv.dueDate,
    inv.totalAmount,
    inv.amountPaid,
    inv.tdsDeducted,
    inv.balanceDue,
    inv.daysOverdue <= 0 ? 0 : inv.daysOverdue,
    inv.ageingCategory === 'current'
      ? 'Current (Not Due)'
      : inv.ageingCategory === '1_to_30'
      ? '1 - 30 Days'
      : inv.ageingCategory === '31_to_60'
      ? '31 - 60 Days'
      : inv.ageingCategory === '61_to_90'
      ? '61 - 90 Days'
      : '90+ Days',
  ]);

  const wsAgeing = XLSX.utils.aoa_to_sheet([ageingHeaders, ...ageingRows]);
  XLSX.utils.book_append_sheet(wb, wsAgeing, 'Receivables_Ageing');

  // 5. Sheet 5: Fleet Utilisation
  const utilHeaders = [
    'Registration No',
    'Model',
    'Month',
    'Total Days',
    'Run Days',
    'Idle Days',
    'Maintenance Days',
    'Total Distance (KM)',
    'Avg KM / Run Day',
    'Utilisation Rate (%)',
  ];

  const utilRows = data.utilisation.vehicles.map((u) => [
    u.registrationNumber,
    u.vehicleModel || 'N/A',
    u.monthYear,
    u.calendarDays,
    u.runDays,
    u.idleDays,
    u.maintenanceDays,
    u.totalKmRun,
    u.averageKmPerRunDay,
    `${u.utilisationRate}%`,
  ]);

  const wsUtil = XLSX.utils.aoa_to_sheet([utilHeaders, ...utilRows]);
  XLSX.utils.book_append_sheet(wb, wsUtil, 'Fleet_Utilisation');

  const excelData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelData);
}

/**
 * Generates Printable HTML Executive Report for PDF Rendering
 */
export function generatePrintableReportHtml(data: ComprehensiveReportData): string {
  const totalRevenue = data.vehiclePnL.reduce((acc, v) => acc + (v.revenue || 0), 0);
  const completeVehicles = data.vehiclePnL.filter((v) => v.isComplete);
  const totalProfit = completeVehicles.reduce((acc, v) => acc + (v.profit || 0), 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Financial & Fleet Report - ${data.monthYear}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; }
    h1 { font-size: 22px; margin-bottom: 4px; color: #0f172a; }
    .header-sub { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .kpi-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
    .kpi-val { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 12px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; font-weight: 600; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .badge-incomplete { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 10px; }
    .badge-complete { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 10px; }
    .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px; border-left: 4px solid #0284c7; padding-left: 8px; }
  </style>
</head>
<body>
  <h1>${data.firmName} - Fleet & Financial Performance</h1>
  <div class="header-sub">Report Period: ${data.monthYear} | Generated: ${data.generatedAt}</div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Invoiced Revenue</div>
      <div class="kpi-val">₹${totalRevenue.toLocaleString('en-IN')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Fleet Net Profit</div>
      <div class="kpi-val">₹${totalProfit.toLocaleString('en-IN')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Receivables Outstanding</div>
      <div class="kpi-val">₹${data.receivables.summary.totalOutstanding.toLocaleString('en-IN')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Average Fleet Utilisation</div>
      <div class="kpi-val">${data.utilisation.fleetAverageUtilisationRate}%</div>
    </div>
  </div>

  <div class="section-title">Vehicle Profit & Loss (Revenue - Fuel - Service - EMI - Driver Pay)</div>
  <table>
    <thead>
      <tr>
        <th>Vehicle</th>
        <th>Model</th>
        <th class="text-right">Revenue</th>
        <th class="text-right">Fuel</th>
        <th class="text-right">Service</th>
        <th class="text-right">EMI</th>
        <th class="text-right">Driver Pay</th>
        <th class="text-right">Net Profit</th>
        <th class="text-right">Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.vehiclePnL
        .map(
          (v) => `
        <tr>
          <td><strong>${v.registrationNumber}</strong></td>
          <td>${v.vehicleModel || 'N/A'}</td>
          <td class="text-right">₹${v.revenue.toLocaleString('en-IN')}</td>
          <td class="text-right">${v.fuelCost !== null ? '₹' + v.fuelCost.toLocaleString('en-IN') : '<span class="badge-incomplete">Missing</span>'}</td>
          <td class="text-right">${v.serviceCost !== null ? '₹' + v.serviceCost.toLocaleString('en-IN') : '₹0'}</td>
          <td class="text-right">${v.emiCost !== null ? '₹' + v.emiCost.toLocaleString('en-IN') : '₹0'}</td>
          <td class="text-right">${v.driverPayCost !== null ? '₹' + v.driverPayCost.toLocaleString('en-IN') : '<span class="badge-incomplete">Missing</span>'}</td>
          <td class="text-right"><strong>${v.profit !== null ? '₹' + v.profit.toLocaleString('en-IN') : '<span class="badge-incomplete">Incomplete data</span>'}</strong></td>
          <td class="text-right"><span class="${v.status === 'complete' ? 'badge-complete' : 'badge-incomplete'}">${v.statusLabel}</span></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="section-title">Fleet Utilisation Summary</div>
  <table>
    <thead>
      <tr>
        <th>Vehicle</th>
        <th class="text-right">Total Days</th>
        <th class="text-right">Run Days</th>
        <th class="text-right">Idle Days</th>
        <th class="text-right">Maintenance</th>
        <th class="text-right">Distance Run</th>
        <th class="text-right">Avg KM / Day</th>
        <th class="text-right">Utilisation</th>
      </tr>
    </thead>
    <tbody>
      ${data.utilisation.vehicles
        .map(
          (u) => `
        <tr>
          <td><strong>${u.registrationNumber}</strong></td>
          <td class="text-right">${u.calendarDays}</td>
          <td class="text-right">${u.runDays}</td>
          <td class="text-right">${u.idleDays}</td>
          <td class="text-right">${u.maintenanceDays}</td>
          <td class="text-right">${u.totalKmRun.toLocaleString('en-IN')} km</td>
          <td class="text-right">${u.averageKmPerRunDay} km</td>
          <td class="text-right"><strong>${u.utilisationRate}%</strong></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>
  `.trim();
}
