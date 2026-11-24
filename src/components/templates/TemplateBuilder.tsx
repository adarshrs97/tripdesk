import React, { useState, useMemo } from 'react';
import {
  InvoiceTemplate,
  format1SchoolTemplate,
  format2VTLTemplate,
  renderInvoiceTemplate,
  validateFormula,
  evaluateFormula,
  InvoiceColumnDefinition,
  calculateFormat1Invoice,
  calculateMonthlyFixedInvoice,
  parseHHMM,
  DayLedgerEntry,
} from '../../engine';
import { InvoicePreview } from './InvoicePreview';
import {
  Sliders,
  Eye,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
  CheckCircle,
  Play,
  FileCheck2,
} from 'lucide-react';

export const TemplateBuilder: React.FC = () => {
  // Preset templates
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([
    { ...format1SchoolTemplate },
    { ...format2VTLTemplate },
  ]);

  const [activeTemplateId, setActiveTemplateId] = useState<string>(() => {
    const hash = window.location.hash;
    if (hash.includes('template=')) {
      const match = hash.match(/template=([^&]+)/);
      if (match && match[1]) return match[1];
    }
    return format1SchoolTemplate.id;
  });
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) || templates[0],
    [templates, activeTemplateId]
  );

  // Formula scratchpad state
  const [testFormula, setTestFormula] = useState<string>('row.extraKm > 0 ? row.extraKm * 15 : 0');
  const [formulaResult, setFormulaResult] = useState<any>(null);

  // Status message for actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Update active template helper
  const updateActiveTemplate = (updater: (prev: InvoiceTemplate) => InvoiceTemplate) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === activeTemplate.id ? updater({ ...t, status: 'draft' }) : t))
    );
  };

  // Publish new version
  const handlePublishVersion = () => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id === activeTemplate.id) {
          return {
            ...t,
            version: t.version + 1,
            status: 'published',
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    showToast(`Published Version ${activeTemplate.version + 1} successfully!`);
  };

  // Clone active template
  const handleCloneTemplate = () => {
    const cloned: InvoiceTemplate = {
      ...JSON.parse(JSON.stringify(activeTemplate)),
      id: `template-${Date.now()}`,
      name: `${activeTemplate.name} (Copy)`,
      version: 1,
      status: 'draft',
    };
    setTemplates((prev) => [...prev, cloned]);
    setActiveTemplateId(cloned.id);
    showToast(`Cloned template: ${cloned.name}`);
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeTemplate, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeTemplate.code}_v${activeTemplate.version}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported template JSON');
  };

  // Column operations
  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newColumns = [...activeTemplate.lineTable.columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newColumns.length) return;
    const [moved] = newColumns.splice(index, 1);
    newColumns.splice(targetIndex, 0, moved);
    updateActiveTemplate((t) => ({
      ...t,
      lineTable: { ...t.lineTable, columns: newColumns },
    }));
  };

  const toggleColumnVisibility = (colId: string) => {
    updateActiveTemplate((t) => ({
      ...t,
      lineTable: {
        ...t.lineTable,
        columns: t.lineTable.columns.map((c) => (c.id === colId ? { ...c, show: !c.show } : c)),
      },
    }));
  };

  const updateColumn = (colId: string, partial: Partial<InvoiceColumnDefinition>) => {
    updateActiveTemplate((t) => ({
      ...t,
      lineTable: {
        ...t.lineTable,
        columns: t.lineTable.columns.map((c) => (c.id === colId ? { ...c, ...partial } : c)),
      },
    }));
  };

  const addColumn = () => {
    const newCol: InvoiceColumnDefinition = {
      id: `col-custom-${Date.now()}`,
      label: 'New Field',
      source: 'row.customField',
      format: 'text',
      align: 'left',
      width: '12%',
      show: true,
    };
    updateActiveTemplate((t) => ({
      ...t,
      lineTable: {
        ...t.lineTable,
        columns: [...t.lineTable.columns, newCol],
      },
    }));
  };

  const deleteColumn = (colId: string) => {
    updateActiveTemplate((t) => ({
      ...t,
      lineTable: {
        ...t.lineTable,
        columns: t.lineTable.columns.filter((c) => c.id !== colId),
      },
    }));
  };

  // Sample data and render context for real-time live preview
  const renderedInvoice = useMemo(() => {
    if (activeTemplate.pricingModelId === 'per_trip_package') {
      const schoolLines: DayLedgerEntry[] = [
        { date: '01/08/2026', dayStatus: 'RUN', usedKm: 82, durationMinutes: 600, vehicleType: 'Sedan' },
        { date: '03/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('12.15'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
        { date: '03/08/2026', dayStatus: 'RUN', usedKm: 84, durationMinutes: 660, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
        { date: '04/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('11.45'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
        { date: '04/08/2026', dayStatus: 'RUN', usedKm: 90, durationMinutes: parseHHMM('10.15'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('10.30'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: 600, vehicleType: 'Sedan', vehicleSlot: 'Vehicle 2' },
        { date: '05/08/2026', dayStatus: 'RUN', usedKm: 80, durationMinutes: parseHHMM('12.30'), vehicleType: 'Sedan', vehicleSlot: 'Vehicle 1' },
      ];
      const calculation = calculateFormat1Invoice(schoolLines, {
        baseAmount: 2415,
        includedHours: 10,
        includedKm: 80,
        extraHourRate: 200,
        extraKmRate: 15,
        roundingMode: 'down',
      });

      return renderInvoiceTemplate(activeTemplate, {
        invoice: {
          number: 'SC/2026/08/01',
          date: '31/08/2026',
          periodText: '01/08/2026 to 05/08/2026',
        },
        supplier: {
          legalName: 'StarCiti Group',
          tradeName: '24x7 Luxury Taxi & Tours',
          address: 'Killipalam, Trivandrum 695002',
          phone: '+91 94470 12345',
          email: 'accounts@starcitigroup.com',
          pan: 'ABCDE1234F',
          gstin: '32ABCDE1234F1Z5',
          bankName: 'State Bank of India',
          bankAccountNo: '34567890123',
          bankIfsc: 'SBIN0001234',
          bankBranch: 'Trivandrum Main',
        },
        customer: {
          name: 'The Oxford School',
          billingAddress: 'Manacaud, Trivandrum 695009',
          gstin: '32AAAAA0000A1Z5',
        },
        contract: {
          name: 'School Transport Service',
          sacCode: '996601',
        },
        outputs: calculation,
        rows: calculation.rows,
      });
    } else {
      // Monthly fixed contract (VTL)
      const augEntries: DayLedgerEntry[] = [
        { date: '2026-08-01', dayStatus: 'RUN', usedKm: 48, durationMinutes: 780, nightBata: true },
        { date: '2026-08-03', dayStatus: 'RUN', usedKm: 118, durationMinutes: parseHHMM('13.15') },
        { date: '2026-08-05', dayStatus: 'RUN', usedKm: 215, durationMinutes: 780, outstationBata: true, permit: 600 },
        { date: '2026-08-16', dayStatus: 'RUN', usedKm: 197, durationMinutes: parseHHMM('12.30'), outstationBata: true, permit: 600 },
        { date: '2026-08-19', dayStatus: 'RUN', usedKm: 190, durationMinutes: 780, outstationBata: true },
        { date: '2026-08-22', dayStatus: 'RUN', usedKm: 141, durationMinutes: parseHHMM('15.30'), nightBata: true },
        { date: '2026-08-31', dayStatus: 'RUN', usedKm: 107, durationMinutes: parseHHMM('13.30') },
      ];
      const calculation = calculateMonthlyFixedInvoice('2026-08-01', '2026-08-31', augEntries, {
        fixedAmount: 65000,
        includedKm: 3000,
        includedHoursPerDay: 12,
        extraKmRate: 18,
        extraHourRate: 150,
        nightBataRate: 200,
        outstationBataRate: 200,
        contractWorkingDays: 30,
        roundingMode: 'down',
      });

      return renderInvoiceTemplate(activeTemplate, {
        invoice: {
          number: 'CT&T/2026-2027/08/01',
          date: '31/08/2026',
          periodText: '01/08/2026 to 31/08/2026',
        },
        supplier: {
          legalName: 'M/S CITY TOURS & TRAVELS',
          address: 'T.C. 38/2030, Killipalam, Karamana P.O., Trivandrum 695002',
          phone: '+91 94470 54321',
          pan: 'ABCDE1234F',
          bankName: 'Indian Bank',
          bankAccountNo: '6523910381',
          bankIfsc: 'IDIB000K037',
          bankBranch: 'Killipalam Branch',
        },
        customer: {
          name: 'M/S Vindhya Telelinks Ltd',
          billingAddress: 'Nemom / Trivandrum Office, Kerala',
        },
        contract: {
          name: 'VTL Dedicated Staff Car',
          agreementNo: 'VTL/OFC/AGMT/2024-25/001 DT. 01/09/2024',
          vehiclePlate: 'KL01 CP 3284',
          driverName: 'Sujith Kumar S',
          sacCode: '996601',
        },
        outputs: calculation,
        rows: [
          {
            description: 'Hiring charges for 7-seat AC Car KL01 CP 3284 with Driver for the month of August 2026',
            amount: calculation.fixedAmount,
          },
        ],
      });
    }
  }, [activeTemplate]);

  // Execute formula test
  const handleTestFormula = () => {
    const sampleContext = {
      row: {
        date: '01/08/2026',
        usedKm: 85,
        extraKm: 5,
        durationMinutes: 660,
        extraMinutes: 60,
      },
      outputs: {
        fixedAmount: 65000,
        extraHoursAmount: 1462.5,
        subtotal: 68662.5,
      },
    };
    const res = evaluateFormula(testFormula, sampleContext);
    setFormulaResult(res);
  };

  const formulaValidation = validateFormula(testFormula);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-gray-700 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-display">Invoice Template Builder</h1>
              <p className="text-xs text-gray-500">
                Declarative JSON layout, columns, formulas & styles — 100% admin controlled with live preview.
              </p>
            </div>
          </div>
        </div>

        {/* Template Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeTemplateId}
            onChange={(e) => setActiveTemplateId(e.target.value)}
            className="text-xs font-semibold bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (v{t.version} {t.status})
              </option>
            ))}
          </select>

          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              activeTemplate.status === 'published'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            v{activeTemplate.version} {activeTemplate.status}
          </span>

          <button
            onClick={handlePublishVersion}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Publish Version
          </button>

          <button
            onClick={handleCloneTemplate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
            title="Clone Template"
          >
            <Copy className="w-3.5 h-3.5" />
            Clone
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
            title="Export JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Editor Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Columns Editor Card */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-display">Line Table Columns</h3>
                <p className="text-[11px] text-gray-500">
                  Reorder, rename, or toggle visibility. Hidden columns are excluded from print.
                </p>
              </div>
              <button
                onClick={addColumn}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition"
              >
                <Plus className="w-3 h-3" />
                Add Column
              </button>
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {activeTemplate.lineTable.columns.map((col, index) => (
                <div
                  key={col.id}
                  className={`p-3 rounded-lg border transition text-xs space-y-2 ${
                    col.show
                      ? 'bg-gray-50/70 border-gray-200'
                      : 'bg-gray-100/60 border-dashed border-gray-300 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-mono text-[10px] text-gray-400 w-4">#{index + 1}</span>
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) => updateColumn(col.id, { label: e.target.value })}
                        className="font-semibold text-xs text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 flex-1 focus:ring-1 focus:ring-emerald-500"
                        placeholder="Column Label"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleColumnVisibility(col.id)}
                        className={`p-1 rounded text-xs ${
                          col.show ? 'text-emerald-700 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-200'
                        }`}
                        title={col.show ? 'Visible (Click to hide)' : 'Hidden (Click to show)'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveColumn(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveColumn(index, 'down')}
                        disabled={index === activeTemplate.lineTable.columns.length - 1}
                        className="p-1 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteColumn(col.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Delete Column"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sub-row: Source Field, Format, Alignment */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200/50 text-[11px]">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Source / Formula</span>
                      <input
                        type="text"
                        value={col.source}
                        onChange={(e) => updateColumn(col.id, { source: e.target.value })}
                        className="w-full font-mono text-[11px] bg-white border border-gray-300 rounded px-1.5 py-0.5 text-gray-700"
                      />
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Format</span>
                      <select
                        value={col.format}
                        onChange={(e) => updateColumn(col.id, { format: e.target.value as any })}
                        className="w-full bg-white border border-gray-300 rounded px-1.5 py-0.5 text-gray-700"
                      >
                        <option value="text">text</option>
                        <option value="money">money (₹)</option>
                        <option value="km">km</option>
                        <option value="HH:MM">HH:MM</option>
                        <option value="date">date</option>
                        <option value="number">number</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Align</span>
                      <select
                        value={col.align}
                        onChange={(e) => updateColumn(col.id, { align: e.target.value as any })}
                        className="w-full bg-white border border-gray-300 rounded px-1.5 py-0.5 text-gray-700"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Safe Formula Tester */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 font-display">Safe Formula Tester</h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  formulaValidation.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {formulaValidation.valid ? '✓ Valid Syntax' : '✗ Invalid Syntax'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Evaluated via expr-eval (zero eval). Context: <code>row</code>, <code>outputs</code>.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={testFormula}
                onChange={(e) => setTestFormula(e.target.value)}
                className="font-mono text-xs flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g. row.extraKm > 0 ? row.extraKm * 15 : 0"
              />
              <button
                onClick={handleTestFormula}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                Test
              </button>
            </div>

            {formulaResult !== null && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs flex justify-between items-center">
                <span className="text-gray-500 font-medium">Evaluation Result:</span>
                <span className="font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-gray-200">
                  {typeof formulaResult === 'object' ? JSON.stringify(formulaResult) : String(formulaResult)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Document Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
              <Eye className="w-4 h-4 text-emerald-700" />
              <span>Live Side-by-Side Preview (Real Month Data)</span>
            </div>
            <span className="text-[11px] text-gray-400">Updates instantly on template change</span>
          </div>

          <div className="overflow-x-auto pb-4">
            <InvoicePreview invoice={renderedInvoice} />
          </div>
        </div>
      </div>
    </div>
  );
};
