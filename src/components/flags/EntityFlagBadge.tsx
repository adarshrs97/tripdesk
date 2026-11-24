import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { InternalFlag, FlagSeverity } from '../../engine/flags';

interface EntityFlagBadgeProps {
  flags: InternalFlag[];
  compact?: boolean;
}

export const EntityFlagBadge: React.FC<EntityFlagBadgeProps> = ({ flags, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeFlags = flags.filter((f) => f.isActive);
  if (activeFlags.length === 0) return null;

  const hasAvoid = activeFlags.some((f) => f.severity === 'avoid');
  const hasCaution = activeFlags.some((f) => f.severity === 'caution');

  let badgeSeverity: FlagSeverity = 'note';
  if (hasAvoid) badgeSeverity = 'avoid';
  else if (hasCaution) badgeSeverity = 'caution';

  const colorStyles = {
    avoid: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    caution: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
    note: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  }[badgeSeverity];

  const Icon = hasAvoid ? AlertTriangle : hasCaution ? AlertCircle : Info;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-all ${colorStyles}`}
        title="View internal operational flags"
      >
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span className="capitalize">
          {compact ? activeFlags.length : `${badgeSeverity} (${activeFlags.length})`}
        </span>
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div
            className="absolute left-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-3 space-y-2 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-gray-600" />
                Internal Flags ({activeFlags.length})
              </span>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                Staff Only
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activeFlags.map((flag) => {
                const itemStyles = {
                  avoid: 'border-l-4 border-l-red-500 bg-red-50/50',
                  caution: 'border-l-4 border-l-amber-500 bg-amber-50/50',
                  note: 'border-l-4 border-l-blue-500 bg-blue-50/50',
                }[flag.severity];

                return (
                  <div key={flag.id} className={`p-2 rounded-r-lg border border-gray-100 ${itemStyles}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-gray-900 text-[11px] truncate">{flag.title}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-white/80 border border-gray-200">
                        {flag.severity}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">{flag.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
