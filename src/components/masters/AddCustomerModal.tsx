import React, { useState } from 'react';
import { Customer, MastersService } from '../../services/mastersService';
import { useSuppliers } from '../../context/SupplierContext';
import { X, Building, Check, AlertCircle } from 'lucide-react';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customer: Customer) => void;
  lang?: 'en' | 'ml';
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerAdded,
  lang = 'en',
}) => {
  const { suppliers } = useSuppliers();

  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<Customer['customerType']>('corporate');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('Trivandrum');
  const state = 'Kerala';
  const [pincode, setPincode] = useState('695001');
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [defaultSupplierId, setDefaultSupplierId] = useState(suppliers[0]?.id || '');
  const defaultInvoiceFormat = 'STARTER_MONTHLY_CONTRACT';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(lang === 'ml' ? 'ഉപഭോക്താവിന്റെ പേര് നൽകുക.' : 'Please enter customer name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await MastersService.createCustomer({
        name: name.trim(),
        customerType,
        billingAddress: billingAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        pan: pan.trim() || null,
        gstin: gstin.trim() || null,
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        paymentTermsDays: Number(paymentTermsDays) || 0,
        defaultSupplierId: defaultSupplierId || null,
        defaultInvoiceFormat,
      });

      onCustomerAdded(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-line rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-paper">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-tint text-brand flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-ink">
                {lang === 'ml' ? 'പുതിയ ഉപഭോക്താവിനെ ചേർക്കുക' : 'Add New Customer'}
              </h3>
              <p className="text-xs text-ink-soft">
                {lang === 'ml' ? 'സ്ഥാപന അല്ലെങ്കിൽ വ്യക്തിഗത ഉപഭോക്തൃ വിവരങ്ങൾ' : 'Corporate, institutional, or regular client profile'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'ഉപഭോക്താവിന്റെ പേര് *' : 'Customer Legal / Trade Name *'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. M/s Vindhya Telelinks Ltd"
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'ഉപഭോക്തൃ തരം' : 'Customer Category'}
              </label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              >
                <option value="corporate">Corporate / Company</option>
                <option value="school">School / College</option>
                <option value="hotel">Hotel / Resort</option>
                <option value="long_term">Long-Term Contract</option>
                <option value="agent">Travel Agent</option>
                <option value="individual">Individual / Regular</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'പേയ്‌മെന്റ് കാലാവധി (ദിവസങ്ങൾ)' : 'Payment Credit Terms (Days)'}
              </label>
              <input
                type="number"
                min="0"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'ബില്ലിംഗ് വിലാസം' : 'Billing Address'}
              </label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Door No, Street / Building, Locality"
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'നഗരം' : 'City'}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'പിൻകോഡ്' : 'Pincode'}
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="32AAAAA0000A1Z5"
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">PAN</label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="AAAAA0000A"
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'ബന്ധപ്പെടേണ്ട വ്യക്തി' : 'Contact Person'}
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Name of manager / coordinator"
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'ഫോൺ നമ്പർ' : 'Contact Phone'}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 94470 00000"
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@customer.com"
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                {lang === 'ml' ? 'സ്ഥിരം സ്ഥാപനം (ലെറ്റർഹെഡ്)' : 'Default Supplier Entity'}
              </label>
              <select
                value={defaultSupplierId}
                onChange={(e) => setDefaultSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tradeName} ({s.invoicePrefix})
                  </option>
                ))}
              </select>
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
                  : 'Saving...'
                : lang === 'ml'
                ? 'ഉപഭോക്താവിനെ ചേർക്കുക'
                : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
