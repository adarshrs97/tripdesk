import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Car,
  Navigation,
  Shield,
  Layers,
} from 'lucide-react';
import {
  SettingsService,
  QuoteTariffsMap,
  TariffRateItem,
} from '../../services/settingsService';
import { TariffType, VehicleCategory } from '../../engine/dispatch/types';
import { EMPTY_TARIFF_RATE, EMPTY_TARIFF_PRESETS } from '../../engine/dispatch/quoteCalculator';

const TARIFF_MODELS: Array<{ id: TariffType; label: string; description: string }> = [
  {
    id: 'local_hourly',
    label: 'Local Hourly Run',
    description: 'City duties billed on base hours & km with extra km/hr rates and daily driver bata.',
  },
  {
    id: 'outstation_daily',
    label: 'Outstation Daily Run',
    description: 'Long-distance intercity duties billed on calendar day package with minimum daily km.',
  },
  {
    id: 'airport_transfer',
    label: 'Airport Transfer',
    description: 'Fixed point-to-point transfers to/from TRV or other airports.',
  },
  {
    id: 'fixed_package',
    label: 'Fixed Tour Package',
    description: 'Special tour circuits (e.g. Kanyakumari, Ponmudi, Kovalam) with fixed inclusions.',
  },
];

const VEHICLE_CATEGORIES: Array<{ id: VehicleCategory; label: string; example: string }> = [
  { id: 'sedan', label: 'Sedan', example: 'Dzire / Etios / Amaze' },
  { id: 'suv', label: 'SUV / MUV', example: 'Ertiga / Innova / Carens' },
  { id: 'tempo', label: 'Tempo Traveller', example: '12-26 Seater Tourist Tempo' },
  { id: 'luxury', label: 'Luxury', example: 'Camry / Fortuner / Mercedes' },
];

