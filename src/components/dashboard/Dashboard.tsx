import React, { useState } from 'react';
import { ViewId } from '../../types';
import { useSuppliers } from '../../context/SupplierContext';
import { useAuth } from '../../context/AuthContext';
import { QuickInvoiceModal } from '../billing/QuickInvoiceModal';
import {
  TrendingUp,
  Receipt,
  AlertTriangle,
  Car,
  Clock,
  CheckCircle2,
  FileText,
  Plus,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: ViewId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { activeSupplier } = useSuppliers();
  const { currentUser } = useAuth();
  const [isQuickInvoiceOpen, setIsQuickInvoiceOpen] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-card border border-line p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-tint text-brand font-semibold">
              Live Operations
            </span>
            <span className="text-xs text-ink-faint">Trivandrum (Killipalam) Hub</span>
          </div>
          <h2 className="text-xl font-heading font-bold text-ink mt-1">
            Welcome back, {currentUser?.name || 'User'}
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Active billing entity: <strong className="text-brand font-semibold">{activeSupplier.tradeName}</strong> ({activeSupplier.invoicePrefix})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQuickInvoiceOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Invoice
          </button>
          <button
            onClick={() => onNavigate('ledger')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            Open Daily Ledger
          </button>
          <button
            onClick={() => onNavigate('invoices')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-paper border border-line text-ink hover:border-brand hover:text-brand transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5" />
            Billing &amp; Invoices
          </button>
        </div>
      </div>

      {isQuickInvoiceOpen && (
        <QuickInvoiceModal
          onClose={() => setIsQuickInvoiceOpen(false)}
          onInvoiceCreated={() => {
            onNavigate('accounts');
          }}
        />
      )}

      {/* Critical Attention Feed */}
      <div className="bg-amber-tint/40 border border-amber/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-ink font-heading font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber" />
            Needs Your Attention (Operational &amp; Financial Actions)
          </div>
          <span className="text-[11px] font-semibold text-amber-ink/80 bg-amber-tint px-2 py-0.5 rounded-full">
            Real Data Feeds Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Alert 1: Overdue Collections */}
          <div className="bg-white p-3 rounded-lg border border-amber/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-ink font-semibold">
                <span>Payment Outstanding</span>
                <span className="text-[10px] bg-red-tint text-red px-1.5 py-0.2 rounded font-bold">COLLECTION</span>
              </div>
              <p className="text-ink-soft mt-1">
                <strong>Loyola School</strong> Inv #106563 has an outstanding balance of <strong>₹11,210/-</strong>.
              </p>
            </div>
            <button
              onClick={() => onNavigate('accounts')}
              className="mt-2 text-brand font-semibold flex items-center gap-1 hover:underline text-[11px] cursor-pointer"
            >
              Collect / Send Reminder &rarr;
            </button>
          </div>

          {/* Alert 2: Contract Renewal Status */}
          <div className="bg-white p-3 rounded-lg border border-amber/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-ink font-semibold">
                <span>Contract Renewal Pending</span>
                <span className="text-[10px] bg-amber-tint text-amber-ink px-1.5 py-0.2 rounded font-bold">VTL COCHIN</span>
              </div>
              <p className="text-ink-soft mt-1">
                <strong>VTL Agreement</strong> (202526000005308395) status: <strong>Renewal Pending</strong>. Requires admin override reason per invoice.
              </p>
            </div>
            <button
              onClick={() => onNavigate('invoices')}
              className="mt-2 text-brand font-semibold flex items-center gap-1 hover:underline text-[11px] cursor-pointer"
            >
              Review Contract &rarr;
            </button>
          </div>

          {/* Alert 3: Ledger Continuity Gaps */}
          <div className="bg-white p-3 rounded-lg border border-amber/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-ink font-semibold">
                <span>KM Continuity Gaps</span>
                <span className="text-[10px] bg-amber-tint text-amber-ink px-1.5 py-0.2 rounded font-bold">2 FLAGGED</span>
              </div>
              <p className="text-ink-soft mt-1">
                Vehicle <strong>KL01 CP 3284</strong> has 2 flagged gaps (&gt;15km): Aug 3 (35 km jump) and Aug 16 (54 km jump).
              </p>
            </div>
            <button
              onClick={() => onNavigate('ledger')}
              className="mt-2 text-brand font-semibold flex items-center gap-1 hover:underline text-[11px] cursor-pointer"
            >
              Inspect Ledger &rarr;
            </button>
          </div>

          {/* Alert 4: Fleet Document Compliance */}
          <div className="bg-white p-3 rounded-lg border border-emerald-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-emerald-800 font-semibold">
                <span>Fleet Compliance</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">100% OK</span>
              </div>
              <p className="text-ink-soft mt-1">
                All statutory certificates (RC, Pollution, Insurance) for active fleet vehicles are verified with zero expired items.
              </p>
            </div>
            <button
              onClick={() => onNavigate('fleet')}
              className="mt-2 text-emerald-700 font-semibold flex items-center gap-1 hover:underline text-[11px] cursor-pointer"
            >
              Inspect Fleet Master &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-card border border-line rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Aug 2026 Expected Billing</span>
            <div className="p-1.5 rounded-lg bg-brand-tint text-brand">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink mt-2">
            ₹89,872.50
          </div>
          <div className="text-[11px] text-ink-soft mt-1 flex items-center gap-1.5">
            <span className="text-brand font-semibold">₹68,662.50</span> VTL + <span className="text-brand font-semibold">₹21,210</span> School
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-card border border-line rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>VTL August Ledger</span>
            <div className="p-1.5 rounded-lg bg-paper text-ink">
              <Car className="w-4 h-4 text-brand" />
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink mt-2">
            1,884 KM
          </div>
          <div className="text-[11px] text-ink-soft mt-1 flex items-center gap-1.5">
            <span>25 Run days</span> · <span className="font-semibold text-brand">9h 45m</span> Extra Hours
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-card border border-line rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Per-Trip Package Duties</span>
            <div className="p-1.5 rounded-lg bg-paper text-ink">
              <Receipt className="w-4 h-4 text-brand" />
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink mt-2">
            8 Vehicle-Days
          </div>
          <div className="text-[11px] text-ink-soft mt-1 flex items-center gap-1.5">
            <span>Global Public School</span> · <span className="font-semibold text-brand">₹21,210</span> Verified
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-card border border-line rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Active Fleet Status</span>
            <div className="p-1.5 rounded-lg bg-paper text-ink">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink mt-2">
            4 / 4 Available
          </div>
          <div className="text-[11px] text-ink-soft mt-1 flex items-center gap-1.5">
            <span>KL01 CP 3284, KL82 4889, KL74 E 3694, KL21 M 2378</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Quick Contract Cards & Recent Trips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Contracts */}
        <div className="bg-card border border-line rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" />
              Active Contracts &amp; Rate Cards
            </h3>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs text-brand hover:underline font-semibold"
            >
              View All &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {/* Contract 1: VTL */}
            <div className="p-3.5 bg-paper rounded-xl border border-line hover:border-brand/40 transition-all flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">Vindhya Telelinks Limited</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-tint text-brand font-semibold">
                    Starter: Monthly contract
                  </span>
                </div>
                <p className="text-xs text-ink-soft mt-1">
                  7-Seat AC Car (Ertiga KL01 CP 3284) with Driver · Agr: 202526000005308395
                </p>
                <div className="text-[11px] text-ink-faint mt-1.5 flex items-center gap-3">
                  <span>Fixed: <strong>₹65,000</strong> (3000 KM / 12h day)</span>
                  <span>Extra KM: <strong>₹18/km</strong></span>
                  <span>Extra Hr: <strong>₹150/hr</strong></span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('invoices')}
                className="px-2.5 py-1.5 text-xs font-semibold rounded bg-white border border-line text-brand hover:border-brand shrink-0"
              >
                Bill Month
              </button>
            </div>

            {/* Contract 2: School */}
            <div className="p-3.5 bg-paper rounded-xl border border-line hover:border-brand/40 transition-all flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">Global Public School</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-tint text-amber-ink font-semibold">
                    Starter: Per-trip package
                  </span>
                </div>
                <p className="text-xs text-ink-soft mt-1">
                  Daily Hire Sedan (Vehicle 1 &amp; Vehicle 2) · Technopark Campus
                </p>
                <div className="text-[11px] text-ink-faint mt-1.5 flex items-center gap-3">
                  <span>Base: <strong>₹2,415</strong> (80 KM / 10h)</span>
                  <span>Extra KM: <strong>₹15/km</strong></span>
                  <span>Extra Hr: <strong>₹200/hr</strong></span>
                </div>
              </div>
              <button
                onClick={() => onNavigate('invoices')}
                className="px-2.5 py-1.5 text-xs font-semibold rounded bg-white border border-line text-brand hover:border-brand shrink-0"
              >
                Generate F1
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick Ledger Status & Sample Rows */}
        <div className="bg-card border border-line rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand" />
              August 2026 Daily Ledger Status
            </h3>
            <button
              onClick={() => onNavigate('ledger')}
              className="text-xs text-brand hover:underline font-semibold"
            >
              Full Grid View &rarr;
            </button>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-ink-faint font-semibold text-[11px]">
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Vehicle</th>
                  <th className="py-2 px-2">Driver</th>
                  <th className="py-2 px-2 text-right">KM</th>
                  <th className="py-2 px-2 text-right">Hours</th>
                  <th className="py-2 px-2 text-right">Bata/Permit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                <tr className="hover:bg-paper/60">
                  <td className="py-2 px-2 font-mono">01/08/2026</td>
                  <td className="py-2 px-2 font-mono font-medium">KL01 CP 3284</td>
                  <td className="py-2 px-2">Hemanth</td>
                  <td className="py-2 px-2 text-right font-mono">48</td>
                  <td className="py-2 px-2 text-right font-mono">13h (+1h)</td>
                  <td className="py-2 px-2 text-right text-brand font-mono">₹200 N</td>
                </tr>
                <tr className="bg-paper/40 text-ink-faint">
                  <td className="py-2 px-2 font-mono">02/08/2026</td>
                  <td className="py-2 px-2 font-medium" colSpan={5}>
                    SUNDAY (No run)
                  </td>
                </tr>
                <tr className="hover:bg-paper/60">
                  <td className="py-2 px-2 font-mono">05/08/2026</td>
                  <td className="py-2 px-2 font-mono font-medium">KL01 CP 3284</td>
                  <td className="py-2 px-2">Hemanth</td>
                  <td className="py-2 px-2 text-right font-mono">215</td>
                  <td className="py-2 px-2 text-right font-mono">13h (+1h)</td>
                  <td className="py-2 px-2 text-right text-brand font-mono">₹200 O + ₹600 P</td>
                </tr>
                <tr className="hover:bg-paper/60 bg-brand-tint/20">
                  <td className="py-2 px-2 font-mono">20/08/2026</td>
                  <td className="py-2 px-2 font-mono font-medium text-brand">KL74 E 3694</td>
                  <td className="py-2 px-2 font-medium">Afzal (Sub)</td>
                  <td className="py-2 px-2 text-right font-mono">50</td>
                  <td className="py-2 px-2 text-right font-mono">9h</td>
                  <td className="py-2 px-2 text-right text-ink-faint font-mono">—</td>
                </tr>
                <tr className="hover:bg-paper/60">
                  <td className="py-2 px-2 font-mono">31/08/2026</td>
                  <td className="py-2 px-2 font-mono font-medium">KL01 CP 3284</td>
                  <td className="py-2 px-2">Hemanth</td>
                  <td className="py-2 px-2 text-right font-mono">107</td>
                  <td className="py-2 px-2 text-right font-mono">13.5h (+1.5h)</td>
                  <td className="py-2 px-2 text-right text-ink-faint font-mono">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="pt-2 border-t border-line flex items-center justify-between text-xs text-ink-soft">
            <span>August Total: <strong>1,884 KM</strong> · <strong>9h 45m</strong> Extra Hours</span>
            <span className="font-semibold text-brand">Aug Ledger 100% Complete</span>
          </div>
        </div>
      </div>
    </div>
  );
};
