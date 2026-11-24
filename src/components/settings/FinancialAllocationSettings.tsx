// ==============================================================================
// Milestone 8: Financial Allocation & P&L Formula Settings Component
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Sliders, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { FinancialAllocationRules, DEFAULT_ALLOCATION_RULES } from '../../engine/accounts/types';
import { AccountsService } from '../../services/accountsService';

export const FinancialAllocationSettings: React.FC = () => {
  const [rules, setRules] = useState<FinancialAllocationRules>(DEFAULT_ALLOCATION_RULES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const current = await AccountsService.getFinancialSettings();
      setRules(current);
    } catch (err) {
      console.error('Failed to load financial settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await AccountsService.updateFinancialSettings(rules);
      setRules(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading allocation rules...</div>;
  }

  return (
    <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-start border-b pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Cost Allocation &amp; P&amp;L Rules
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Configure how vehicle profits, driver wages, and EMI shares are apportioned in executive reports.
          </p>
        </div>
        {savedSuccess && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Settings saved to database
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Strict Incomplete Data Rule */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
              <span className="font-bold text-sm text-amber-900">
                Strict Incomplete Data Protection (Never Zero-Fill)
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rules.costCompletenessStrict}
                onChange={(e) => setRules({ ...rules, costCompletenessStrict: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            When enabled, the system <strong>strictly refuses to compute a profit figure</strong> if any required cost
            (fuel logs, driver bata/salary, or vehicle EMI) has not been entered. It marks the vehicle as{' '}
            <span className="font-semibold">&ldquo;Incomplete data&rdquo;</span> rather than assuming ₹0 cost.
          </p>
        </div>

        {/* Driver Pay Calculation Method */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Driver Pay Calculation Method
            </label>
            <select
              value={rules.driverPayMethod}
              onChange={(e) => setRules({ ...rules, driverPayMethod: e.target.value as any })}
              className="w-full border rounded-lg p-2.5 text-sm bg-white font-medium text-gray-800"
            >
              <option value="actual_or_daily_bata">Actual Driver Bata / Trip Allowance (Contract Linked)</option>
              <option value="flat_monthly_salary">Flat Monthly Driver Salary</option>
              <option value="manual_only">Manual Input Only (Settlement Logs)</option>
            </select>
            <p className="text-xs text-gray-500">
              Determines how driver compensation is attributed to the vehicle&apos;s monthly expenditure.
            </p>
          </div>

          {/* EMI Allocation Method */}
          <div className="border rounded-xl p-4 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Loan EMI Apportionment Method
            </label>
            <select
              value={rules.emiAllocationMethod}
              onChange={(e) => setRules({ ...rules, emiAllocationMethod: e.target.value as any })}
              className="w-full border rounded-lg p-2.5 text-sm bg-white font-medium text-gray-800"
            >
              <option value="actual_vehicle_emi">Vehicle-Specific Loan EMI (Actual Bank Debit)</option>
              <option value="pro_rata_revenue">Pro-Rata Fleet Revenue Share</option>
            </select>
            <p className="text-xs text-gray-500">
              Applied to financed fleet vehicles (e.g. HDFC Auto Loan for KL 01 CP 3284 Ertiga).
            </p>
          </div>
        </div>

        {/* Cost Components in P&L */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Mandatory Cost Items Included in Net Profit Calculation
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 text-sm font-medium text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.includeFuelInPnl}
                onChange={(e) => setRules({ ...rules, includeFuelInPnl: e.target.checked })}
                className="rounded text-indigo-600"
              />
              Fuel Expenses
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 text-sm font-medium text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.includeDriverPayInPnl}
                onChange={(e) => setRules({ ...rules, includeDriverPayInPnl: e.target.checked })}
                className="rounded text-indigo-600"
              />
              Driver Pay / Bata
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 text-sm font-medium text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.includeEmiInPnl}
                onChange={(e) => setRules({ ...rules, includeEmiInPnl: e.target.checked })}
                className="rounded text-indigo-600"
              />
              Vehicle Loan EMI
            </label>
            <label className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 text-sm font-medium text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={rules.includeServiceInPnl}
                onChange={(e) => setRules({ ...rules, includeServiceInPnl: e.target.checked })}
                className="rounded text-indigo-600"
              />
              Routine Maintenance
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm"
          >
            Save Allocation Rules
          </button>
        </div>
      </form>
    </div>
  );
};
