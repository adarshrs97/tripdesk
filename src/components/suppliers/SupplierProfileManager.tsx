import React, { useState } from 'react';
import { useSuppliers } from '../../context/SupplierContext';
import { SupplierProfile } from '../../types';
import {
  Building2,
  CheckCircle2,
  Edit2,
  Plus,
  Trash2,
  CreditCard,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const SupplierProfileManager: React.FC = () => {
  const { suppliers, activeSupplier, setActiveSupplierId, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<SupplierProfile>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const startEdit = (profile: SupplierProfile) => {
    setFormData({ ...profile });
    setEditingId(profile.id);
    setIsCreating(false);
    setFormErrors({});
  };

  const startCreate = () => {
    setFormData({
      tradeName: '',
      legalName: '',
      address: '',
      city: 'Trivandrum',
      state: 'Kerala',
      pincode: '695002',
      phone: '+91 623 860 320 0',
      email: '',
      pan: 'BGYPM6861Q',
      gstin: '',
      sacCode: '996601',
      bankName: 'State Bank of India',
      accountNumber: '',
      ifsc: '',
      upiId: '',
      invoicePrefix: 'INV',
      promoText: '24x7 Cab & Luxury Tourist Services across South India',
      isDefault: false,
    });
    setEditingId(null);
    setIsCreating(true);
    setFormErrors({});
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.tradeName?.trim()) errors.tradeName = 'Trade name is required';
    if (!formData.legalName?.trim()) errors.legalName = 'Legal proprietor name is required';
    if (!formData.phone?.trim()) errors.phone = 'Phone number is required';
    
    // PAN validation
    if (formData.pan && !PAN_REGEX.test(formData.pan.toUpperCase())) {
      errors.pan = 'Invalid PAN format (e.g. BGYPM6861Q)';
    }

    // GSTIN validation (optional, but if filled must be 15 chars valid GST format)
    if (formData.gstin?.trim()) {
      const cleanGst = formData.gstin.trim().toUpperCase();
      if (!GSTIN_REGEX.test(cleanGst)) {
        errors.gstin = 'Invalid GSTIN format (15 characters alphanumeric, e.g. 32AAACV7757J2Z0)';
      }
    }

    // Check historical bug: Tax number cannot be a phone number
    if (formData.gstin && /^\+?[0-9]{10,13}$/.test(formData.gstin.replace(/\s+/g, ''))) {
      errors.gstin = 'Critical: Tax/GSTIN cannot be a phone number (prevents legacy paper bug).';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isCreating) {
      addSupplier(formData as Omit<SupplierProfile, 'id'>);
      setIsCreating(false);
    } else if (editingId) {
      updateSupplier(editingId, formData);
      setEditingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-line p-5 rounded-xl shadow-xs">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand" />
            Supplier Profiles &amp; Billing Entities
          </h2>
          <p className="text-xs text-ink-soft mt-1 max-w-2xl">
            Configure legal entities, trade names, bank details, and invoice prefixes for your fleet business. 
            Each generated invoice links to one supplier profile for legal compliance and letterheads.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add Supplier Profile
        </button>
      </div>

      {/* Profiles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {suppliers.map((profile) => {
          const isActive = activeSupplier.id === profile.id;

          return (
            <div
              key={profile.id}
              className={`bg-card border rounded-xl p-5 flex flex-col justify-between transition-all shadow-xs ${
                isActive
                  ? 'border-brand ring-2 ring-brand/10'
                  : 'border-line hover:border-line-soft'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-base text-ink">
                        {profile.tradeName}
                      </h3>
                      {profile.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-tint text-brand font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">{profile.legalName}</p>
                  </div>
                  {isActive ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-brand bg-brand-tint px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => setActiveSupplierId(profile.id)}
                      className="text-xs text-ink-soft hover:text-brand transition-colors font-medium underline"
                    >
                      Make Active
                    </button>
                  )}
                </div>

                {/* Details */}
                <div className="mt-4 space-y-2 text-xs text-ink-soft">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-ink-faint shrink-0 mt-0.5" />
                    <span>{profile.address}, {profile.city} - {profile.pincode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-ink-faint shrink-0" />
                    <span>{profile.phone} {profile.secondaryPhone ? ` / ${profile.secondaryPhone}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-ink-faint shrink-0" />
                    <span>{profile.email}</span>
                  </div>
                  <div className="pt-2 border-t border-line/60 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-ink-faint block">PAN:</span>
                      <span className="font-mono font-semibold text-ink">{profile.pan || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">GSTIN:</span>
                      <span className="font-mono font-semibold text-ink">{profile.gstin || 'Unregistered'}</span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">SAC Code:</span>
                      <span className="font-mono text-ink">{profile.sacCode || '996601'}</span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">Invoice Prefix:</span>
                      <span className="font-mono text-brand font-semibold">{profile.invoicePrefix}</span>
                    </div>
                  </div>

                  {/* Bank info */}
                  <div className="mt-3 p-2.5 bg-paper rounded-lg border border-line-soft text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                      <CreditCard className="w-3 h-3 text-brand" />
                      {profile.bankName}
                    </div>
                    <div className="text-ink-soft mt-1 font-mono">
                      A/C: {profile.accountNumber} · IFSC: {profile.ifsc}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
                <span className="text-[11px] text-ink-faint">
                  Series: <code className="bg-paper px-1 rounded">{profile.invoicePrefix}-2026-XXXX</code>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(profile)}
                    className="p-1.5 text-ink-soft hover:text-brand hover:bg-paper rounded transition-colors"
                    title="Edit Profile"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {suppliers.length > 1 && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete supplier profile "${profile.tradeName}"?`)) {
                          deleteSupplier(profile.id);
                        }
                      }}
                      className="p-1.5 text-ink-soft hover:text-red hover:bg-paper rounded transition-colors"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Form Modal */}
      {(isCreating || editingId) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-line rounded-xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <h3 className="font-heading font-bold text-lg text-ink flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand" />
                {isCreating ? 'Create Supplier Profile' : 'Edit Supplier Profile'}
              </h3>
              <button
                onClick={() => {
                  setEditingId(null);
                  setIsCreating(false);
                }}
                className="text-ink-faint hover:text-ink text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Trade Name (Display on Invoice) *
                  </label>
                  <input
                    type="text"
                    value={formData.tradeName || ''}
                    onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                    placeholder="e.g. StarCiti Group"
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                  {formErrors.tradeName && (
                    <span className="text-[11px] text-red mt-0.5 block">{formErrors.tradeName}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Legal / Proprietor Name *
                  </label>
                  <input
                    type="text"
                    value={formData.legalName || ''}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    placeholder="e.g. StarCiti Group"
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                  {formErrors.legalName && (
                    <span className="text-[11px] text-red mt-0.5 block">{formErrors.legalName}</span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Business Address *
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street, Landmark"
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode || ''}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Primary Phone *</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                  {formErrors.phone && (
                    <span className="text-[11px] text-red mt-0.5 block">{formErrors.phone}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Secondary Phone</label>
                  <input
                    type="text"
                    value={formData.secondaryPhone || ''}
                    onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Invoice Prefix Series
                  </label>
                  <input
                    type="text"
                    value={formData.invoicePrefix || ''}
                    onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                    placeholder="e.g. STC or 108"
                    className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                {/* Tax Numbers with Validation */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    PAN (10 Characters)
                  </label>
                  <input
                    type="text"
                    value={formData.pan || ''}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="BGYPM6861Q"
                    maxLength={10}
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                  {formErrors.pan && (
                    <span className="text-[11px] text-red mt-0.5 block">{formErrors.pan}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1 flex items-center justify-between">
                    <span>GSTIN (15 Characters - Optional)</span>
                    <span className="text-[10px] text-ink-faint">Must NOT be phone number</span>
                  </label>
                  <input
                    type="text"
                    value={formData.gstin || ''}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g. 32AAACV7757J2Z0 (or leave empty)"
                    maxLength={15}
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                  {formErrors.gstin && (
                    <span className="text-[11px] text-red mt-0.5 block">{formErrors.gstin}</span>
                  )}
                </div>

                {/* Banking info */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={formData.accountNumber || ''}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc || ''}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">UPI ID</label>
                  <input
                    type="text"
                    value={formData.upiId || ''}
                    onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                    placeholder="e.g. business@upi"
                    className="w-full px-3 py-2 text-xs font-mono border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* Promo Line */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Footer / Promotional Tagline (Printed on Invoices &amp; Quotes)
                </label>
                <input
                  type="text"
                  value={formData.promoText || ''}
                  onChange={(e) => setFormData({ ...formData, promoText: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-line rounded-lg focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setIsCreating(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-ink-soft hover:text-ink bg-paper rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-dark rounded-lg shadow-xs"
                >
                  Save Supplier Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
