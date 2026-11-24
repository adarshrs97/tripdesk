import React, { useState } from 'react';
import { Customer, Contract, ContractTerm, MastersService } from '../../services/mastersService';
import { useSuppliers } from '../../context/SupplierContext';
import { TemplateService } from '../../services/templateService';
import { InvoiceTemplate } from '../../engine/templates';
import { X, FileText, Check, AlertCircle, Calendar, IndianRupee } from 'lucide-react';

interface AddContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomerId?: string;
  onContractAdded: (contract: Contract, terms: ContractTerm) => void;
  lang?: 'en' | 'ml';
}

export const AddContractModal: React.FC<AddContractModalProps> = ({
  isOpen,
  onClose,
  customers,
  selectedCustomerId,
  onContractAdded,
  lang = 'en',
}) => {
  const { suppliers } = useSuppliers();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);

  // Contract Header States
  const [customerId, setCustomerId] = useState(selectedCustomerId || customers[0]?.id || '');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [agreementNo, setAgreementNo] = useState(`AGR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [agreementDate, setAgreementDate] = useState(new Date().toISOString().slice(0, 10));
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(
    new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
  );
  const [pricingModel, setPricingModel] = useState<string>('monthly_fixed');
  const [templateId, setTemplateId] = useState('template-inv-format2-vtl');
  const [seriesPrefix, setSeriesPrefix] = useState(suppliers[0]?.invoicePrefix || '108');

  // Versioned Terms & Rate States
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('2027-12-31');
  const [fixedAmount, setFixedAmount] = useState(65000);
  const [includedKm, setIncludedKm] = useState(3000);
  const [includedHoursPerDay, setIncludedHoursPerDay] = useState(12);
  const [extraKmRate, setExtraKmRate] = useState(18);
  const [extraHourRate, setExtraHourRate] = useState(150);
  const [nightBata, setNightBata] = useState(200);
  const [outstationBata, setOutstationBata] = useState(200);
  const [roundingMode, setRoundingMode] = useState<'down' | 'nearest' | 'none'>('down');
  const [taxProfile, setTaxProfile] = useState<'disabled' | 'cgst_sgst' | 'igst'>('disabled');
  const [legacyDecimalHoursBug, setLegacyDecimalHoursBug] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    TemplateService.getAllTemplates().then((tpls) => {
      setTemplates(tpls);
    });
  }, []);

  React.useEffect(() => {
    if (selectedCustomerId) {
      setCustomerId(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  React.useEffect(() => {
    const selSup = suppliers.find((s) => s.id === supplierId);
    if (selSup?.invoicePrefix) {
      setSeriesPrefix(selSup.invoicePrefix);
    }
  }, [supplierId, suppliers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreementNo.trim() || !customerId || !supplierId) {
      setError(lang === 'ml' ? 'ആവശ്യമായ എല്ലാ വിവരങ്ങളും നൽകുക.' : 'Please provide Agreement Number, Customer, and Supplier.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Create Contract in Data
      const createdContract = await MastersService.createContract({
        customerId,
        supplierId,
        agreementNo: agreementNo.trim(),
        agreementDate,
        validFrom,
        validTo,
        contractKind: pricingModel as any,
        invoiceFormat: templateId,
        pricingModel,
        pricingParams: {
          fixed_amount: fixedAmount,
          included_km: includedKm,
          included_hours: includedHoursPerDay,
          extra_km_rate: extraKmRate,
          extra_hour_rate: extraHourRate,
          night_bata: nightBata,
          outstation_bata: outstationBata,
          rounding: roundingMode,
          series_prefix: seriesPrefix,
          tax_profile: taxProfile,
        },
        status: 'active',
      });

      // 2. Create Initial Versioned Terms
      const createdTerms = await MastersService.createContractTerm({
        contractId: createdContract.id,
        effectiveFrom,
        effectiveTo,
        fixedAmount,
        includedKm,
        includedHoursPerDay,
        extraHourRate,
        extraKmRate,
        nightBata,
        outstationBata,
        workingDays: 30,
        extraDayRate: 0,
        roundingMode,
        gstMode: taxProfile,
        legacyDecimalHoursBug,
      });

      onContractAdded(createdContract, createdTerms);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register contract and terms');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-line rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-paper">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-tint text-brand flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-ink">
                {lang === 'ml' ? 'പുതിയ കരാർ & നിരക്കുകൾ ചേർക്കുക' : 'Add New Contract & Rate Card'}
              </h3>
              <p className="text-xs text-ink-soft">
                {lang === 'ml'
                  ? 'ഉപഭോക്താവിനായി ബില്ലിംഗ് മോഡൽ, നിരക്കുകൾ, പ്രാബല്യ തീയതികൾ എന്നിവ ക്രമീകരിക്കുക'
                  : 'Bind customer agreement, billing model, pricing rates, and versioned terms'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-card transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section 1: Agreement & Entity Assignment */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 border-b border-line/60 pb-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand" />
              <span>1. Agreement &amp; Letterhead Assignment</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Customer *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Billing Entity (Supplier) *
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.tradeName} ({s.invoicePrefix})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Agreement No *
                </label>
                <input
                  type="text"
                  required
                  value={agreementNo}
                  onChange={(e) => setAgreementNo(e.target.value)}
                  placeholder="e.g. 202526000005308395"
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Agreement Date
                </label>
                <input
                  type="date"
                  value={agreementDate}
                  onChange={(e) => setAgreementDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Valid From
                </label>
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Valid To
                </label>
                <input
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Model, Template & Numbering */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 border-b border-line/60 pb-1.5">
              <FileText className="w-3.5 h-3.5 text-brand" />
              <span>2. Billing Model, Invoice Template &amp; Series</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Billing Model
                </label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                >
                  <option value="monthly_fixed">Monthly Fixed Contract</option>
                  <option value="per_trip_package">Per-Trip Package (Itemised)</option>
                  <option value="hourly_package">Hourly Hire Package</option>
                  <option value="per_km">Pure Per-Km Rate</option>
                  <option value="slab">Slab-Based Tiered Billing</option>
                  <option value="custom_formula">Custom Formula Model</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Invoice Template
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (v{t.version})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">
                  Series Prefix
                </label>
                <input
                  type="text"
                  value={seriesPrefix}
                  onChange={(e) => setSeriesPrefix(e.target.value)}
                  placeholder="e.g. 108"
                  className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Versioned Terms & Rates */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-ink uppercase tracking-wider flex items-center justify-between border-b border-line/60 pb-1.5">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-3.5 h-3.5 text-brand" />
                <span>3. Initial Versioned Terms &amp; Commercial Rates</span>
              </div>
              <span className="text-[10px] text-ink-soft font-normal">
                Version 1 (Effective {effectiveFrom})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Effective From
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Effective To
                </label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Base / Fixed Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Included KM
                </label>
                <input
                  type="number"
                  min="0"
                  value={includedKm}
                  onChange={(e) => setIncludedKm(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Included Hours / Day
                </label>
                <input
                  type="number"
                  min="0"
                  value={includedHoursPerDay}
                  onChange={(e) => setIncludedHoursPerDay(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Extra KM Rate (₹/km)
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraKmRate}
                  onChange={(e) => setExtraKmRate(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Extra Hour Rate (₹/hr)
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraHourRate}
                  onChange={(e) => setExtraHourRate(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Night Bata (₹/night)
                </label>
                <input
                  type="number"
                  min="0"
                  value={nightBata}
                  onChange={(e) => setNightBata(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Outstation Bata (₹/night)
                </label>
                <input
                  type="number"
                  min="0"
                  value={outstationBata}
                  onChange={(e) => setOutstationBata(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Rounding Mode
                </label>
                <select
                  value={roundingMode}
                  onChange={(e) => setRoundingMode(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                >
                  <option value="down">Round Down (Floor)</option>
                  <option value="nearest">Nearest Integer</option>
                  <option value="none">Exact (None)</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-line/60">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legacyDecimalHoursBug}
                    onChange={(e) => setLegacyDecimalHoursBug(e.target.checked)}
                    className="mt-0.5 rounded text-brand focus:ring-brand border-line"
                  />
                  <div>
                    <span className="text-xs font-semibold text-ink">
                      Bill extra hours the old spreadsheet way (9h45m as 9.45)
                    </span>
                    <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">
                      {legacyDecimalHoursBug
                        ? 'ON: 9h 45m billed as 9.45 × ₹150 = ₹1,417.50. VTL August total: ₹68,617 (Equals paper invoice).'
                        : 'OFF: 9h 45m billed pro-rata as 9.75 × ₹150 = ₹1,462.50. VTL August total: ₹68,662 (Exact decimal calculation, +₹45).'}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Tax Profile
                </label>
                <select
                  value={taxProfile}
                  onChange={(e) => setTaxProfile(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
                >
                  <option value="disabled">No Tax (0%)</option>
                  <option value="cgst_sgst">GST 5% (CGST + SGST)</option>
                  <option value="igst">IGST 5% (Interstate)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink transition-colors"
            >
              {lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-dark transition-colors shadow-xs disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting
                ? lang === 'ml'
                  ? 'സൂക്ഷിക്കുന്നു...'
                  : 'Registering...'
                : lang === 'ml'
                ? 'കരാർ സൂക്ഷിക്കുക'
                : 'Create Contract & Terms'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
