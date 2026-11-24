import React, { useEffect } from 'react';
import { ViewId } from '../../types';
import { useSuppliers } from '../../context/SupplierContext';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION } from '../../config/version';
import {
  Building2,
  Bell,
  Search,
  Plus,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface HeaderProps {
  currentView: ViewId;
  onOpenQuickLog?: () => void;
  onOpenMonthClose?: () => void;
  onOpenCommandPalette: () => void;
}

const VIEW_TITLES: Record<ViewId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Operational Dashboard', subtitle: 'Real-time overview of fleet, contracts, dues & action items' },
  ledger: { title: 'Daily Trip Ledger', subtitle: 'Office calendar grid & mobile driver log reconciliation' },
  invoices: { title: 'Invoices & Billing', subtitle: 'Template-driven monthly contracts & package billing' },
  customers: { title: 'Customers & Contracts', subtitle: 'Directory of institutional, school and corporate clients' },
  enquiries: { title: 'Customer Enquiries', subtitle: 'Lead capture and incoming charter requests' },
  quotes: { title: 'Quote Builder', subtitle: 'Instant multi-tier pricing with live document preview' },
  bookings: { title: 'Active Bookings', subtitle: 'Confirmed reservations and scheduled dispatches' },
  tripplanning: { title: 'Trip Planning & Dispatch', subtitle: 'Driver-vehicle matching, stay, and route planning' },
  fleet: { title: 'Fleet & Drivers', subtitle: 'Registration compliance, RC/Pollution/Permit calendar' },
  compliance: { title: 'Fleet Compliance Calendar', subtitle: 'Expiry alerts for RC, Insurance, Pollution, and Permits' },
  staff: { title: 'Staff & Attendance', subtitle: 'Duty rosters, driver advances, and bata trackers' },
  expenses: { title: 'Driver Expenses & Fuel', subtitle: 'Fuel logs with outlier and fraud detection' },
  flags: { title: 'Internal Notes & Flags', subtitle: 'Cautionary notes (strictly hidden on customer documents)' },
  accounts: { title: 'Accounts & EMI', subtitle: 'Cash ledger, bank balances, and vehicle EMI schedule' },
  reports: { title: 'Financial & Fleet Reports', subtitle: 'Vehicle profitability, contract margins & utilisation' },
  suppliers: { title: 'Supplier Profiles', subtitle: 'Legal entities, letterheads, PAN, GSTIN & bank accounts' },
  templates: { title: 'Template Builder', subtitle: 'Admin-controlled declarative JSON invoice & ledger layouts' },
  driver: { title: 'Driver Mobile PWA View', subtitle: 'Touch-optimized trip logging in English & Malayalam' },
  settings: { title: 'Settings & Module Registry', subtitle: 'Admin-controlled rules, tags, thresholds and module manifests' },
  approvals: { title: 'Customer Logbook Approvals', subtitle: 'Tokenised approval links for customer coordinators' },
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenQuickLog,
  onOpenMonthClose,
  onOpenCommandPalette,
}) => {
  const { suppliers, activeSupplier, setActiveSupplierId } = useSuppliers();
  const { currentUser } = useAuth();
  const viewInfo = VIEW_TITLES[currentView] || { title: 'Starciti Desk', subtitle: 'Fleet & Billing Desk' };

  // Global Cmd+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommandPalette]);

  // Current date check for recurring month close reminder (28th - 1st)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const isMonthClosePeriod = dayOfMonth >= 28 || dayOfMonth <= 1;

  return (
    <header role="banner" aria-label="Application Header" className="h-16 bg-card border-b border-line px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
      {/* Title & Context */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
            {viewInfo.title}
            {isMonthClosePeriod && (
              <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-amber-tint text-amber-ink border border-amber/20">
                <AlertTriangle className="w-3 h-3" />
                Month-End Close Window
              </span>
            )}
          </h1>
          <span
            data-testid="header-version-badge"
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-tint/60 text-brand-dark border border-brand/20 shadow-2xs"
            title={`Starciti Fleet Desk v${APP_VERSION} (Production Ready)`}
          >
            v{APP_VERSION}
          </span>
        </div>
        <p className="text-xs text-ink-soft hidden sm:block">
          {viewInfo.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Apple-Simple Search & Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="relative hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs bg-paper border border-line rounded-lg text-gray-700 hover:text-ink hover:border-brand/40 transition-all cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-gray-700" />
          <span className="text-gray-700 font-medium">Quick search or command...</span>
          <kbd className="text-[10px] bg-white border border-line px-1.5 py-0.5 rounded font-mono font-bold text-gray-800">
            ⌘K
          </kbd>
        </button>

        {/* Supplier Profile Switcher */}
        <div className="relative flex items-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-paper hover:bg-white transition-colors cursor-pointer group">
            <Building2 className="w-3.5 h-3.5 text-brand" />
            <select
              value={activeSupplier.id}
              onChange={(e) => setActiveSupplierId(e.target.value)}
              aria-label="Active Billing Entity"
              className="text-xs font-semibold text-ink bg-transparent border-none focus:outline-none cursor-pointer pr-1"
              title="Active Billing Entity / Letterhead"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.tradeName} ({s.invoicePrefix})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button: Quick Log */}
        {currentUser?.role !== 'customer_viewer' && (
          <button
            onClick={onOpenQuickLog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log Trip</span>
          </button>
        )}

        {/* Action Button: Month Close */}
        {currentUser?.role === 'admin' && (
          <button
            onClick={onOpenMonthClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-paper border border-line text-ink hover:border-brand hover:text-brand transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Month Close</span>
          </button>
        )}

        {/* Notifications */}
        <button
          className="p-2 text-ink-soft hover:text-ink hover:bg-paper rounded-lg transition-colors relative"
          title="Notifications & Alerts"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-amber absolute top-1.5 right-1.5 ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
};
