import React, { useState, useEffect } from 'react';
import { Percent, Plus, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TaxProfile } from '../../types/tax';
import { TaxService, SEED_TAX_PROFILES } from '../../services/taxService';
import { useAuth } from '../../context/AuthContext';

export const TaxProfilesManager: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [profiles, setProfiles] = useState<TaxProfile[]>(SEED_TAX_PROFILES);
  const [selectedProfile, setSelectedProfile] = useState<TaxProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [taxType, setTaxType] = useState<TaxProfile['taxType']>('gst');
  const [ratePercent, setRatePercent] = useState<number>(5.0);
  const [appliesTo, setAppliesTo] = useState<TaxProfile['appliesTo']>('services');
  const [placeOfSupplyLogic, setPlaceOfSupplyLogic] = useState<TaxProfile['placeOfSupplyLogic']>('intra_state_cgst_sgst');
  const [sacHsnDefault, setSacHsnDefault] = useState('996601');
  const [isInclusive, setIsInclusive] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function load() {
      const data = await TaxService.getTaxProfiles();
      setProfiles(data);
    }
    load();
  }, []);

  const handleOpenAdd = () => {
    setSelectedProfile(null);
    setName('');
    setTaxType('gst');
    setRatePercent(5.0);
    setAppliesTo('services');
    setPlaceOfSupplyLogic('intra_state_cgst_sgst');
    setSacHsnDefault('996601');
    setIsInclusive(false);
    setNotes('');
    setIsModalOpen(true);
    setStatusMsg(null);
  };

  const handleOpenEdit = (p: TaxProfile) => {
    setSelectedProfile(p);
    setName(p.name);
    setTaxType(p.taxType);
    setRatePercent(p.ratePercent);
    setAppliesTo(p.appliesTo);
    setPlaceOfSupplyLogic(p.placeOfSupplyLogic);
    setSacHsnDefault(p.sacHsnDefault || '996601');
    setIsInclusive(p.isInclusive);
    setNotes(p.notes || '');
    setIsModalOpen(true);
    setStatusMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setStatusMsg({ type: 'error', text: 'Only administrators can modify tax profiles.' });
      return;
    }

    try {
      const profileToSave: TaxProfile = {
        id: selectedProfile?.id || `tax-${Date.now()}`,
        name: name.trim(),
        taxType,
        ratePercent: Number(ratePercent),
        appliesTo,
        placeOfSupplyLogic,
        sacHsnDefault: sacHsnDefault.trim(),
        isInclusive,
        notes: notes.trim(),
        isActive: true,
      };

      const saved = await TaxService.saveTaxProfile(profileToSave);
      setProfiles((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });

      setStatusMsg({ type: 'success', text: `Tax profile '${saved.name}' saved successfully.` });
      setIsModalOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save tax profile.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
            <Percent className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-display">Customizable Tax Profiles</h2>
            <p className="text-xs text-gray-500">
              Taxes as Data: Zero hard-coded rules. GST, TDS, RCM, and Place of Supply profiles.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tax Profile</span>
          </button>
        )}
      </div>

      {/* CA Advisory Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-950 font-semibold mb-0.5">
            Statutory Compliance Advisory — Confirm with your CA
          </strong>
          <span>
            Tax rates and HSN/SAC codes configured here are operational business data and do NOT constitute tax advice. Confirm all applicable tax rates and contractor TDS with your chartered accountant.
          </span>
        </div>
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

      {/* Tax Profiles Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Profile Name</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">Rate</th>
              <th className="py-3 px-4">Place of Supply Logic</th>
              <th className="py-3 px-4">SAC / HSN</th>
              <th className="py-3 px-4">Mode</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profiles.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-gray-900">
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    {p.ratePercent === 0 && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  {p.notes && <div className="text-[11px] text-gray-500 font-normal mt-0.5">{p.notes}</div>}
                </td>
                <td className="py-3.5 px-4 uppercase text-[10px] font-mono font-bold text-gray-700">
                  <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                    {p.taxType}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900 text-sm">
                  {p.ratePercent.toFixed(1)}%
                </td>
                <td className="py-3.5 px-4 text-gray-600 text-[11px]">
                  {p.placeOfSupplyLogic === 'intra_state_cgst_sgst' && 'CGST + SGST (Intra-state)'}
                  {p.placeOfSupplyLogic === 'inter_state_igst' && 'IGST (Inter-state)'}
                  {p.placeOfSupplyLogic === 'exempt' && 'Tax Exempt (Nil Rated)'}
                  {p.placeOfSupplyLogic === 'rcm' && 'Reverse Charge Mechanism (RCM)'}
                </td>
                <td className="py-3.5 px-4 font-mono text-gray-600">
                  {p.sacHsnDefault || '996601'}
                </td>
                <td className="py-3.5 px-4 text-gray-600">
                  {p.isInclusive ? (
                    <span className="text-amber-800 font-semibold">Tax-Inclusive</span>
                  ) : (
                    <span className="text-gray-700">Tax-Exclusive</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {isAdmin ? (
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 font-display text-base">
                {selectedProfile ? 'Edit Tax Profile' : 'New Tax Profile'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Profile Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GST 5% (Rent-a-Cab without ITC)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Tax Type *</label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="gst">GST (Goods & Services Tax)</option>
                    <option value="tds">TDS (Tax Deducted at Source)</option>
                    <option value="tcs">TCS (Tax Collected at Source)</option>
                    <option value="cess">Cess</option>
                    <option value="none">None (Zero / Exempt)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={ratePercent}
                    onChange={(e) => setRatePercent(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Place of Supply *</label>
                  <select
                    value={placeOfSupplyLogic}
                    onChange={(e) => setPlaceOfSupplyLogic(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="intra_state_cgst_sgst">CGST + SGST (Intra-State)</option>
                    <option value="inter_state_igst">IGST (Inter-State)</option>
                    <option value="exempt">Exempt (Nil Rated)</option>
                    <option value="rcm">Reverse Charge (RCM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Default SAC / HSN</label>
                  <input
                    type="text"
                    value={sacHsnDefault}
                    onChange={(e) => setSacHsnDefault(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    placeholder="996601"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800 pt-1">
                  <input
                    type="checkbox"
                    checked={isInclusive}
                    onChange={(e) => setIsInclusive(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Tax Inclusive Rate (Amount already includes tax)</span>
                </label>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Notes / Guidance</label>
                <input
                  type="text"
                  placeholder="e.g. For corporate contracts under SAC 996601"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
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
                  Save Tax Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

