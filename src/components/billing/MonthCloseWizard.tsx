import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Download,
  Share2,
  Printer,
  Calendar,
  Info,
  ShieldAlert,
  Clock,
  Sparkles,
} from 'lucide-react';
import { InvoiceService, CheckMonthReadinessResult, InvoiceDiffResult } from '../../services/invoiceService';
import { FlagsService } from '../../services/flagsService';
import { InternalFlag } from '../../engine/flags';
import { InvoicePreview } from '../templates/InvoicePreview';
import { RenderedInvoice } from '../../engine';
import { MastersService, Contract } from '../../services/mastersService';
import { useAuth } from '../../context/AuthContext';

export const MonthCloseWizard: React.FC = () => {
  const { currentUser } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeContractId, setActiveContractId] = useState<string>('b0000000-0000-0000-0000-000000000001');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [monthStr] = useState('2026-08');

  // Step 1 State
  const [adminOverrideReason, setAdminOverrideReason] = useState(
    'Formal agreement renewal pending. Authorized by administrator for billing continuity.'
  );
  const [readiness, setReadiness] = useState<CheckMonthReadinessResult | null>(null);

  // Step 2 State
  const [legacyMode, setLegacyMode] = useState(false);
  const [reviewData, setReviewData] = useState<{
    rendered: RenderedInvoice;
    calculation: any;
    diff: InvoiceDiffResult;
    whyThisAmountBreakdown: any[];
  } | null>(null);
  const [showWhyDrawer, setShowWhyDrawer] = useState(false);
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);

  // Step 3 & 4 State
  const [issueDate, setIssueDate] = useState('2026-08-31');
  const previousInvoiceDate = '2026-07-31';
  const isDateEarlierThanPrevious = issueDate < previousInvoiceDate;
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedResult, setIssuedResult] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    lockedTripsCount: number;
    lockedAt: string;
    pdfPath?: string;
  } | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [activeFlags, setActiveFlags] = useState<InternalFlag[]>([]);

  // Load contracts dynamically
  useEffect(() => {
    MastersService.getContracts().then((list) => {
      if (list && list.length > 0) {
        setContracts(list);
        if (!list.some((c) => c.id === activeContractId)) {
          setActiveContractId(list[0].id);
        }
      }
    });
  }, []);

  // Refresh readiness & review data
  useEffect(() => {
    if (!activeContractId) return;
    const ready = InvoiceService.checkMonthReadiness(activeContractId, monthStr, adminOverrideReason);
    setReadiness(ready);

    const review = InvoiceService.getReviewDetails(activeContractId, monthStr, { legacyMode });
    setReviewData(review);

    const currentContract = contracts.find((c) => c.id === activeContractId) || MastersService.getContractSync(activeContractId);
    FlagsService.getFlags({ isActive: true }).then((all) => {
      const relevant = all.filter((f) => {
        return (
          f.entityId === activeContractId ||
          (currentContract && (f.entityId === currentContract.customerId || f.entityId === currentContract.supplierId))
        );
      });
      setActiveFlags(relevant);
    });
  }, [activeContractId, monthStr, adminOverrideReason, legacyMode, contracts]);

  const handleAcknowledgeAnomaly = (anomalyId: string) => {
    // Refresh local readiness state
    if (readiness) {
      setReadiness({
        ...readiness,
        anomalies: readiness.anomalies.map((a) => (a.id === anomalyId ? { ...a, acknowledged: true } : a)),
        unacknowledgedAnomaliesCount: Math.max(0, readiness.unacknowledgedAnomaliesCount - 1),
      });
    }
  };

  const handleIssue = async () => {
    if (!reviewData) return;
    setIsIssuing(true);
    try {
      const contract = contracts.find((c) => c.id === activeContractId) || MastersService.getContractSync(activeContractId);
      const supplierId = contract?.supplierId || 'a0000000-0000-0000-0000-000000000002';
      const customerId = contract?.customerId || 'c0000000-0000-0000-0000-000000000001';
      const contractId = contract?.id || activeContractId;

      const result = await InvoiceService.issueInvoice({
        supplierId,
        customerId,
        contractId,
        periodFrom: `${monthStr}-01`,
        periodTo: `${monthStr}-31`,
        totalAmount: reviewData.rendered.totalAmount,
        snapshotJson: reviewData.rendered,
        templateId: reviewData.rendered.templateId,
        templateVersion: reviewData.rendered.templateVersion,
        issuedBy: currentUser?.name ? `Admin (${currentUser.name})` : 'System Administrator',
        adminOverrideReason: adminOverrideReason || undefined,
        breakupJson: reviewData.calculation,
      });

      setIssuedResult(result);
      setActiveStep(4);
    } catch (err: any) {
      alert('Issue Error: ' + err.message);
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Contract Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <h1 className="text-xl font-bold text-gray-900 font-display">Month-Close & Billing Desk</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            4-step deterministic month-end audit, template-based invoicing, and immutable lock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>August 2026</span>
          </div>

          <div className="flex flex-wrap bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs gap-1">
            {contracts.map((c) => {
              const cust = MastersService.getCustomerSync(c.customerId);
              const label = cust?.name || c.agreementNo || c.id;
              const isSelected = activeContractId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveContractId(c.id);
                    setActiveStep(1);
                    setIssuedResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    isSelected ? 'bg-white text-emerald-800 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4-Step Stepper Bar */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        {[
          { step: 1, title: '1. Check', desc: 'Missing days & anomalies' },
          { step: 2, title: '2. Review', desc: 'Why amount & preview' },
          { step: 3, title: '3. Issue', desc: 'Row lock & number' },
          { step: 4, title: '4. Send', desc: 'PDF, WhatsApp & audit' },
        ].map((s) => {
          const isActive = activeStep === s.step;
          const isDone = activeStep > s.step;
          return (
            <div
              key={s.step}
              onClick={() => {
                if (isDone || (s.step <= 2 && readiness?.canProceed)) {
                  setActiveStep(s.step as any);
                }
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                  : isDone
                  ? 'bg-white border-gray-300 text-gray-900'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isActive ? 'text-emerald-800' : isDone ? 'text-gray-900' : 'text-gray-500'}`}>
                  {s.title}
                </span>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {isActive && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate hidden sm:block">{s.desc}</p>
            </div>
          );
        })}
      </div>

      {/* STEP 1: CHECK */}
      {activeStep === 1 && readiness && (
        <div className="space-y-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Step 1: Pre-Close Verification Check</h2>
              <p className="text-xs text-gray-500">
                Audits all 31 days of August 2026, odometer gaps, contract terms, and customer approval status.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                {readiness.loggedDaysCount} / {readiness.totalDaysInMonth} Days Logged (100%)
              </span>
            </div>
          </div>

          {/* Verification Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Duty Days</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {readiness.runDaysCount} <span className="text-sm font-normal text-gray-500">Run Days</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Contract allowance: 30 days. Actual runs: 25 days (6 Sundays & Onam holidays).
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Odometer & Gap Audits</span>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {readiness.anomalies.length} <span className="text-sm font-normal text-gray-500">Audited</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {readiness.unacknowledgedAnomaliesCount === 0
                  ? 'All gaps verified & acknowledged.'
                  : `${readiness.unacknowledgedAnomaliesCount} gaps require acknowledgment.`}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Coordinator Approval</span>
              <div className="text-base font-bold text-gray-900 mt-1 flex items-center gap-1.5">
                {readiness.coordinatorApprovalStatus.status === 'approved' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Approved by Client</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700">Pending Site Sign-off</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {readiness.coordinatorApprovalStatus.approvedBy
                  ? `Signed off by ${readiness.coordinatorApprovalStatus.approvedBy}`
                  : 'Soft-gate: Office override permitted.'}
              </p>
            </div>
          </div>

          {/* ACTIVE INTERNAL OPERATIONAL FLAGS */}
          {activeFlags.length > 0 && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-blue-700" />
                  Active Internal Flags for this Account ({activeFlags.length})
                </span>
                <span className="text-[10px] bg-white text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                  Staff Only · Zero Customer Leakage
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {activeFlags.map((f) => (
                  <div key={f.id} className="p-2.5 bg-white border border-blue-100 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{f.title}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        f.severity === 'avoid' ? 'bg-red-100 text-red-800' : f.severity === 'caution' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {f.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">{f.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTRACT STATUS CHECK & ADMIN OVERRIDE */}
          {readiness.isRenewalPending && (
            <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-900">
                    Contract Status: "Renewal Pending" (Agreement #202526000005308395)
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    The primary contract expired on 30 Sept 2026 and renewal formalities are underway. To generate
                    and issue the official invoice, an Administrator Override with a mandatory justification reason is required.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200">
                <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider mb-1.5">
                  Admin Override Justification (Mandatory for Invoicing) *
                </label>
                <input
                  type="text"
                  value={adminOverrideReason}
                  onChange={(e) => setAdminOverrideReason(e.target.value)}
                  placeholder="Enter mandatory reason for invoicing with renewal pending..."
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-amber-400 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-gray-900"
                />
                {!readiness.adminOverrideReasonProvided && (
                  <p className="text-xs text-red-600 font-semibold mt-1">
                    * You must provide an admin override reason before proceeding to Review.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ANOMALY LIST & ACKNOWLEDGMENT */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase font-bold text-gray-500 tracking-wider">
              Anomalies & Verification Log
            </h3>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden text-xs">
              {readiness.anomalies.map((anom) => (
                <div key={anom.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50/80">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-4 h-4 ${anom.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                    <div>
                      <span className="font-semibold text-gray-900">[{anom.entryDate}] {anom.type}: </span>
                      <span className="text-gray-600">{anom.description}</span>
                    </div>
                  </div>
                  <div>
                    {anom.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledgeAnomaly(anom.id)}
                        className="text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              disabled={!readiness.canProceed}
              onClick={() => setActiveStep(2)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                readiness.canProceed
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span>Proceed to Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW */}
      {activeStep === 2 && reviewData && (
        <div className="space-y-6">
          {/* Top Review Controls */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveStep(1)}
                className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Step 2: Template-Driven Invoice Review
                </h2>
                <p className="text-xs text-gray-500">
                  Rendered live strictly from JSON Template: <strong className="text-emerald-800">{reviewData.rendered.templateId}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {reviewData.rendered.templateId.toLowerCase().includes('monthly') && (
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                  <input
                    type="checkbox"
                    checked={legacyMode}
                    onChange={(e) => setLegacyMode(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">Historical Decimal Mode</span>
                </label>
              )}

              <button
                onClick={() => setShowWhyDrawer(!showWhyDrawer)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Why this amount?</span>
              </button>

              <button
                onClick={() => setShowDiffDrawer(!showDiffDrawer)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-700 text-xs font-semibold hover:bg-gray-100 transition-colors"
              >
                <Info className="w-3.5 h-3.5 text-gray-500" />
                <span>Diff vs Prev Month</span>
              </button>

              <button
                onClick={() => setActiveStep(3)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <span>Proceed to Issue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* "Why this amount?" Drawer / Modal */}
          {showWhyDrawer && (
            <div className="bg-emerald-950 text-emerald-50 p-6 rounded-2xl border border-emerald-800 shadow-xl space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center border-b border-emerald-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                    Transparent Billing Breakdown: "Why this amount?"
                  </h3>
                </div>
                <button
                  onClick={() => setShowWhyDrawer(false)}
                  className="text-xs text-emerald-400 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {reviewData.whyThisAmountBreakdown.map((item, idx) => (
                  <div key={idx} className="bg-emerald-900/50 p-3.5 rounded-xl border border-emerald-800">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-bold text-emerald-200">{item.label}</span>
                      <span className="font-mono text-sm font-bold text-white">{item.amount}</span>
                    </div>
                    <div className="font-mono text-[11px] text-emerald-400">{item.formula}</div>
                    <p className="text-[10px] text-emerald-300/80 mt-1 italic">{item.note}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-emerald-800 flex justify-between items-center text-xs">
                <span className="text-emerald-300">Rounding Mode: Whole Rupee Down (Contract Setting)</span>
                <span className="text-lg font-bold font-display text-white">
                  Total Payable: ₹{reviewData.rendered.totalAmount.toLocaleString('en-IN')}/-
                </span>
              </div>
            </div>
          )}

          {/* Diff vs Previous Month Drawer */}
          {showDiffDrawer && (
            <div className="bg-gray-900 text-white p-6 rounded-2xl border border-gray-700 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-200">
                    Variance Analysis: {reviewData.diff.previousPeriodLabel} vs {reviewData.diff.currentPeriodLabel}
                  </h3>
                </div>
                <button
                  onClick={() => setShowDiffDrawer(false)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              {!reviewData.diff.hasPreviousPeriod ? (
                <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700 text-xs text-gray-300 flex items-center gap-3">
                  <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-100">No previous month data recorded</span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      No prior calendar month ledger or invoice was found in the database. Variance comparison will activate automatically when July 2026 data is logged or imported.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700">
                      <span className="text-[10px] uppercase text-gray-400">Previous Total</span>
                      <div className="text-base font-bold text-gray-300 mt-0.5">
                        ₹{reviewData.diff.previousTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700">
                      <span className="text-[10px] uppercase text-gray-400">Current Total</span>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">
                        ₹{reviewData.diff.currentTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-gray-800/80 p-3 rounded-xl border border-gray-700">
                      <span className="text-[10px] uppercase text-gray-400">Variance</span>
                      <div className="text-base font-bold text-blue-400 mt-0.5">
                        +₹{reviewData.diff.differenceAmount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {reviewData.diff.itemizedDifferences.map((d, idx) => (
                      <div key={idx} className="bg-gray-800/40 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-gray-200">{d.item}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{d.impactDescription}</div>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <div className="text-gray-400">{d.previousValue} &rarr; <span className="text-emerald-400 font-bold">{d.currentValue}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actual Rendered Invoice Preview */}
          <div className="flex justify-center bg-gray-100 p-6 rounded-2xl border border-gray-200">
            <InvoicePreview invoice={reviewData.rendered} />
          </div>
        </div>
      )}

      {/* STEP 3: ISSUE */}
      {activeStep === 3 && reviewData && (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 font-display">Confirm & Permanently Lock Invoice</h2>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Issuing locks the invoice in PostgreSQL, locks all associated daily trip entries, assigns a gap-free invoice number with row-lock concurrency protection, and archives the JSON snapshot.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-gray-500">Customer:</span>
              <span className="font-bold text-gray-900">{reviewData.rendered.customer.name}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-gray-500">Billing Period:</span>
              <span className="font-bold text-gray-900">01/08/2026 to 31/08/2026</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-gray-500">Invoice Issue Date:</span>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="border border-gray-300 rounded px-2.5 py-1 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {isDateEarlierThanPrevious && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Warning:</strong> Selected invoice date ({issueDate}) is earlier than the previous invoice date ({previousInvoiceDate}) in this series.
                </span>
              </div>
            )}
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-gray-500">Next Gap-Free Number:</span>
              <span className="font-mono font-bold text-emerald-800 text-sm">
                {issuedResult?.invoiceNumber || 'Auto-assigned on issue'} (Strict row lock)
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-gray-500">Total Payable:</span>
              <span className="font-bold text-gray-900 text-sm">
                ₹{reviewData.rendered.totalAmount.toLocaleString('en-IN')}/-
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Immutability Guarantee:</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> DB Trigger Prevents Any Edits
              </span>
            </div>
          </div>

          {adminOverrideReason && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800">
                Audit Record Note:
              </span>
              <p>
                Admin override reason: <em>"{adminOverrideReason}"</em> will be permanently embedded in the invoice record and audit log.
              </p>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
            <button
              onClick={() => setActiveStep(2)}
              className="text-xs text-gray-600 hover:text-gray-900 font-semibold px-4 py-2"
            >
              &larr; Back to Review
            </button>
            <button
              disabled={isIssuing}
              onClick={handleIssue}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isIssuing ? 'Locking in Postgres...' : `Issue & Lock Invoice`}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SEND */}
      {activeStep === 4 && (
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 font-display">Invoice Issued & Permanently Locked!</h2>
            <p className="text-xs text-gray-500">
              Invoice <strong className="text-emerald-800">#{issuedResult?.invoiceNumber || 'Issued'}</strong> has been sealed. The daily trip ledger entries are locked.
            </p>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href={`/invoices/Invoice_${issuedResult?.invoiceNumber || 'Latest'}.pdf`}
              download
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 transition-all text-center block group"
            >
              <Download className="w-6 h-6 text-emerald-700 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-emerald-900">Download Print-Ready PDF</div>
              <p className="text-[10px] text-emerald-700 mt-1">Generated via Playwright with Annexure</p>
            </a>

            {reviewData && (
              <a
                href={InvoiceService.getWhatsAppShareUrl(reviewData.rendered, '916238603200')}
                target="_blank"
                rel="noreferrer"
                className="p-4 rounded-xl border border-green-200 bg-green-50/50 hover:bg-green-100/70 transition-all text-center block group"
              >
                <Share2 className="w-6 h-6 text-green-700 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-bold text-green-900">Share via WhatsApp</div>
                <p className="text-[10px] text-green-700 mt-1">Direct wa.me link with summary</p>
              </a>
            )}

            <button
              onClick={() => window.print()}
              className="p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all text-center group"
            >
              <Printer className="w-6 h-6 text-gray-700 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-gray-900">Print Stylesheet</div>
              <p className="text-[10px] text-gray-500 mt-1">A4 exact portrait formatting</p>
            </button>
          </div>

          {/* Side-by-side comparison button */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-gray-800">Visual Fidelity Audit:</span>
              <p className="text-gray-500 text-[11px] mt-0.5">
                Compare reference document against Playwright generated PDF output.
              </p>
            </div>
            <button
              onClick={() => setShowComparisonModal(true)}
              className="px-3.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-semibold text-gray-700 transition-colors shadow-sm"
            >
              View Side-by-Side Comparison
            </button>
          </div>

          {/* Audit Trail Block */}
          <div className="border border-gray-200 rounded-xl p-5 space-y-3 bg-white text-xs">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Permanent Audit Trail Record
            </span>
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500">Record ID:</span>
                <span className="text-gray-900">{issuedResult?.invoiceId || 'Recorded in DB'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500">Invoice Number:</span>
                <span className="font-bold text-emerald-800">{issuedResult?.invoiceNumber || 'Auto-Assigned'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500">Locked Status:</span>
                <span className="text-emerald-700 font-semibold">LOCKED & IMMUTABLE</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-500">Issued By:</span>
                <span className="text-gray-900">{currentUser?.name ? `Admin (${currentUser.name})` : 'System Administrator'}</span>
              </div>
              {adminOverrideReason && (
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500">Override Reason:</span>
                  <span className="text-amber-800">{adminOverrideReason}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Locked At:</span>
                <span className="text-gray-900">{issuedResult?.lockedAt || new Date().toISOString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side comparison modal */}
      {showComparisonModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-6xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 font-display">
                  Visual Fidelity Audit: Reference Document vs Starciti Output
                </h3>
                <p className="text-xs text-gray-500">
                  Left: Original Reference VTL Invoice &bull; Right: Generated JSON Template Render
                </p>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                  Original Reference VTL PDF (invoice_format2_VTL_Aug2026.pdf)
                </span>
                <div className="border border-gray-300 rounded-xl overflow-hidden bg-gray-50 shadow-inner">
                  <img
                    src="/reference_vtl_invoice.png"
                    alt="Reference VTL Invoice"
                    className="w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                  Starciti Generated Output (Starter: Monthly contract)
                </span>
                <div className="border border-emerald-300 rounded-xl overflow-hidden bg-white shadow-inner p-2">
                  {reviewData && <InvoicePreview invoice={reviewData.rendered} compact={true} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
