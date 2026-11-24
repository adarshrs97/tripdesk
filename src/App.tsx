import React, { useState } from 'react';
import { ViewId } from './types';
import { SupplierProvider } from './context/SupplierContext';
import { AuthProvider } from './context/AuthContext';
import { ModuleProvider } from './context/ModuleContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { SupplierProfileManager } from './components/suppliers/SupplierProfileManager';
import { SettingsManager } from './components/settings/SettingsManager';
import { CustomersView } from './components/masters/CustomersView';
import { FleetView } from './components/masters/FleetView';
import { TemplateBuilder } from './components/templates/TemplateBuilder';
import { OfficeLedgerGrid } from './components/ledger/OfficeLedgerGrid';
import { DriverMobileView } from './components/ledger/DriverMobileView';
import { CustomerApprovalPortal } from './components/ledger/CustomerApprovalPortal';
import { MonthCloseWizard } from './components/billing/MonthCloseWizard';
import { AccountsHub } from './components/accounts/AccountsHub';
import { FinancialReportsDashboard } from './components/reports/FinancialReportsDashboard';
import { FuelExpensesReviewQueue } from './components/expenses/FuelExpensesReviewQueue';
import { FleetComplianceDashboard } from './components/fleet/FleetComplianceDashboard';
import { InternalFlagsManager } from './components/flags/InternalFlagsManager';
import { CommandPalette } from './components/common/CommandPalette';
import { PlaceholderView } from './components/common/PlaceholderView';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { FirstRunSetupWizard } from './components/setup/FirstRunSetupWizard';
import { SettingsService } from './services/settingsService';
import { EnquiriesView } from './components/dispatch/EnquiriesView';
import { QuoteBuilderView } from './components/dispatch/QuoteBuilderView';
import { BookingsView } from './components/dispatch/BookingsView';
import { TripPlanningView } from './components/dispatch/TripPlanningView';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const getInitialView = (): ViewId => {
    const rawHash = window.location.hash.replace('#', '');
    const hash = rawHash.split('?')[0] as ViewId;
    const validViews: ViewId[] = [
      'dashboard', 'ledger', 'invoices', 'customers', 'fleet',
      'settings', 'suppliers', 'templates', 'driver', 'approvals', 'enquiries', 'quotes', 'bookings', 'tripplanning', 'accounts', 'expenses', 'compliance', 'flags', 'reports'
    ];
    if (validViews.includes(hash)) return hash;
    return 'dashboard';
  };

  const [currentView, setCurrentView] = useState<ViewId>(getInitialView);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  React.useEffect(() => {
    SettingsService.getSetupState().then((state) => {
      if (!state.completed && !localStorage.getItem('starciti_setup_completed')) {
        setIsSetupWizardOpen(true);
      }
    });
  }, []);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ViewId;
      if (hash && hash !== currentView) {
        setCurrentView(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentView]);

  const handleNavigate = (view: ViewId) => {
    window.location.hash = view;
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={(v) => setCurrentView(v)} />;

      case 'settings':
        return <SettingsManager onOpenSetupWizard={() => setIsSetupWizardOpen(true)} />;

      case 'suppliers':
        return <SupplierProfileManager />;

      case 'templates':
        return <TemplateBuilder />;

      case 'ledger':
        return (
          <OfficeLedgerGrid
            onOpenDriverView={() => handleNavigate('driver')}
            onOpenCustomerApproval={() => handleNavigate('approvals')}
            onOpenMonthClose={() => handleNavigate('invoices')}
          />
        );

      case 'driver':
        return <DriverMobileView onBackToOffice={() => handleNavigate('ledger')} />;

      case 'invoices':
        return <MonthCloseWizard />;

      case 'customers':
        return <CustomersView />;

      case 'fleet':
        return <FleetView />;

      case 'enquiries':
        return <EnquiriesView onNavigateToQuote={() => handleNavigate('quotes')} />;

      case 'quotes':
        return (
          <QuoteBuilderView
            onNavigateToBooking={() => handleNavigate('bookings')}
          />
        );

      case 'bookings':
        return (
          <BookingsView
            onNavigateToInvoice={() => handleNavigate('invoices')}
            onNavigateToTripPlanning={() => handleNavigate('tripplanning')}
          />
        );

      case 'tripplanning':
        return <TripPlanningView />;

      case 'compliance':
        return <FleetComplianceDashboard />;

      case 'staff':
        return (
          <PlaceholderView
            viewId="staff"
            title="Staff, Drivers & Attendance"
            milestone="Milestone 7"
            description="Manage driver attendance, daily bata allowances, salary advances, and monthly settlements."
            features={[
              "Driver duty attendance marker (Running, Leave, Holiday, Substitute)",
              "Salary advances log with monthly deduction automation",
              "Night bata and outstation bata monthly reconciler",
              "Driver performance and trip count metrics"
            ]}
          />
        );

      case 'expenses':
        return <FuelExpensesReviewQueue />;

      case 'flags':
        return <InternalFlagsManager />;

      case 'accounts':
        return <AccountsHub />;

      case 'reports':
        return <FinancialReportsDashboard />;

      case 'approvals':
        return <CustomerApprovalPortal onBackToDesk={() => handleNavigate('ledger')} />;

      default:
        return <Dashboard onNavigate={(v) => setCurrentView(v)} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-ink-soft">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
          <span>Verifying Supabase Auth session...</span>
        </div>
      </div>
    );
  }

  // Standalone full-screen portals for Driver PWA & Customer WhatsApp Sign-Off
  if (currentView === 'driver' || currentView === 'approvals') {
    return (
      <div className="min-h-screen bg-gray-50 text-ink">
        {renderView()}
      </div>
    );
  }

  // Real Supabase Auth Guard: Show LoginView if no active session
  if (!currentUser) {
    return <LoginView onLoginSuccess={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="flex h-screen bg-paper overflow-hidden text-ink">
      {/* Apple-Simple Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={handleNavigate}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentView={currentView}
          onOpenQuickLog={() => setCurrentView('ledger')}
          onOpenMonthClose={() => setCurrentView('invoices')}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setCurrentView}
      />

      {/* First-Run Setup Wizard */}
      <FirstRunSetupWizard
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
        onComplete={() => setIsSetupWizardOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <SupplierProvider>
        <AuthProvider>
          <ModuleProvider>
            <AppContent />
          </ModuleProvider>
        </AuthProvider>
      </SupplierProvider>
    </ErrorBoundary>
  );
}

export default App;
