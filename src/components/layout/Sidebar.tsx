import React, { useState } from 'react';
import { ViewId, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useSuppliers } from '../../context/SupplierContext';
import { useModules } from '../../context/ModuleContext';
import { TopNavParent } from '../../modules/manifest';
import { APP_VERSION } from '../../config/version';
import { QuickInvoiceModal } from '../billing/QuickInvoiceModal';
import {
  LayoutDashboard,
  BookOpen,
  Receipt,
  Building,
  Car,
  MoreHorizontal,
  ChevronRight,
  Command,
  Plus,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewId;
  onSelectView: (view: ViewId) => void;
  onOpenCommandPalette: () => void;
}

interface TopNavItem {
  id: TopNavParent;
  defaultView: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: 'brand' | 'amber' | 'red';
  minRole?: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onOpenCommandPalette,
}) => {
  const { currentUser, setCurrentRole, canAccess, logout } = useAuth();
  const { activeSupplier } = useSuppliers();
  const { getModulesForNav } = useModules();
  const [isQuickInvoiceOpen, setIsQuickInvoiceOpen] = useState(false);

  // Strict Apple-Simple 6 Top-Level Nav Items
  const topNavItems: TopNavItem[] = [
    { id: 'home', defaultView: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'ledger', defaultView: 'ledger', label: 'Trip Ledger', icon: BookOpen, badge: 'Aug 26', badgeColor: 'brand' },
    { id: 'invoices', defaultView: 'invoices', label: 'Invoices', icon: Receipt, badge: '2 Due', badgeColor: 'amber' },
    { id: 'customers', defaultView: 'customers', label: 'Customers', icon: Building, minRole: 'staff' },
    { id: 'fleet', defaultView: 'fleet', label: 'Fleet & Drivers', icon: Car, minRole: 'staff' },
    { id: 'more', defaultView: 'settings', label: 'More & Settings', icon: MoreHorizontal, minRole: 'staff' },
  ];

  // Determine active parent
  const activeParent: TopNavParent = (() => {
    if (currentView === 'dashboard') return 'home';
    if (currentView === 'ledger' || currentView === 'approvals') return 'ledger';
    if (currentView === 'invoices') return 'invoices';
    if (currentView === 'customers' || currentView === 'quotes' || currentView === 'bookings' || currentView === 'enquiries' || currentView === 'tripplanning') return 'customers';
    if (currentView === 'fleet' || currentView === 'compliance' || currentView === 'expenses' || currentView === 'staff') return 'fleet';
    return 'more';
  })();

  const subModules = getModulesForNav(activeParent);

  return (
    <aside role="navigation" aria-label="Primary Navigation" className="w-64 bg-sidebar-bg text-sidebar-ink flex flex-col h-screen select-none border-r border-sidebar-active/60 shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-sidebar-active/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-heading font-bold text-base shadow-md shadow-brand/20">
            S
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-sidebar-white tracking-tight text-sm">
                Starciti Desk
              </span>
              <span
                data-testid="sidebar-version-badge"
                className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-sidebar-active text-emerald-400 border border-emerald-500/30"
                title={`Starciti Fleet Desk v${APP_VERSION}`}
              >
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-sidebar-ink/70 truncate">
              {activeSupplier.tradeName}
            </p>
          </div>
        </div>

        {/* Cmd+K icon button */}
        <button
          onClick={onOpenCommandPalette}
          aria-label="Open Command Palette"
          className="p-1.5 rounded-md hover:bg-sidebar-active text-sidebar-ink hover:text-white transition-colors cursor-pointer"
          title="Command Palette (Cmd+K / Ctrl+K)"
        >
          <Command className="w-4 h-4 text-brand" />
        </button>
      </div>

      {/* Main 6 Top-Level Nav Items */}
      <div className="px-3 pt-3 pb-2 space-y-1">
        <button
          onClick={() => setIsQuickInvoiceOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-brand text-white hover:bg-brand-dark rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer mb-2"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ New Quick Invoice</span>
        </button>

        <div className="px-3 text-[10px] font-semibold tracking-wider text-sidebar-ink/40 uppercase">
          PRIMARY NAVIGATION
        </div>
        {topNavItems.map((item) => {
          if (!canAccess(item.minRole)) return null;

          const Icon = item.icon;
          const isParentActive = activeParent === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.defaultView)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all group ${
                isParentActive
                  ? 'bg-sidebar-active text-sidebar-white shadow-xs border border-brand/30'
                  : 'text-sidebar-ink hover:text-sidebar-white hover:bg-sidebar-active/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isParentActive ? 'text-brand' : 'text-sidebar-ink/70 group-hover:text-sidebar-white'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      item.badgeColor === 'brand'
                        ? 'bg-brand/25 text-emerald-300'
                        : item.badgeColor === 'amber'
                        ? 'bg-amber-900/40 text-amber-300'
                        : 'bg-red-900/40 text-red-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isParentActive && <ChevronRight className="w-3.5 h-3.5 text-brand" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Sub-Module Navigation (Only for enabled modules) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 border-t border-sidebar-active/60 space-y-1">
        <div className="px-3 text-[10px] font-semibold tracking-wider text-sidebar-ink/40 uppercase flex items-center justify-between">
          <span>{topNavItems.find(t => t.id === activeParent)?.label} Sub-Pages</span>
          <span className="text-[9px] text-emerald-400 font-mono">{subModules.length} Active</span>
        </div>

        {subModules.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-sidebar-ink/50 italic">
            No active sub-pages
          </div>
        ) : (
          subModules.map((mod) => {
            const isSubActive = currentView === mod.viewId;

            return (
              <button
                key={mod.id}
                onClick={() => onSelectView(mod.viewId as ViewId)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSubActive
                    ? 'bg-brand/20 text-emerald-200 border border-brand/30'
                    : 'text-sidebar-ink/80 hover:text-white hover:bg-sidebar-active/40'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0"></span>
                  <span className="truncate">{mod.navLabel || mod.name}</span>
                </div>
                {mod.badge && (
                  <span className="text-[9px] px-1 rounded bg-brand/30 text-emerald-300">
                    {mod.badge}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* User Role Switcher Footer */}
      <div className="p-3 border-t border-sidebar-active/80 bg-black/20">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-sidebar-active/60 border border-sidebar-active">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-brand-dark text-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden text-left">
              <div className="text-xs font-medium text-sidebar-white truncate">
                {currentUser?.name || 'Authorized User'}
              </div>
              <div className="text-[10px] text-sidebar-ink/60 capitalize flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                {currentUser?.role ? currentUser.role.replace('_', ' ') : 'Active'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Role switcher strictly for local dev testing; eliminated in production */}
            {!import.meta.env.PROD && currentUser && (
              <select
                value={currentUser.role}
                onChange={(e) => setCurrentRole(e.target.value as any)}
                className="text-[11px] bg-sidebar-bg text-sidebar-ink border border-sidebar-active rounded px-1.5 py-1 focus:outline-none focus:border-brand cursor-pointer"
                title="Dev Role Switcher (Removed in Production)"
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="driver">Driver</option>
                <option value="customer_viewer">Customer</option>
              </select>
            )}

            <button
              onClick={() => logout()}
              className="p-1 rounded text-sidebar-ink/70 hover:text-red-400 hover:bg-sidebar-active transition-colors cursor-pointer"
              title="Sign Out of Supabase Auth"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-1.5 px-2 flex items-center justify-between text-[10px] text-sidebar-ink/50 font-mono">
          <span>Starciti Desk v{APP_VERSION}</span>
          <span className="text-emerald-500/80">Self-Hosted</span>
        </div>
      </div>

      {isQuickInvoiceOpen && (
        <QuickInvoiceModal
          onClose={() => setIsQuickInvoiceOpen(false)}
          onInvoiceCreated={() => {
            onSelectView('accounts');
          }}
        />
      )}
    </aside>
  );
};
