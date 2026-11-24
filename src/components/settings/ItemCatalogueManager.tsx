import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { CatalogueItem, ItemUnit } from '../../types/catalogue';
import { TaxProfile } from '../../types/tax';
import { CatalogueService, SEED_CATALOGUE_ITEMS } from '../../services/catalogueService';
import { TaxService } from '../../services/taxService';
import { useAuth } from '../../context/AuthContext';

export const ItemCatalogueManager: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [items, setItems] = useState<CatalogueItem[]>(SEED_CATALOGUE_ITEMS);
  const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogueItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultUnit, setDefaultUnit] = useState<ItemUnit>('trip');
  const [defaultRate, setDefaultRate] = useState<number>(1000);
  const [taxProfileId, setTaxProfileId] = useState<string>('');
  const [sacHsn, setSacHsn] = useState('996601');

  useEffect(() => {
    async function load() {
      const [itemList, taxes] = await Promise.all([
        CatalogueService.getItems(),
        TaxService.getTaxProfiles(),
      ]);
      setItems(itemList);
      setTaxProfiles(taxes);
    }
    load();
  }, []);

  const handleOpenAdd = () => {
    setSelectedItem(null);
    setName('');
    setDescription('');
    setDefaultUnit('trip');
    setDefaultRate(1000);
    setTaxProfileId(taxProfiles[0]?.id || '');
    setSacHsn('996601');
    setIsModalOpen(true);
    setStatusMsg(null);
  };

  const handleOpenEdit = (item: CatalogueItem) => {
    setSelectedItem(item);
    setName(item.name);
    setDescription(item.description || '');
    setDefaultUnit(item.defaultUnit);
    setDefaultRate(item.defaultRate);
    setTaxProfileId(item.taxProfileId || '');
    setSacHsn(item.sacHsn || '996601');
    setIsModalOpen(true);
    setStatusMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const itemToSave: CatalogueItem = {
        id: selectedItem?.id || `item-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        defaultUnit,
        defaultRate: Number(defaultRate),
        taxProfileId: taxProfileId || undefined,
        sacHsn: sacHsn.trim() || undefined,
        isActive: true,
      };

      const saved = await CatalogueService.saveItem(itemToSave);
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });

      setStatusMsg({ type: 'success', text: `Item '${saved.name}' saved to catalogue.` });
      setIsModalOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save item.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-800" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-display">Item Catalogue & Saved Services</h2>
            <p className="text-xs text-gray-500">
              Pre-configured service packages, rates, units, and tax links for one-click invoice creation
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Catalogue Service</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Catalogue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const profile = taxProfiles.find((t) => t.id === item.taxProfileId);
          return (
            <div
              key={item.id}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all space-y-3"
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-900 text-sm font-display">{item.name}</h3>
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1 text-gray-400 hover:text-emerald-700 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {item.description && (
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Standard Rate</span>
                  <div className="text-base font-bold font-mono text-gray-900">
                    ₹{item.defaultRate.toLocaleString('en-IN')}{' '}
                    <span className="text-xs font-normal text-gray-500">/ {item.defaultUnit}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Tax & SAC</span>
                  <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                    {profile ? `${profile.name} (${profile.ratePercent}%)` : 'No Tax'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 font-display text-base">
                {selectedItem ? 'Edit Catalogue Item' : 'New Catalogue Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Service / Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Airport Transfer (Trivandrum TRV)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Service details included in invoice line..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Default Unit *</label>
                  <select
                    value={defaultUnit}
                    onChange={(e) => setDefaultUnit(e.target.value as ItemUnit)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="trip">Trip (One-way / Round)</option>
                    <option value="km">Kilometer (km)</option>
                    <option value="hr">Hour (hr)</option>
                    <option value="day">Day (Calendar day)</option>
                    <option value="month">Month (Fixed rental)</option>
                    <option value="fixed">Fixed Lump Sum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Default Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Tax Profile</label>
                  <select
                    value={taxProfileId}
                    onChange={(e) => setTaxProfileId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="">No Tax (0%)</option>
                    {taxProfiles.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.name} ({tp.ratePercent}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">SAC / HSN Code</label>
                  <input
                    type="text"
                    value={sacHsn}
                    onChange={(e) => setSacHsn(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    placeholder="996601"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

