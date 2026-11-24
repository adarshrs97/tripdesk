import React, { useState, useEffect } from 'react';
import {
  Tag,
  AlertTriangle,
  AlertCircle,
  Info,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  Car,
  User,
  Building2,
  Briefcase,
  Store,
  Lock,
} from 'lucide-react';
import { FlagsService } from '../../services/flagsService';
import {
  InternalFlag,
  InternalFlagInput,
  FlagEntityType,
  FlagSeverity,
} from '../../engine/flags';
import { useAuth } from '../../context/AuthContext';

export const InternalFlagsManager: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isStaffOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'staff';

  const [flags, setFlags] = useState<InternalFlag[]>([]);
  const [selectedEntityType, setSelectedEntityType] = useState<FlagEntityType | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<FlagSeverity | 'all'>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Flag Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFlagInput, setNewFlagInput] = useState<InternalFlagInput>({
    entityType: 'driver',
    entityId: '',
    severity: 'note',
    title: '',
    description: '',
  });

  const loadFlags = async () => {
    setIsLoading(true);
    try {
      const data = await FlagsService.getFlags();
      setFlags(data);
    } catch (err: any) {
      console.error('Failed to load internal flags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffOrAdmin) return;
    if (!newFlagInput.title.trim() || !newFlagInput.entityId.trim()) {
      setStatusMsg({ type: 'error', text: 'Entity ID/Name and Title are required.' });
      return;
    }

    try {
      await FlagsService.createFlag({
        ...newFlagInput,
        createdBy: currentUser?.name || currentUser?.role || 'staff',
        createdByUserId: currentUser?.id || '',
      });
      setIsAddModalOpen(false);
      setNewFlagInput({
        entityType: 'driver',
        entityId: '',
        severity: 'note',
        title: '',
        description: '',
      });
      setStatusMsg({ type: 'success', text: 'Internal flag created successfully.' });
      await loadFlags();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to create flag.' });
    }
  };

  const handleResolveFlag = async (flagId: string) => {
    if (!isStaffOrAdmin) return;
    try {
      await FlagsService.resolveFlag(
        flagId,
        currentUser?.name || currentUser?.role || 'staff',
        'Resolved by staff review'
      );
      setStatusMsg({ type: 'success', text: 'Flag marked as resolved.' });
      await loadFlags();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to resolve flag.' });
    }
  };

  const handleDeleteFlag = async (flagId: string) => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to permanently delete this internal flag?')) return;

    try {
      await FlagsService.deleteFlag(flagId);
      setStatusMsg({ type: 'success', text: 'Internal flag deleted permanently.' });
      await loadFlags();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete flag.' });
    }
  };

  const filteredFlags = flags.filter((f) => {
    if (!showResolved && !f.isActive) return false;
    if (showResolved && f.isActive) return false;
    if (selectedEntityType !== 'all' && f.entityType !== selectedEntityType) return false;
    if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const match =
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.entityId.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const activeAvoidCount = flags.filter((f) => f.isActive && f.severity === 'avoid').length;
  const activeCautionCount = flags.filter((f) => f.isActive && f.severity === 'caution').length;
  const activeNoteCount = flags.filter((f) => f.isActive && f.severity === 'note').length;

  const entityIcons: Record<FlagEntityType, React.ReactNode> = {
    driver: <User className="w-3.5 h-3.5" />,
    vehicle: <Car className="w-3.5 h-3.5" />,
    customer: <Briefcase className="w-3.5 h-3.5" />,
    vendor: <Store className="w-3.5 h-3.5" />,
    hotel: <Building2 className="w-3.5 h-3.5" />,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-card border border-line p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-brand" />
            <h1 className="text-xl font-heading font-bold text-ink">
              Internal Notes &amp; Operational Flags
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Staff Only
            </span>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Tag operational cautions, preferences, and hard avoid alerts for drivers, vehicles, customers, vendors, and hotels.
            Strictly internal data with zero customer leakage.
          </p>
        </div>

        {isStaffOrAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors font-semibold text-xs shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Internal Flag</span>
          </button>
        )}
      </div>

      {/* Zero-Leakage Privacy Banner */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3 shadow-2xs">
        <ShieldAlert className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-emerald-900">Zero-Leakage Confidentiality Mandate:</span> All notes and flags
          resurface exclusively on internal trip dispatch, vehicle assignment, and month-close invoice creation for Admin and Staff.
          They are <strong>strictly excluded</strong> from customer invoice PDFs, approval portal links, driver mobile app (PWA), and customer statements.
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Critical Avoid Flags</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-red-600">{activeAvoidCount}</div>
          <span className="text-[10px] text-red-600 font-medium">Hard dispatch blocks</span>
        </div>

        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Operational Cautions</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-600">{activeCautionCount}</div>
          <span className="text-[10px] text-amber-700 font-medium">Review before dispatch</span>
        </div>

        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Operational Notes</span>
            <Info className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-blue-600">{activeNoteCount}</div>
          <span className="text-[10px] text-blue-700 font-medium">Helpful guidelines</span>
        </div>

        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Total Active Flags</span>
            <Tag className="w-4 h-4 text-brand" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-ink">{activeAvoidCount + activeCautionCount + activeNoteCount}</div>
          <span className="text-[10px] text-ink-soft font-medium">Across all entities</span>
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
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Filter Strip */}
      <div className="bg-card border border-line p-4 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Entity Type Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-ink-soft mr-1 font-medium">Entity:</span>
            {(['all', 'driver', 'vehicle', 'customer', 'vendor', 'hotel'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedEntityType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  selectedEntityType === type
                    ? 'bg-ink text-white'
                    : 'bg-paper text-ink-soft hover:text-ink border border-line'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search flags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-paper border border-line rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-line/60 flex-wrap gap-2 text-xs">
          {/* Severity Filters */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-soft mr-1 font-medium">Severity:</span>
            {(['all', 'avoid', 'caution', 'note'] as const).map((sev) => {
              const activeStyle = {
                all: 'bg-ink text-white',
                avoid: 'bg-red-600 text-white',
                caution: 'bg-amber-600 text-white',
                note: 'bg-blue-600 text-white',
              }[sev];

              return (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-all text-xs ${
                    selectedSeverity === sev
                      ? activeStyle
                      : 'bg-paper text-ink-soft hover:text-ink border border-line'
                  }`}
                >
                  {sev}
                </button>
              );
            })}
          </div>

          {/* Active vs Resolved toggle */}
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {showResolved ? '← Show Active Flags' : 'View Resolved Flags →'}
          </button>
        </div>
      </div>

      {/* Flags List Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-ink-soft bg-card border border-line rounded-xl">
          Loading operational flags...
        </div>
      ) : filteredFlags.length === 0 ? (
        <div className="p-12 text-center text-xs text-ink-soft bg-card border border-line rounded-xl">
          No {showResolved ? 'resolved' : 'active'} internal flags found matching filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFlags.map((flag) => {
            const borderColors = {
              avoid: 'border-l-4 border-l-red-500',
              caution: 'border-l-4 border-l-amber-500',
              note: 'border-l-4 border-l-blue-500',
            }[flag.severity];

            const badgeStyles = {
              avoid: 'bg-red-50 text-red-700 border-red-200',
              caution: 'bg-amber-50 text-amber-800 border-amber-200',
              note: 'bg-blue-50 text-blue-700 border-blue-200',
            }[flag.severity];

            const Icon = flag.severity === 'avoid' ? AlertTriangle : flag.severity === 'caution' ? AlertCircle : Info;

            return (
              <div
                key={flag.id}
                className={`bg-card border border-line rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 ${borderColors}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-paper rounded-lg text-ink-soft border border-line">
                        {entityIcons[flag.entityType]}
                      </span>
                      <div>
                        <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider block">
                          {flag.entityType} · {flag.entityId}
                        </span>
                        <h3 className="font-heading font-bold text-sm text-ink">{flag.title}</h3>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 shrink-0 ${badgeStyles}`}>
                      <Icon className="w-3 h-3" />
                      {flag.severity}
                    </span>
                  </div>

                  <p className="text-xs text-ink-soft mt-3 leading-relaxed bg-paper/60 p-3 rounded-lg border border-line/60">
                    {flag.description}
                  </p>

                  {flag.adminOverrideReason && (
                    <div className="mt-2 p-2.5 bg-purple-50/80 border border-purple-200 rounded-lg text-[11px] text-purple-900">
                      <span className="font-bold block">Administrator Override Logged:</span>
                      <span>&ldquo;{flag.adminOverrideReason}&rdquo;</span>
                      <span className="text-[10px] text-purple-600 block mt-0.5">
                        Overridden by {flag.overriddenBy || 'Admin'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-line/60 flex items-center justify-between text-[11px] text-ink-faint">
                  <span>
                    Created by: <strong className="text-ink">{flag.createdBy || 'staff'}</strong> · Retention: {flag.retentionMonths ? `${flag.retentionMonths}m` : '12m'}
                  </span>

                  <div className="flex items-center gap-2">
                    {flag.isActive && isStaffOrAdmin && (
                      <button
                        onClick={() => handleResolveFlag(flag.id)}
                        className="px-2 py-1 rounded bg-paper border border-line hover:border-emerald-500 hover:text-emerald-700 font-semibold transition-colors flex items-center gap-1"
                        title="Mark flag as resolved"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Resolve</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteFlag(flag.id)}
                        className="p-1 text-ink-faint hover:text-red-600 transition-colors"
                        title="Soft-delete (archives from view while preserving audit log)"
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
      )}

      {/* Add Flag Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-card border border-line rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-heading font-bold text-ink flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand" />
                Add Internal Operational Flag
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-ink-soft hover:text-ink text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Factual Guidance Policy:</span> Record objective, verifiable operational facts only (e.g. &ldquo;Rear AC vent airflow weak&rdquo;, &ldquo;Requires gate pass 24h prior&rdquo;, &ldquo;Corporate guest preference&rdquo;). Do not record subjective opinions or defamatory remarks.
              </div>
            </div>

            <form onSubmit={handleCreateFlag} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink font-semibold mb-1">Entity Type</label>
                  <select
                    value={newFlagInput.entityType}
                    onChange={(e) => setNewFlagInput({ ...newFlagInput, entityType: e.target.value as FlagEntityType })}
                    className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-ink capitalize"
                  >
                    <option value="driver">Driver</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor</option>
                    <option value="hotel">Hotel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink font-semibold mb-1">Entity Identifier / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. KL 01 CP 3284, Hemanth, VTL"
                    value={newFlagInput.entityId}
                    onChange={(e) => setNewFlagInput({ ...newFlagInput, entityId: e.target.value })}
                    required
                    className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">Severity Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['note', 'caution', 'avoid'] as const).map((sev) => {
                    const isSelected = newFlagInput.severity === sev;
                    const styles = {
                      note: isSelected ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-paper text-ink-soft',
                      caution: isSelected ? 'bg-amber-50 border-amber-500 text-amber-800' : 'bg-paper text-ink-soft',
                      avoid: isSelected ? 'bg-red-50 border-red-500 text-red-700' : 'bg-paper text-ink-soft',
                    }[sev];

                    return (
                      <button
                        type="button"
                        key={sev}
                        onClick={() => setNewFlagInput({ ...newFlagInput, severity: sev })}
                        className={`p-2.5 rounded-lg border text-center font-bold capitalize transition-all ${styles}`}
                      >
                        {sev}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">Title / Brief Summary</label>
                <input
                  type="text"
                  placeholder="e.g. Rear AC airflow weak; VIP driver preference"
                  value={newFlagInput.title}
                  onChange={(e) => setNewFlagInput({ ...newFlagInput, title: e.target.value })}
                  required
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-ink"
                />
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">Operational Description &amp; Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Explain why this flag was added and what action dispatch or billing staff must take..."
                  value={newFlagInput.description}
                  onChange={(e) => setNewFlagInput({ ...newFlagInput, description: e.target.value })}
                  required
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-ink resize-none"
                />
              </div>

              <div>
                <label className="block text-ink font-semibold mb-1">Retention &amp; Review Period</label>
                <select
                  value={newFlagInput.retentionMonths || 12}
                  onChange={(e) => setNewFlagInput({ ...newFlagInput, retentionMonths: parseInt(e.target.value, 10) })}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-ink"
                >
                  <option value={6}>6 Months (Temporary Operational Alert)</option>
                  <option value={12}>12 Months (Standard Maintenance Window)</option>
                  <option value={24}>24 Months (Long-term Compliance Reference)</option>
                  <option value={0}>Indefinite (Standing Operational Rule)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-paper border border-line text-ink-soft font-semibold hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-brand-dark"
                >
                  Save Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
