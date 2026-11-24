import React, { useState, useEffect, useRef } from 'react';
import { ViewId } from '../../types';
import { useSuppliers } from '../../context/SupplierContext';
import {
  Search,
  BookOpen,
  Receipt,
  Car,
  Settings,
  Building2,
  Calendar,
  Sliders,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId) => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: string;
  action: () => void;
  icon: React.ReactNode;
  shortcut?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { suppliers, setActiveSupplierId } = useSuppliers();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allCommands: CommandItem[] = [
    {
      id: 'cmd-log-trip',
      title: "Log Today's Trip",
      category: 'Quick Actions',
      icon: <BookOpen className="w-4 h-4 text-brand" />,
      shortcut: 'L',
      action: () => {
        onNavigate('ledger');
        onClose();
      },
    },
    {
      id: 'cmd-bill-vtl',
      title: 'Bill Monthly Contract (Starter: Monthly contract)',
      category: 'Billing & Invoices',
      icon: <Receipt className="w-4 h-4 text-brand" />,
      shortcut: 'V',
      action: () => {
        onNavigate('invoices');
        onClose();
      },
    },
    {
      id: 'cmd-bill-school',
      title: 'Generate Package Invoice (Starter: Per-trip package)',
      category: 'Billing & Invoices',
      icon: <Receipt className="w-4 h-4 text-brand" />,
      shortcut: 'S',
      action: () => {
        onNavigate('invoices');
        onClose();
      },
    },
    {
      id: 'cmd-open-ledger',
      title: 'Daily Trip Ledger (August 2026)',
      category: 'Operations',
      icon: <Calendar className="w-4 h-4 text-emerald-600" />,
      action: () => {
        onNavigate('ledger');
        onClose();
      },
    },
    {
      id: 'cmd-fleet',
      title: 'View Fleet & Vehicle KL01 CP 3284',
      category: 'Operations',
      icon: <Car className="w-4 h-4 text-ink-soft" />,
      action: () => {
        onNavigate('fleet');
        onClose();
      },
    },
    {
      id: 'cmd-templates',
      title: 'Invoice & Ledger Template Builder',
      category: 'Administration',
      icon: <Sliders className="w-4 h-4 text-brand" />,
      shortcut: 'T',
      action: () => {
        onNavigate('templates');
        onClose();
      },
    },
    {
      id: 'cmd-settings-modules',
      title: 'Module Registry & Settings',
      category: 'Administration',
      icon: <Settings className="w-4 h-4 text-ink-soft" />,
      shortcut: 'M',
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
    ...suppliers.map(s => ({
      id: `cmd-switch-${s.id}`,
      title: `Switch Entity to: ${s.tradeName} (${s.invoicePrefix})`,
      category: 'Supplier Entities',
      icon: <Building2 className="w-4 h-4 text-brand" />,
      action: () => {
        setActiveSupplierId(s.id);
        onClose();
      },
    })),
  ];

  // Filter commands
  const filtered = allCommands.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 p-4 z-50">
      <div className="bg-card border border-line rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search className="w-4 h-4 text-ink-faint shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or jump to screen (e.g. 'Bill VTL', 'Log trip')..."
            className="w-full text-sm bg-transparent border-none text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="text-[10px] bg-paper border border-line px-1.5 py-0.5 rounded text-ink-faint font-mono font-semibold">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-faint">
              No matching commands or destinations found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                    isSelected
                      ? 'bg-brand-tint text-brand'
                      : 'text-ink hover:bg-paper'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-ink-faint">
                    <span className="bg-paper px-1.5 py-0.5 rounded border border-line-soft">
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <kbd className="bg-white px-1.5 py-0.5 rounded border border-line font-mono font-bold text-ink">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-paper/60 border-t border-line flex items-center justify-between text-[11px] text-ink-faint">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Apple-Simple Command Palette</span>
        </div>
      </div>
    </div>
  );
};
