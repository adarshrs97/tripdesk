import React, { useState, useEffect } from 'react';
import { useModules } from '../../context/ModuleContext';
import { SupplierProfileManager } from '../suppliers/SupplierProfileManager';
import { UserManagement } from './UserManagement';
import { SeriesAdmin } from './SeriesAdmin';
import { TaxProfilesManager } from './TaxProfilesManager';
import { ItemCatalogueManager } from './ItemCatalogueManager';
import { FuelThresholdsManager } from './FuelThresholdsManager';
import { ComplianceSettingsManager } from './ComplianceSettingsManager';
import { TemplateGalleryManager } from './TemplateGalleryManager';
import { FinancialAllocationSettings } from './FinancialAllocationSettings';
import { TariffsPricingManager } from './TariffsPricingManager';
import { GoLiveChecklist } from './GoLiveChecklist';
import {
  SettingsService,
  VocabularyItem,
  DEFAULT_OFFICE_VOCABULARY,
} from '../../services/settingsService';
import {
  Settings,
  Sliders,
  Layers,
  Tag,
  CheckCircle2,
  Sparkles,
  Languages,
  Check,
  Shield,
} from 'lucide-react';

interface SettingsManagerProps {
  onOpenSetupWizard?: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({ onOpenSetupWizard }) => {
  const [activeTab, setActiveTab] = useState<
    | 'modules'
    | 'suppliers'
    | 'rules'
    | 'lists'
    | 'users'
    | 'series'
    | 'taxes'
    | 'catalogue'
    | 'tariffs'
    | 'fuel'
    | 'compliance'
    | 'templates'
    | 'financial'
    | 'golive'
  >('golive');
  const { modules, toggleModule } = useModules();

  // Rules State
  const [kmGapThreshold, setKmGapThreshold] = useState<number>(15);
  const [maxDailyHours, setMaxDailyHours] = useState<number>(16);
  const [roundingMode, setRoundingMode] = useState<'down' | 'nearest' | 'none'>('down');
  const [nightBataStartHour, setNightBataStartHour] = useState<string>('06:00');
  const [nightBataCloseHour, setNightBataCloseHour] = useState<string>('22:00');
  const [approvalGateMode, setApprovalGateMode] = useState<'advisory' | 'mandatory'>('advisory');

  // Lists & Vocabulary
  const [tags, setTags] = useState<string[]>([
    'AVP', 'VB', 'CE', 'PH', 'VP', 'Kachani', 'Kattakada KSEB', 'Kanyakumari', 'Airport', 'Guest House', 'Kollam'
  ]);
  const [newTagInput, setNewTagInput] = useState('');

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    if (!tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Office Vocabulary State (English + Malayalam) - Stored in Database Settings Table with RLS
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(DEFAULT_OFFICE_VOCABULARY);
  const [vocabSavedToast, setVocabSavedToast] = useState(false);
  const [vocabSaving, setVocabSaving] = useState(false);

  useEffect(() => {
    SettingsService.getVocabulary().then((data) => {
      if (data && data.length > 0) {
        setVocabulary(data);
      }
    });
  }, []);

  const handleUpdateVocab = (key: string, newMalayalam: string) => {
    setVocabulary((prev: VocabularyItem[]) =>
      prev.map((item) => (item.key === key ? { ...item, malayalam: newMalayalam } : item))
    );
  };

  const handleSaveVocab = async () => {
    setVocabSaving(true);
    try {
      await SettingsService.saveVocabulary(vocabulary);
      setVocabSavedToast(true);
      setTimeout(() => setVocabSavedToast(false), 2500);
    } catch (err: any) {
      alert(`Error saving vocabulary to database: ${err.message}`);
    } finally {
      setVocabSaving(false);
    }
  };

  const handleResetVocab = async () => {
    setVocabSaving(true);
    try {
      await SettingsService.saveVocabulary(DEFAULT_OFFICE_VOCABULARY);
      setVocabulary(DEFAULT_OFFICE_VOCABULARY);
      setVocabSavedToast(true);
      setTimeout(() => setVocabSavedToast(false), 2500);
    } catch (err: any) {
      alert(`Error resetting vocabulary: ${err.message}`);
    } finally {
      setVocabSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-card border border-line p-5 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand" />
            System Settings &amp; Module Registry
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Admin-controlled configuration. Rules stay in code (tested), while layout, modules, tags, thresholds and permissions are data edited here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenSetupWizard && (
            <button
              type="button"
              onClick={onOpenSetupWizard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              First-Run Setup Wizard
            </button>
          )}

          {/* Tab Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-paper border border-line rounded-lg shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('golive')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'golive'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 hover:text-amber-900 bg-amber-50/80 border border-amber-200/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Go-live checklist
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'modules' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Modules &amp; Plugins
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'rules' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Rules &amp; Thresholds
          </button>
          <button
            onClick={() => setActiveTab('lists')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'lists' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Tags &amp; Vocabulary
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'suppliers' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Billing Entities
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'users' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Users &amp; Roles
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'series' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Series Admin
          </button>
          <button
            onClick={() => setActiveTab('taxes')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'taxes' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Tax Profiles
          </button>
          <button
            onClick={() => setActiveTab('catalogue')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'catalogue' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Item Catalogue
          </button>
          <button
            onClick={() => setActiveTab('tariffs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'tariffs' ? 'bg-white text-emerald-800 shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Tariffs &amp; Pricing
          </button>
          <button
            onClick={() => setActiveTab('fuel')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'fuel' ? 'bg-white text-amber-800 shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Fuel Thresholds
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'compliance' ? 'bg-white text-amber-800 shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Compliance Alerts
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'templates' ? 'bg-white text-indigo-800 shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Invoice Templates
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'financial' ? 'bg-white text-indigo-800 shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            Cost Allocation
          </button>
        </div>
        </div>
      </div>

      {/* TAB: GO-LIVE CHECKLIST */}
      {activeTab === 'golive' && (
        <GoLiveChecklist onNavigateTab={(tab) => setActiveTab(tab)} />
      )}

      {/* TAB 1: MODULE REGISTRY */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          <div className="p-4 bg-brand-tint/30 border border-brand/20 rounded-xl text-xs text-brand-dark flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <div>
              <strong>Modular Architecture Principle:</strong> Disabled optional modules automatically vanish from the navigation, command palette, and dashboard. No dead buttons or clutter. Core billing, ledger, and master modules remain locked for integrity.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className={`bg-card border rounded-xl p-4 flex items-start justify-between gap-4 transition-all ${
                  mod.isEnabled ? 'border-line' : 'border-line/60 opacity-60 bg-paper/30'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-bold text-sm text-ink">
                      {mod.name}
                    </h4>
                    {mod.isCore ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper border border-line font-mono font-semibold text-ink-soft">
                        CORE
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-tint text-brand font-semibold capitalize">
                        {mod.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                    {mod.description}
                  </p>
                  <div className="text-[11px] text-ink-faint mt-2">
                    Nav group: <code className="bg-paper px-1 py-0.5 rounded text-ink">{mod.navParent}</code>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  {mod.isCore ? (
                    <span className="text-xs text-brand font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Locked
                    </span>
                  ) : (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mod.isEnabled}
                        onChange={(e) => toggleModule(mod.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: RULES & THRESHOLDS */}
      {activeTab === 'rules' && (
        <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b border-line pb-4">
            <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand" />
              Operational Rules &amp; Anomaly Thresholds
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Admin-configurable rules applied across daily ledger continuity checks, billing calculations, and close gates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rule 1: KM Gap */}
            <div className="p-4 bg-paper rounded-xl border border-line space-y-2">
              <label htmlFor="km-gap-threshold-input" className="block text-xs font-bold text-ink">
                Ledger KM Continuity Gap Threshold (Default: 15 km)
              </label>
              <p className="text-[11px] text-ink-soft">
                Flags an anomaly in the Review Queue when today&apos;s start KM exceeds yesterday&apos;s close KM by more than this limit.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <input
                  id="km-gap-threshold-input"
                  aria-label="Ledger KM continuity gap threshold limit"
                  type="number"
                  value={kmGapThreshold}
                  onChange={(e) => setKmGapThreshold(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-24 px-3 py-1.5 text-xs font-mono border border-line rounded-lg bg-white text-gray-800"
                />
                <span className="text-xs font-semibold text-ink">km jump limit</span>
              </div>
            </div>

            {/* Rule 2: Max Daily Hours */}
            <div className="p-4 bg-paper rounded-xl border border-line space-y-2">
              <label htmlFor="max-daily-hours-input" className="block text-xs font-bold text-ink">
                Max Daily Driver Duty Limit
              </label>
              <p className="text-[11px] text-ink-soft">
                Flags a safety &amp; fatigue warning if trip duration exceeds this daily threshold without substitution.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <input
                  id="max-daily-hours-input"
                  aria-label="Max daily driver duty limit in hours"
                  type="number"
                  value={maxDailyHours}
                  onChange={(e) => setMaxDailyHours(Number(e.target.value))}
                  min={8}
                  max={24}
                  className="w-24 px-3 py-1.5 text-xs font-mono border border-line rounded-lg bg-white text-gray-800"
                />
                <span className="text-xs font-semibold text-ink">hours per day</span>
              </div>
            </div>

            {/* Rule 3: Invoice Rounding Mode */}
            <div className="p-4 bg-paper rounded-xl border border-line space-y-2">
              <label htmlFor="rounding-mode-select" className="block text-xs font-bold text-ink">
                Default Invoice Rounding Rule
              </label>
              <p className="text-[11px] text-ink-soft">
                Historical invoices round down to the whole rupee (e.g. ₹68,617.50 &rarr; ₹68,617).
              </p>
              <div className="flex items-center gap-3 pt-2">
                <select
                  id="rounding-mode-select"
                  aria-label="Default invoice rounding rule"
                  value={roundingMode}
                  onChange={(e) => setRoundingMode(e.target.value as any)}
                  className="px-3 py-1.5 text-xs font-semibold border border-line rounded-lg bg-white text-gray-800"
                >
                  <option value="down">Round Down (Floor to whole Rupee)</option>
                  <option value="nearest">Round to Nearest Rupee</option>
                  <option value="none">No Rounding (Exact Paise)</option>
                </select>
              </div>
            </div>

            {/* Rule 4: Night Bata Trigger */}
            <div className="p-4 bg-paper rounded-xl border border-line space-y-2">
              <label className="block text-xs font-bold text-ink">
                Night Bata Automatic Trigger Window
              </label>
              <p className="text-[11px] text-ink-soft">
                Triggered automatically if trip start is earlier than start time or close is later than close time.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span>Start before:</span>
                  <input
                    type="time"
                    aria-label="Night bata start window time"
                    value={nightBataStartHour}
                    onChange={(e) => setNightBataStartHour(e.target.value)}
                    className="px-2 py-1 text-xs border border-line rounded bg-white text-gray-800"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span>Close after:</span>
                  <input
                    type="time"
                    aria-label="Night bata close window time"
                    value={nightBataCloseHour}
                    onChange={(e) => setNightBataCloseHour(e.target.value)}
                    className="px-2 py-1 text-xs border border-line rounded bg-white text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* Rule 5: Approval Gate */}
            <div className="p-4 bg-paper rounded-xl border border-line space-y-2">
              <label htmlFor="approval-gate-select" className="block text-xs font-bold text-ink">
                Customer Logbook Approval Gate Mode
              </label>
              <p className="text-[11px] text-ink-soft">
                Controls whether customer WhatsApp approval is advisory or a hard requirement to issue an invoice.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <select
                  id="approval-gate-select"
                  aria-label="Customer logbook approval gate mode"
                  value={approvalGateMode}
                  onChange={(e) => setApprovalGateMode(e.target.value as any)}
                  className="px-3 py-1.5 text-xs font-semibold border border-line rounded-lg bg-white text-gray-800"
                >
                  <option value="advisory">Advisory (Soft Gate - Admin can override)</option>
                  <option value="mandatory">Mandatory (Hard Gate - Approval required)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TAGS & VOCABULARY */}
      {activeTab === 'lists' && (
        <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b border-line pb-4">
            <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand" />
              Managed Route Tags &amp; Remark Vocabulary
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Pre-configured quick tags available for driver mobile app suggestions and office autocomplete.
            </p>
          </div>

          <div>
            <form onSubmit={handleAddTag} className="flex items-center gap-2 max-w-md mb-4">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Enter new site/route code (e.g. Technopark)..."
                className="flex-1 px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors"
              >
                Add Tag
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand-tint text-brand-dark border border-brand/20"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-brand hover:text-red transition-colors text-xs font-bold"
                    title={`Remove ${tag}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Section 2: Malayalam Office Vocabulary (Editable) */}
          <div className="pt-6 border-t border-line space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
                  <Languages className="w-4 h-4 text-emerald-600" />
                  Office &amp; Driver Vocabulary Dictionary (English ↔ Malayalam)
                </h4>
                <p className="text-xs text-ink-soft mt-0.5">
                  Editable terms used across the driver mobile PWA and office labels. Modify Malayalam translations to suit regional fleet dialect.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {vocabSavedToast && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetVocab}
                  className="px-3 py-1.5 text-xs text-ink-soft hover:text-ink border border-line rounded-lg bg-paper font-medium transition-colors"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSaveVocab}
                  disabled={vocabSaving}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs disabled:opacity-50"
                >
                  {vocabSaving ? 'Saving...' : 'Save Vocabulary'}
                </button>
              </div>
            </div>

            <div className="border border-line rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="min-w-full divide-y divide-line text-xs">
                <thead className="bg-paper text-ink-soft font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Key / Concept</th>
                    <th className="px-4 py-2.5 text-left">English Office Term</th>
                    <th className="px-4 py-2.5 text-left">Malayalam Translation (Editable)</th>
                    <th className="px-4 py-2.5 text-left">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vocabulary.map((item: any) => (
                    <tr key={item.key} className="hover:bg-paper/50">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-ink-faint">
                        {item.key}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-ink">
                        {item.english}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={item.malayalam}
                          onChange={(e) => handleUpdateVocab(item.key, e.target.value)}
                          className="w-full max-w-xs px-2.5 py-1 text-xs border border-line rounded-md focus:border-brand focus:outline-none font-medium text-emerald-900 bg-emerald-50/30"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-block px-2 py-0.5 rounded bg-paper border border-line text-ink font-medium">
                          {item.malayalam || item.english}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RLS Storage Notice */}
            <div className="p-3 bg-paper border border-line rounded-lg flex items-center gap-2 text-xs text-ink-soft">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Row-Level Security:</strong> Stored in PostgreSQL table <code>public.settings</code> (row key: <code>system.vocabulary</code>). All roles (driver, staff, admin) read this directly; updates strictly restricted to administrators.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <SupplierProfileManager />
      )}

      {/* TAB 5: USERS & ROLES */}
      {activeTab === 'users' && (
        <UserManagement />
      )}

      {/* TAB 6: SERIES ADMIN */}
      {activeTab === 'series' && (
        <SeriesAdmin />
      )}

      {/* TAB 7: TAX PROFILES */}
      {activeTab === 'taxes' && (
        <TaxProfilesManager />
      )}

      {/* TAB 8: ITEM CATALOGUE */}
      {activeTab === 'catalogue' && (
        <ItemCatalogueManager />
      )}

      {/* TAB: TARIFFS & PRICING */}
      {activeTab === 'tariffs' && (
        <TariffsPricingManager />
      )}

      {/* TAB 9: FUEL THRESHOLDS */}
      {activeTab === 'fuel' && (
        <FuelThresholdsManager />
      )}

      {/* TAB 10: COMPLIANCE ALERT THRESHOLDS */}
      {activeTab === 'compliance' && (
        <ComplianceSettingsManager />
      )}

      {/* TAB 11: INVOICE TEMPLATES GALLERY & BUILDER */}
      {activeTab === 'templates' && (
        <TemplateGalleryManager />
      )}

      {/* TAB 12: FINANCIAL & COST ALLOCATION RULES */}
      {activeTab === 'financial' && (
        <FinancialAllocationSettings />
      )}
    </div>
  );
};