export const TariffsPricingManager: React.FC = () => {
  const [tariffs, setTariffs] = useState<QuoteTariffsMap>({});
  const [selectedModel, setSelectedModel] = useState<TariffType>('local_hourly');
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>('sedan');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    loadTariffs();
  }, []);

  const loadTariffs = async () => {
    setIsLoading(true);
    try {
      const data = await SettingsService.getQuoteTariffs();
      setTariffs(data);
    } catch (err: any) {
      console.error('Failed to load tariffs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentRate: TariffRateItem =
    tariffs[selectedModel]?.[selectedCategory] || { ...EMPTY_TARIFF_RATE };

  const handleFieldChange = (field: keyof TariffRateItem, value: number) => {
    setTariffs((prev) => {
      const modelMap = prev[selectedModel] ? { ...prev[selectedModel] } : {};
      const catRate = modelMap[selectedCategory] ? { ...modelMap[selectedCategory] } : { ...EMPTY_TARIFF_RATE };
      catRate[field] = Math.max(0, value);
      modelMap[selectedCategory] = catRate;
      return {
        ...prev,
        [selectedModel]: modelMap,
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await SettingsService.saveQuoteTariffs(tariffs);
      setSaveStatus('Tariff rates successfully saved to database with RLS!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Error saving tariffs: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetCurrent = () => {
    handleFieldChange('baseKm', 0);
    handleFieldChange('baseHours', 0);
    handleFieldChange('baseAmount', 0);
    handleFieldChange('extraKmRate', 0);
    handleFieldChange('extraHourRate', 0);
    handleFieldChange('bataPerDay', 0);
    handleFieldChange('nightBata', 0);
  };

  const handleClearAll = async () => {
    if (window.confirm('Reset ALL quote tariff models and vehicle prices to empty (0)?')) {
      setIsSaving(true);
      try {
        await SettingsService.saveQuoteTariffs(EMPTY_TARIFF_PRESETS);
        setTariffs(EMPTY_TARIFF_PRESETS);
        setSaveStatus('All tariffs reset to empty (0).');
        setTimeout(() => setSaveStatus(null), 3000);
      } catch (err: any) {
        setSaveStatus(`Error resetting: ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Check whether any tariffs have been configured across any category
  const hasConfiguredRates = Object.values(tariffs).some((model) =>
    Object.values(model || {}).some(
      (rate) => (rate.baseAmount || 0) > 0 || (rate.extraKmRate || 0) > 0
    )
  );

  return (
    <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand" />
            Quote Tariff Models &amp; Vehicle Pricing
          </h3>
          <p className="text-xs text-ink-soft mt-0.5">
            Admin-controlled tariff rates. Per owner policy, all models start empty with zero guessed numbers.
            Configure your actual operational rates below.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All to Empty
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Tariff Rates'}
          </button>
        </div>
      </div>

      {saveStatus && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            saveStatus.includes('Error')
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {saveStatus.includes('Error') ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Empty State Banner */}
      {!hasConfiguredRates && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">No quote tariffs configured yet</span>
            <p className="text-amber-800/90 leading-relaxed">
              In accordance with owner instructions, zero arbitrary tariff numbers are seeded. The Quote Builder
              will display a notice &ldquo;Add your rates&rdquo; until you enter and save your real fleet pricing below.
            </p>
          </div>
        </div>
      )}

      {/* Model Selector Tabs */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-ink">1. Select Tariff Model</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TARIFF_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setSelectedModel(model.id)}
              className={`p-3 text-left rounded-xl border transition-all text-xs ${
                selectedModel === model.id
                  ? 'border-brand bg-brand-tint/30 text-ink shadow-xs ring-1 ring-brand'
                  : 'border-line bg-paper/50 hover:bg-white text-ink-soft'
              }`}
            >
              <div className="font-bold text-ink flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-brand" />
                {model.label}
              </div>
              <p className="text-[11px] text-ink-soft mt-1 line-clamp-2 leading-relaxed">
                {model.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Category Selector Tabs */}
      <div className="space-y-2 pt-2">
        <label className="block text-xs font-bold text-ink">2. Select Vehicle Category</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VEHICLE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                selectedCategory === cat.id
                  ? 'border-brand bg-white text-brand shadow-xs ring-1 ring-brand'
                  : 'border-line bg-paper/40 text-ink-soft hover:text-ink hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-brand" />
                <div className="text-left">
                  <div>{cat.label}</div>
                  <div className="text-[10px] font-normal text-ink-soft">{cat.example}</div>
                </div>
              </div>
              {((tariffs[selectedModel]?.[cat.id]?.baseAmount || 0) > 0) && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Configured" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Form for Selected Model & Category */}
      <div className="p-5 bg-paper rounded-xl border border-line space-y-4">
        <div className="flex justify-between items-center border-b border-line pb-3">
          <div>
            <h4 className="font-heading font-bold text-sm text-ink capitalize flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand" />
              Pricing Matrix: {selectedModel.replace('_', ' ')} &mdash; {selectedCategory}
            </h4>
            <span className="text-[11px] text-ink-soft">
              Enter base allowances and extra charges. Set to 0 if not applicable.
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetCurrent}
            className="text-xs text-ink-soft hover:text-ink underline"
          >
            Clear this vehicle
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Base Amount */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink">Base Package Amount (₹)</label>
            <input
              type="number"
              min={0}
              value={currentRate.baseAmount || ''}
              placeholder="0 (e.g. 2400)"
              onChange={(e) => handleFieldChange('baseAmount', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg bg-white text-ink focus:border-brand focus:outline-none"
            />
            <span className="text-[10px] text-ink-soft">Fixed tariff package fee</span>
          </div>

          {/* Base KM */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink">Included Package KM</label>
            <input
              type="number"
              min={0}
              value={currentRate.baseKm || ''}
              placeholder="0 (e.g. 80)"
              onChange={(e) => handleFieldChange('baseKm', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg bg-white text-ink focus:border-brand focus:outline-none"
            />
            <span className="text-[10px] text-ink-soft">Included in base fee</span>
          </div>

          {/* Base Hours */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink">Included Package Hours</label>
            <input
              type="number"
              min={0}
              value={currentRate.baseHours || ''}
              placeholder="0 (e.g. 8)"
              onChange={(e) => handleFieldChange('baseHours', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg bg-white text-ink focus:border-brand focus:outline-none"
            />
            <span className="text-[10px] text-ink-soft">Included in base fee</span>
          </div>

          {/* Extra KM Rate */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink">Extra KM Rate (₹ / km)</label>
            <input
              type="number"
              min={0}
              value={currentRate.extraKmRate || ''}
              placeholder="0 (e.g. 15)"
              onChange={(e) => handleFieldChange('extraKmRate', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg bg-white text-ink focus:border-brand focus:outline-none"
            />
            <span className="text-[10px] text-ink-soft">Charge per km beyond base</span>
          </div>

          {/* Extra Hour Rate */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink">Extra Hour Rate (₹ / hr)</label>
            <input
              type="number"
              min={0}
              value={currentRate.extraHourRate || ''}
              placeholder="0 (e.g. 150)"
              onChange={(e) => handleFieldChange('extraHourRate', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg bg-white text-ink focus:border-brand focus:outline-none"
            />
            <span className="text-[10px] text-ink-soft">Charge per hr beyond base</span>
          </div>

          {/* Driver Bata */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink">Driver Daily Bata (₹ / day)</label>
            <input
              type="number"
              min={0}
              value={currentRate.bataPerDay || ''}
              placeholder="0 (e.g. 400)"
              onChange={(e) => handleFieldChange('bataPerDay', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg bg-white text-ink focus:border-brand focus:outline-none"
            />
            <span className="text-[10px] text-ink-soft">Day allowance per duty day</span>
          </div>

          {/* Driver Night Bata */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink">Night Bata / Halting (₹ / night)</label>
            <input
              type="number"
              min={0}
              value={currentRate.nightBata || ''}
              placeholder="0 (e.g. 500)"
              onChange={(e) => handleFieldChange('nightBata', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg bg-white text-ink focus:border-brand focus:outline-none"
            />
            <span className="text-[10px] text-ink-soft">Halting allowance per night stay</span>
          </div>
        </div>
      </div>

      {/* RLS Storage Footer */}
      <div className="p-3 bg-paper border border-line rounded-lg flex items-center gap-2 text-xs text-ink-soft">
        <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          <strong>Row-Level Security:</strong> Stored in PostgreSQL table <code>public.settings</code> (row key: <code>system.quote_tariffs</code>). All roles can read for quote calculations; strictly admin-editable.
        </span>
      </div>
    </div>
  );
};
