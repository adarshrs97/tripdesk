import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Printer,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Share2,
} from 'lucide-react';
import {
  Quote,
  QuotePricingInput,
  TariffType,
  VehicleCategory,
  CustomerType,
} from '../../engine/dispatch/types';
import { calculateQuoteBreakdown, EMPTY_TARIFF_RATE } from '../../engine/dispatch/quoteCalculator';
import { DispatchService } from '../../services/dispatchService';
import { SettingsService } from '../../services/settingsService';
import { useSuppliers } from '../../context/SupplierContext';

interface QuoteBuilderViewProps {
  initialEnquiryId?: string;
  onNavigateToBooking?: (bookingId: string) => void;
}

export const QuoteBuilderView: React.FC<QuoteBuilderViewProps> = ({
  onNavigateToBooking,
}) => {
  const { suppliers, activeSupplier } = useSuppliers();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Conversion Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('1000');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank'>('bank');
  const [paymentRef, setPaymentRef] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Form State for New Quote
  const [supplierId, setSupplierId] = useState(activeSupplier?.id || suppliers[0]?.id || '');
  const [customerName, setCustomerName] = useState('Technopark Client Services');
  const [customerPhone, setCustomerPhone] = useState('+91 94470 54321');
  const [customerEmail, setCustomerEmail] = useState('travel@technopark.org');
  const [customerType, setCustomerType] = useState<CustomerType>('corporate');
  const [pickupLocation, setPickupLocation] = useState('Trivandrum City / Hotel');
  const [dropLocation, setDropLocation] = useState('Kovalam & Poovar Day Tour');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [tariffType, setTariffType] = useState<TariffType>('local_hourly');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('suv');

  // Pricing Parameters - starts empty (no seeded numbers)
  const [basePackageKm, setBasePackageKm] = useState(0);
  const [basePackageHours, setBasePackageHours] = useState(0);
  const [basePackageAmount, setBasePackageAmount] = useState(0);
  const [estimatedKm, setEstimatedKm] = useState(100);
  const [estimatedHours, setEstimatedHours] = useState(8);
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [extraKmRate, setExtraKmRate] = useState(0);
  const [extraHourRate, setExtraHourRate] = useState(0);
  const [driverBataPerDay, setDriverBataPerDay] = useState(0);
  const [driverNightBataPerNight, setDriverNightBataPerNight] = useState(0);
  const [nightStayCount, setNightStayCount] = useState(0);
  const [tollParkingEstimate, setTollParkingEstimate] = useState(0);
  const [permitEstimate, setPermitEstimate] = useState(0);
  const [taxRatePercent, setTaxRatePercent] = useState(0); // Default: No Tax
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);

  // Load configured tariffs from database settings
  useEffect(() => {
    async function loadTariffs() {
      const tariffs = await SettingsService.getQuoteTariffs();
      const activeRate = tariffs[tariffType]?.[vehicleCategory] || EMPTY_TARIFF_RATE;
      setBasePackageKm(activeRate.baseKm || 0);
      setBasePackageHours(activeRate.baseHours || 0);
      setBasePackageAmount(activeRate.baseAmount || 0);
      setExtraKmRate(activeRate.extraKmRate || 0);
      setExtraHourRate(activeRate.extraHourRate || 0);
      setDriverBataPerDay(activeRate.bataPerDay || 0);
      setDriverNightBataPerNight(activeRate.nightBata || 0);
    }
    loadTariffs();
  }, [tariffType, vehicleCategory]);

  const loadQuotes = async () => {
    const list = await DispatchService.getQuotes();
    setQuotes(list);
    if (!selectedQuote && list.length > 0) {
      setSelectedQuote(list[0]);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  // Compute live breakdown for form
  const livePricingInput: QuotePricingInput = {
    tariffType,
    vehicleCategory,
    basePackageKm,
    basePackageHours,
    basePackageAmount,
    estimatedKm,
    estimatedHours,
    estimatedDays,
    extraKmRate,
    extraHourRate,
    driverBataPerDay,
    driverNightBataPerNight,
    nightStayCount,
    tollParkingEstimate,
    permitEstimate,
    taxRatePercent,
    isTaxInclusive,
  };
  const liveBreakdown = calculateQuoteBreakdown(livePricingInput);

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveBreakdown.grandTotal <= 0) {
      alert('A quote with unconfigured rates or ₹0 total cannot be saved or sent. Please configure rates in Settings or enter package rates.');
      return;
    }
    const activeSup = suppliers.find((s) => s.id === supplierId) || activeSupplier || suppliers[0];
    const newQuote = await DispatchService.createQuote({
      supplierId: activeSup?.id || 's0000000-0000-0000-0000-000000000001',
      supplierName: activeSup?.tradeName || 'City Tours & Travels',
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      customerType,
      pickupLocation,
      dropLocation,
      startDate,
      endDate,
      tariffType,
      vehicleCategory,
      pricingInput: livePricingInput,
    });

    await loadQuotes();
    setSelectedQuote(newQuote);
    setIsCreatingNew(false);
  };

  const handleConvertToBooking = async () => {
    if (!selectedQuote) return;
    try {
      const booking = await DispatchService.convertQuoteToBooking(selectedQuote.id, {
        advanceAmount: parseFloat(advanceAmount) || 0,
        paymentMode,
        paymentRef: paymentRef || undefined,
        specialInstructions: specialInstructions || undefined,
      });
      setShowConvertModal(false);
      await loadQuotes();
      setSelectedQuote({ ...selectedQuote, status: 'converted_to_booking', bookingId: booking.id });
      if (onNavigateToBooking) {
        onNavigateToBooking(booking.id);
      }
    } catch (err: any) {
      alert(`Booking conversion failed: ${err.message}`);
    }
  };

  const generateWhatsAppText = (quote: Quote) => {
    const b = quote.breakdown;
    return `*STARCITI FLEET - TARIFF QUOTATION*
*Quote No:* ${quote.quoteNumber}
*Client:* ${quote.customerName}
*Routing:* ${quote.pickupLocation} ➔ ${quote.dropLocation}
*Dates:* ${quote.startDate} to ${quote.endDate}
*Vehicle:* ${quote.vehicleCategory.toUpperCase()}

*Estimated Pricing Breakdown:*
• Base Package: ₹${b.baseAmount.toLocaleString('en-IN')} (${quote.pricingInput.basePackageKm} KM / ${quote.pricingInput.basePackageHours} Hrs)
${b.extraKmAmount > 0 ? `• Extra KM (~${b.extraKm} km @ ₹${quote.pricingInput.extraKmRate}/km): ₹${b.extraKmAmount.toLocaleString('en-IN')}\n` : ''}${b.extraHoursAmount > 0 ? `• Extra Hours (~${b.extraHours} hrs @ ₹${quote.pricingInput.extraHourRate}/hr): ₹${b.extraHoursAmount.toLocaleString('en-IN')}\n` : ''}${b.driverBataAmount > 0 ? `• Driver Bata: ₹${b.driverBataAmount.toLocaleString('en-IN')}\n` : ''}${b.tollParkingAmount > 0 ? `• Toll & Parking (Actuals): ₹${b.tollParkingAmount.toLocaleString('en-IN')}\n` : ''}• GST (${b.taxRatePercent}%): ₹${b.taxAmount.toLocaleString('en-IN')}

*GRAND TOTAL ESTIMATE: ₹${b.grandTotal.toLocaleString('en-IN')}*

_Issued by ${quote.supplierName}. Valid for 14 days._`;
  };

  const handleCopyWhatsApp = () => {
    if (!selectedQuote) return;
    const text = generateWhatsAppText(selectedQuote);
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const doc = selectedQuote ? DispatchService.renderQuoteDocument(selectedQuote) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-card border border-line p-5 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" />
            Interactive Quote Builder &amp; Tariff Calculator
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Build multi-tier customer quotes with instant live document preview, letterhead branding, and WhatsApp quotation generator.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isCreatingNew ? (
            <button
              onClick={() => setIsCreatingNew(false)}
              className="px-3 py-1.5 border border-line text-xs font-semibold rounded-lg bg-paper text-ink hover:border-brand"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              New Quote
            </button>
          )}
        </div>
      </div>

      {isCreatingNew ? (
        /* CREATE NEW QUOTE FORM */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-card border border-line p-6 rounded-xl shadow-xs space-y-5">
            <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2 border-b border-line pb-3">
              <Sparkles className="w-4 h-4 text-brand" />
              Quote Parameters &amp; Tariff Configuration
            </h3>

            <form onSubmit={handleSaveQuote} className="space-y-4 text-xs">
              {/* Tariff Empty State Banner */}
              {basePackageAmount === 0 && extraKmRate === 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <strong className="block font-bold">No configured tariff rates for {tariffType.replace('_', ' ').toUpperCase()} ({vehicleCategory.toUpperCase()})</strong>
                    <span className="text-[11px] text-amber-800">Tariff models start empty. Add your rates in Settings or enter package rates below.</span>
                  </div>
                  <a
                    href="#settings"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 shadow-xs"
                  >
                    Add your rates &rarr;
                  </a>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Billing Supplier Entity</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.tradeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Customer / Organization Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Customer Phone</label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Customer Type</label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  >
                    <option value="corporate">Corporate</option>
                    <option value="individual">Individual / Tourist</option>
                    <option value="agent">Travel Agent</option>
                    <option value="school">School / College</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Tariff Model</label>
                  <select
                    value={tariffType}
                    onChange={(e) => setTariffType(e.target.value as TariffType)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none capitalize"
                  >
                    <option value="local_hourly">Local Hourly (8h / 80km)</option>
                    <option value="outstation_daily">Outstation Daily (250km/day)</option>
                    <option value="airport_transfer">Airport Transfer (Fixed)</option>
                    <option value="fixed_package">Custom Day Package</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Vehicle Category</label>
                  <select
                    value={vehicleCategory}
                    onChange={(e) => setVehicleCategory(e.target.value as VehicleCategory)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none uppercase"
                  >
                    <option value="sedan">Sedan (Dzire / Etios)</option>
                    <option value="suv">SUV (Ertiga / Innova)</option>
                    <option value="tempo">Tempo Traveller (12-17 Seat)</option>
                    <option value="luxury">Luxury Car</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Pickup Location</label>
                  <input
                    type="text"
                    required
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Drop / Destination</label>
                  <input
                    type="text"
                    required
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Charter Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Charter End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 bg-paper rounded-xl border border-line">
                <div>
                  <label className="block font-semibold text-ink mb-1">Est. Total KM</label>
                  <input
                    type="number"
                    value={estimatedKm}
                    onChange={(e) => setEstimatedKm(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Est. Total Hours</label>
                  <input
                    type="number"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Duty Days</label>
                  <input
                    type="number"
                    min={1}
                    value={estimatedDays}
                    onChange={(e) => setEstimatedDays(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-line rounded bg-white font-mono"
                  />
                </div>
              </div>

              {/* Rates & Batas */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-paper rounded-xl border border-line">
                <div>
                  <label className="block font-semibold text-ink mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    value={basePackageAmount}
                    onChange={(e) => setBasePackageAmount(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Extra KM (₹/km)</label>
                  <input
                    type="number"
                    value={extraKmRate}
                    onChange={(e) => setExtraKmRate(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Extra Hr (₹/hr)</label>
                  <input
                    type="number"
                    value={extraHourRate}
                    onChange={(e) => setExtraHourRate(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Day Bata (₹/day)</label>
                  <input
                    type="number"
                    value={driverBataPerDay}
                    onChange={(e) => setDriverBataPerDay(Number(e.target.value))}
                    className="w-full px-2 py-1 border border-line rounded bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Night Stays</label>
                  <input
                    type="number"
                    min={0}
                    value={nightStayCount}
                    onChange={(e) => setNightStayCount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Permit Est. (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={permitEstimate}
                    onChange={(e) => setPermitEstimate(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Toll &amp; Parking Est. (₹)</label>
                  <input
                    type="number"
                    value={tollParkingEstimate}
                    onChange={(e) => setTollParkingEstimate(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-line rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Tax Profile</label>
                  <select
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-line rounded bg-white font-semibold"
                  >
                    <option value={0}>No Tax (0% - Confirm with your CA)</option>
                    <option value={5}>GST 5% (Confirm with your CA)</option>
                    <option value={12}>GST 12% (Confirm with your CA)</option>
                    <option value={18}>GST 18% (Confirm with your CA)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={isTaxInclusive}
                    onChange={(e) => setIsTaxInclusive(e.target.checked)}
                    className="rounded border-line text-brand focus:ring-brand"
                  />
                  Tax Inclusive Pricing
                </label>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-line">
                {liveBreakdown.grandTotal <= 0 ? (
                  <span className="text-[11px] text-amber-800 font-medium">
                    ⚠️ Cannot save or send quote at ₹0. Please enter rates above or configure them in Settings.
                  </span>
                ) : <span />}
                <button
                  type="submit"
                  disabled={liveBreakdown.grandTotal <= 0}
                  className="px-5 py-2.5 bg-brand disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors shadow-xs"
                >
                  Generate &amp; Save Quotation
                </button>
              </div>
            </form>
          </div>

          {/* LIVE DOCUMENT PREVIEW COLUMN */}
          <div className="lg:col-span-5 bg-card border border-line p-5 rounded-xl shadow-xs space-y-4">
            <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-ink-soft flex items-center justify-between">
              <span>Live Quote Preview</span>
              <span className="text-emerald-700 font-semibold font-mono">
                Total: ₹{liveBreakdown.grandTotal.toLocaleString('en-IN')}
              </span>
            </h4>

            {/* Document Simulation */}
            <div className="bg-white border border-gray-300 rounded-lg p-5 shadow-xs text-[11px] space-y-3 font-sans">
              <div className="border-b pb-2 flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-gray-900">
                    {suppliers.find((s) => s.id === supplierId)?.tradeName || 'City Tours & Travels'}
                  </div>
                  <div className="text-[10px] text-gray-500">Fleet Operations &amp; Corporate Car Rentals</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-gray-800">Q-DRAFT</div>
                  <div className="text-[10px] text-gray-500">{new Date().toISOString().slice(0, 10)}</div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Client:</span>
                <div className="font-bold text-gray-800">{customerName}</div>
                <div className="text-gray-600">{pickupLocation} &rarr; {dropLocation}</div>
              </div>

              <table className="w-full divide-y divide-gray-200">
                <thead>
                  <tr className="text-gray-400 font-semibold text-[10px]">
                    <th className="py-1 text-left">Item Description</th>
                    <th className="py-1 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-1 text-gray-700">Base Package ({basePackageKm}km / {basePackageHours}h)</td>
                    <td className="py-1 text-right font-mono">₹{liveBreakdown.baseAmount.toLocaleString('en-IN')}</td>
                  </tr>
                  {liveBreakdown.extraKmAmount > 0 && (
                    <tr>
                      <td className="py-1 text-gray-700">Extra KM (~{liveBreakdown.extraKm}km)</td>
                      <td className="py-1 text-right font-mono">₹{liveBreakdown.extraKmAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  {liveBreakdown.extraHoursAmount > 0 && (
                    <tr>
                      <td className="py-1 text-gray-700">Extra Hours (~{liveBreakdown.extraHours}h)</td>
                      <td className="py-1 text-right font-mono">₹{liveBreakdown.extraHoursAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  {liveBreakdown.driverBataAmount > 0 && (
                    <tr>
                      <td className="py-1 text-gray-700">Driver Bata Allowance</td>
                      <td className="py-1 text-right font-mono">₹{liveBreakdown.driverBataAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  {liveBreakdown.tollParkingAmount > 0 && (
                    <tr>
                      <td className="py-1 text-gray-700">Toll &amp; Parking Est.</td>
                      <td className="py-1 text-right font-mono">₹{liveBreakdown.tollParkingAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  <tr className="border-t font-semibold text-gray-800">
                    <td className="py-1">Subtotal</td>
                    <td className="py-1 text-right font-mono">₹{liveBreakdown.subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                  {liveBreakdown.taxAmount > 0 && (
                    <tr className="text-gray-600">
                      <td className="py-1">GST ({taxRatePercent}%)</td>
                      <td className="py-1 text-right font-mono">₹{liveBreakdown.taxAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-900 font-bold text-xs text-gray-900">
                    <td className="py-1.5">Estimated Total</td>
                    <td className="py-1.5 text-right font-mono text-emerald-800">
                      ₹{liveBreakdown.grandTotal.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* EXISTING QUOTES LIST & VIEWER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Quotes Sidebar List */}
          <div className="lg:col-span-4 bg-card border border-line rounded-xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Active Quotations ({quotes.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {quotes.map((q) => (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuote(q)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedQuote?.id === q.id
                      ? 'bg-paper border-brand shadow-xs'
                      : 'border-line hover:border-brand/40 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-bold text-brand">{q.quoteNumber}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        q.status === 'converted_to_booking'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.status === 'sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {q.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="font-semibold text-ink">{q.customerName}</div>
                  <div className="text-[11px] text-ink-soft truncate">{q.pickupLocation} &rarr; {q.dropLocation}</div>
                  <div className="mt-2 pt-1 border-t border-line/60 flex justify-between items-center">
                    <span className="text-[11px] text-ink-faint uppercase font-semibold">{q.vehicleCategory}</span>
                    <span className="font-mono font-bold text-ink">
                      ₹{q.breakdown.grandTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quote Document & Actions View */}
          <div className="lg:col-span-8 space-y-4">
            {selectedQuote && doc ? (
              <div className="bg-card border border-line rounded-xl p-6 shadow-xs space-y-6">
                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyWhatsApp}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      {copiedNotification ? 'Copied to Clipboard!' : 'Share on WhatsApp'}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-lg text-xs font-semibold text-ink bg-paper hover:border-brand"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / PDF
                    </button>
                  </div>

                  {selectedQuote.status !== 'converted_to_booking' ? (
                    <button
                      onClick={() => setShowConvertModal(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors shadow-xs"
                    >
                      Convert to Confirmed Booking <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Converted to Booking ({selectedQuote.bookingId})
                    </div>
                  )}
                </div>

                {/* Printable Document Sheet */}
                <div className="bg-white border border-gray-300 rounded-xl p-8 shadow-xs text-xs space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h3 className="text-xl font-bold font-heading text-gray-900">{doc.header.supplierName}</h3>
                      <p className="text-gray-500 text-xs">Fleet &amp; Passenger Transport Services</p>
                      <p className="text-gray-400 text-[11px] mt-0.5">Kerala State Tourist Permit Service Provider</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold text-gray-900">{doc.header.quoteNumber}</div>
                      <div className="text-gray-500 text-[11px]">Date: {doc.header.date}</div>
                      <div className="text-gray-500 text-[11px]">Valid Until: {doc.header.validUntil}</div>
                    </div>
                  </div>

                  {/* Customer & Trip Details */}
                  <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer Details:</span>
                      <div className="font-bold text-gray-900 text-sm mt-0.5">{doc.customer.name}</div>
                      <div className="text-gray-600 mt-0.5">Phone: {doc.customer.phone}</div>
                      {doc.customer.email && <div className="text-gray-600">Email: {doc.customer.email}</div>}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Itinerary &amp; Vehicle:</span>
                      <div className="font-semibold text-gray-800 mt-0.5">
                        {doc.trip.pickupLocation} &rarr; {doc.trip.dropLocation}
                      </div>
                      <div className="text-gray-600 mt-0.5">
                        Dates: {doc.trip.startDate} to {doc.trip.endDate}
                      </div>
                      <div className="text-gray-800 font-semibold mt-0.5">
                        Vehicle: {doc.trip.category}
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 text-gray-600 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-right">Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {doc.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5 text-gray-800">{item.description}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-300">
                      <tr>
                        <td className="px-4 py-2 font-semibold text-gray-700">Subtotal</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                          ₹{doc.taxSummary.subtotal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                      {doc.taxSummary.taxAmount > 0 && (
                        <tr>
                          <td className="px-4 py-1.5 text-gray-600">GST ({doc.taxSummary.taxRate}%)</td>
                          <td className="px-4 py-1.5 text-right font-mono text-gray-800">
                            ₹{doc.taxSummary.taxAmount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-gray-900 text-sm font-bold text-gray-900 bg-gray-50">
                        <td className="px-4 py-2.5">Grand Total Estimate</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-800">
                          ₹{doc.taxSummary.grandTotal.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Terms */}
                  <div className="pt-4 border-t text-[11px] text-gray-500 space-y-1">
                    <div className="font-bold text-gray-700">Terms &amp; General Conditions:</div>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {doc.terms.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-ink-soft">Select a quote to view.</div>
            )}
          </div>
        </div>
      )}

      {/* Convert to Booking Modal */}
      {showConvertModal && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-line max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Convert Quote to Confirmed Booking
            </h3>
            <p className="text-ink-soft">
              This reserves the charter for <strong>{selectedQuote.customerName}</strong> and creates an active dispatch reservation.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block font-semibold text-ink mb-1">Advance Amount Received (₹)</label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg font-mono focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  >
                    <option value="bank">Bank Transfer (NEFT/RTGS)</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="cash">Cash Advance</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Reference / UTR</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. UTR123456"
                    className="w-full px-3 py-2 border border-line rounded-lg font-mono focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Special Driver / Vehicle Instructions</label>
                <textarea
                  rows={2}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Gate passes, flight numbers, specific dress code..."
                  className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 border border-line rounded-lg text-ink hover:bg-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertToBooking}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 shadow-xs"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
