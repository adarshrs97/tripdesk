import React, { useState } from 'react';
import {
  Layout,
  Plus,
  Copy,
  Download,
  Upload,
  Eye,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { InvoiceTemplate } from '../../engine/templates/types';
import { ALL_BUILT_IN_INVOICE_TEMPLATES } from '../../engine/templates/seeds/defaultInvoiceTemplates';
import { renderInvoiceTemplate } from '../../engine/templates/templateRenderer';
import { format2VTLTemplate } from '../../engine/templates/seeds/format2VTL';
import { useAuth } from '../../context/AuthContext';

export const TemplateGalleryManager: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [templates, setTemplates] = useState<InvoiceTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('starciti_custom_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...ALL_BUILT_IN_INVOICE_TEMPLATES, ...parsed];
      }
    } catch {
      // ignore
    }
    return ALL_BUILT_IN_INVOICE_TEMPLATES;
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<'page' | 'header' | 'table' | 'breakup' | 'footer' | 'languages'>('page');
  const [previewMode, setPreviewMode] = useState<'vtl_real' | 'sample'>('vtl_real');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State for Active Template in Builder
  const [activeDraft, setActiveDraft] = useState<InvoiceTemplate>(format2VTLTemplate);

  // Sample Mock Context for Live Preview
  const sampleDataVTL = {
    invoice: {
      number: '108191',
      date: '31/08/2026',
      periodText: '01/08/2026 to 31/08/2026',
      dueDate: '30/09/2026',
      placeOfSupply: 'Trivandrum, Kerala',
      rcmApplicable: 'No',
    },
    supplier: {
      legalName: 'M/S City Tours & Travels',
      tradeName: 'M/S City Tours & Travels',
      address: 'Killipalam - Attakulangara Bypass Road, Trivandrum, Kerala - 695002',
      phone: '+91 623 860 320 0 / 8136910938',
      email: '',
      pan: 'BGYPM6861Q',
      gstin: '32BGYPM6861Q1Z3',
      bankName: 'State Bank of India',
      bankAccountNo: '34289012345',
      bankIfsc: 'SBIN0070028',
      bankBranch: 'Killipalam',
    },
    customer: {
      name: 'M/s Vindhya Telelinks Limited (Public Limited Company)',
      billingAddress: 'Cochin / Trivandrum Project Office, Kerala',
      gstin: '32AABCV1234F1Z1',
      pan: 'AABCV1234F',
    },
    contract: {
      name: 'VTL Cochin Rental Agreement',
      agreementNo: 'VTL-TRV-2024-01 (12/08/2024)',
      vehiclePlate: 'KL 01 CP 3284 (Maruti Dzire)',
      driverName: 'Muhammad Fayaz.s / Hemanth Kumar',
      sacCode: '996601',
    },
    outputs: {
      fixedAmount: 65000,
      totalKmUsed: 1884,
      includedKm: 3000,
      extraKm: 0,
      extraKmAmount: 0,
      totalExtraMinutes: 585,
      extraHoursDecimal: 9.75,
      extraHoursAmount: 1462.5,
      nightBataAmount: 400,
      outstationBataAmount: 600,
      tollPermitAmount: 1200,
      subtotal: 68662.5,
      roundOff: -0.5,
      totalAmount: 68662,
      taxableTotal: 65392.38,
      cgstAmount: 1634.81,
      sgstAmount: 1634.81,
      totalTax: 3269.62,
    },
    rows: [
      {
        index: 1,
        description: 'Monthly Fixed Vehicle Rent for Sedan (Maruti Dzire KL01CP3284) - 3000 KM & 12 Hrs/Day',
        sacHsn: '996601',
        quantityFormatted: '1 Month',
        rate: 65000,
        netTotal: 65000,
      },
      {
        index: 2,
        description: 'Additional Running Hours (9h 45m = 585 mins pro-rata @ ₹150/hr)',
        sacHsn: '996601',
        quantityFormatted: '9h 45m',
        rate: 150,
        netTotal: 1462.5,
      },
    ],
  };

  const sampleDataAdHoc = {
    invoice: {
      number: '109001',
      date: '23/11/2026',
      periodText: '23/11/2026',
      dueDate: '23/12/2026',
      placeOfSupply: 'Kerala (32)',
      rcmApplicable: 'No',
    },
    supplier: {
      legalName: 'City Tours & Travels',
      tradeName: 'City Tours & Travels',
      address: 'Killipalam, Trivandrum, Kerala',
      phone: '+91 6238603200',
      email: 'info@starcititravels.com',
      pan: 'BGYPM6861Q',
      gstin: '32BGYPM6861Q1Z3',
      bankName: 'State Bank of India',
      bankAccountNo: '34289012345',
      bankIfsc: 'SBIN0070028',
      bankBranch: 'Killipalam',
    },
    customer: {
      name: 'Dr. Anand Ramanathan',
      billingAddress: 'Medical College Junction, Trivandrum, Kerala',
      pan: 'AAAPR1234K',
      gstin: '',
    },
    contract: {
      name: 'Private Walk-in Rental',
      agreementNo: 'Ad-hoc Private Hire',
      vehiclePlate: 'KL 01 CP 3284',
      driverName: 'R. Sreekumar',
      sacCode: '996601',
    },
    outputs: {
      subtotal: 3800,
      discountAmount: 240,
      taxableTotal: 3560,
      cgstAmount: 89,
      sgstAmount: 89,
      totalTax: 178,
      roundOff: 0,
      totalAmount: 3738,
    },
    rows: [
      { index: 1, description: 'Airport Pickup & Drop (TRV)', sacHsn: '996601', quantityFormatted: '1 trip', rate: 1200, netTotal: 1200 },
      { index: 2, description: 'Outstation Running (150 km @ ₹16)', sacHsn: '996601', quantityFormatted: '150 km', rate: 16, netTotal: 2160 },
      { index: 3, description: 'Driver Night Bata Allowance', sacHsn: '996601', quantityFormatted: '1 night', rate: 200, netTotal: 200 },
    ],
  };

  const activeContext = previewMode === 'vtl_real' ? sampleDataVTL : sampleDataAdHoc;

  // Open Template in Visual Builder
  const handleOpenBuilder = (template: InvoiceTemplate) => {
    setActiveDraft(JSON.parse(JSON.stringify(template)));
    setIsEditorOpen(true);
  };

  // Clone Template
  const handleClone = (template: InvoiceTemplate) => {
    const cloned: InvoiceTemplate = {
      ...JSON.parse(JSON.stringify(template)),
      id: `custom-template-${Date.now()}`,
      name: `${template.name} (Custom Copy)`,
      code: `${template.code}_COPY`,
      version: 1,
      status: 'draft',
    };
    setActiveDraft(cloned);
    setIsEditorOpen(true);
  };

  // Blank Canvas
  const handleBlankCanvas = () => {
    const blank: InvoiceTemplate = {
      id: `custom-blank-${Date.now()}`,
      name: 'Untitled Custom Template',
      code: `CUSTOM_TPL_${Date.now().toString().slice(-4)}`,
      version: 1,
      status: 'draft',
      pricingModelId: 'per_trip_package',
      pageSetup: { orientation: 'portrait', paperSize: 'A4', marginMm: 12 },
      header: {
        showSupplierLogo: true,
        showSupplierAddress: true,
        showRecipientDetails: true,
        titleText: 'TAX INVOICE',
        metaFields: [
          { key: 'invNo', label: 'Invoice No', source: 'invoice.number' },
          { key: 'invDate', label: 'Date', source: 'invoice.date' },
        ],
      },
      lineTable: {
        title: 'Duty Particulars',
        columns: [
          { id: 'c-sl', label: 'Sl', source: 'row.index', format: 'number', align: 'center', width: '8%', show: true },
          { id: 'c-desc', label: 'Particulars', source: 'row.description', format: 'text', align: 'left', width: '64%', show: true },
          { id: 'c-amt', label: 'Amount (₹)', source: 'row.netTotal', format: 'money', align: 'right', width: '28%', show: true },
        ],
      },
      breakupRows: [
        { id: 'b-sub', label: 'Subtotal', source: 'outputs.subtotal', format: 'money' },
      ],
      totals: { rounding: 'down', showInWords: true, gstBlock: true },
      footer: {
        bankDetails: true,
        upiQr: false,
        termsAndConditions: ['Payment strictly due within 15 days.'],
        signatureBlock: { title: 'Authorised Signatory', subtitle: 'Desk Operations' },
      },
      annexure: { attachLedger: false },
      styleTokens: {
        primaryColor: '#0b6e63',
        accentColor: '#10b981',
        fontFamily: 'Inter',
        tableBorder: 'grid',
        compactDensity: false,
      },
    };
    setActiveDraft(blank);
    setIsEditorOpen(true);
  };

  // Propose Standard Blocks
  const handleProposeBlocks = () => {
    setActiveDraft((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        metaFields: [
          { key: 'invNo', label: 'Invoice No', source: 'invoice.number' },
          { key: 'invDate', label: 'Date', source: 'invoice.date' },
          { key: 'agrNo', label: 'Agreement Ref', source: 'contract.agreementNo' },
          { key: 'vehicle', label: 'Vehicle No', source: 'contract.vehiclePlate' },
        ],
      },
      lineTable: {
        title: 'Billed Services',
        columns: [
          { id: 'c-sl', label: 'Sl No', source: 'row.index', format: 'number', align: 'center', width: '6%', show: true },
          { id: 'c-desc', label: 'Description of Service', source: 'row.description', format: 'text', align: 'left', width: '50%', show: true },
          { id: 'c-sac', label: 'SAC', source: 'row.sacHsn', format: 'text', align: 'center', width: '12%', show: true },
          { id: 'c-qty', label: 'Qty', source: 'row.quantityFormatted', format: 'text', align: 'right', width: '14%', show: true },
          { id: 'c-amt', label: 'Amount (₹)', source: 'row.netTotal', format: 'money', align: 'right', width: '18%', show: true },
        ],
      },
      breakupRows: [
        { id: 'b-rent', label: 'Fixed Base Package', source: 'outputs.fixedAmount', format: 'money' },
        { id: 'b-hrs', label: 'Extra Duty Hours', source: 'outputs.extraHoursAmount', format: 'money', condition: 'outputs.extraHoursAmount > 0' },
        { id: 'b-bata', label: 'Night / Outstation Bata', source: 'outputs.nightBataAmount', format: 'money', condition: 'outputs.nightBataAmount > 0' },
        { id: 'b-toll', label: 'Toll & State Permits', source: 'outputs.tollPermitAmount', format: 'money', condition: 'outputs.tollPermitAmount > 0' },
      ],
      totals: { rounding: 'down', showInWords: true, gstBlock: true },
      footer: {
        bankDetails: true,
        upiQr: true,
        termsAndConditions: [
          '1. Payment strictly due within agreed credit terms.',
          '2. Subject to Trivandrum jurisdiction.',
        ],
        signatureBlock: { title: 'For City Tours & Travels', subtitle: 'Authorised Signatory' },
      },
    }));
    setStatusMsg({ type: 'success', text: 'Scaffolded standard proposed blocks into visual builder!' });
  };

  // Export JSON
  const handleExportJson = (template: InvoiceTemplate) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${template.code || 'template'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!parsed.id || !parsed.name || !parsed.lineTable) {
            throw new Error('Invalid template schema');
          }
          parsed.id = `imported-${Date.now()}`;
          parsed.status = 'draft';
          setTemplates((prev) => [...prev, parsed]);
          setStatusMsg({ type: 'success', text: `Imported template "${parsed.name}" successfully!` });
        } catch {
          setStatusMsg({ type: 'error', text: 'Failed to import JSON: Invalid template structure.' });
        }
      };
    }
  };

  // Save / Publish Draft
  const handleSaveDraft = (publish: boolean = false) => {
    if (!activeDraft.name.trim()) {
      setStatusMsg({ type: 'error', text: 'Template name is required.' });
      return;
    }

    const updatedTemplate: InvoiceTemplate = {
      ...activeDraft,
      version: publish ? activeDraft.version + 1 : activeDraft.version,
      status: publish ? 'published' : 'draft',
      updatedAt: new Date().toISOString(),
    };

    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === updatedTemplate.id);
      const next = idx >= 0 ? [...prev] : [...prev, updatedTemplate];
      if (idx >= 0) next[idx] = updatedTemplate;

      const customOnly = next.filter((t) => !ALL_BUILT_IN_INVOICE_TEMPLATES.some((b) => b.id === t.id));
      localStorage.setItem('starciti_custom_templates', JSON.stringify(customOnly));
      return next;
    });

    setIsEditorOpen(false);
    setStatusMsg({
      type: 'success',
      text: publish
        ? `Template "${updatedTemplate.name}" published as version ${updatedTemplate.version}!`
        : `Draft saved successfully!`,
    });
  };

  // Live Rendered Invoice Output
  const renderedOutput = renderInvoiceTemplate(activeDraft, activeContext);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Layout className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">Invoice Template Gallery &amp; Visual Builder</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded-full uppercase">
                Admin Controlled
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Customize layouts, labels, column orders, and tax summary blocks. Rules stay tested in code; styling and blocks are editable here.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          {isAdmin && (
            <>
              <button
                onClick={handleBlankCanvas}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-gray-500" />
                <span>Blank Canvas</span>
              </button>

              <button
                onClick={() => handleClone(format2VTLTemplate)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Clone &amp; Edit Built-in</span>
              </button>
            </>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-gray-400 hover:text-gray-600 font-bold ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Template Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {templates.map((tpl) => {
          const isBuiltIn = ALL_BUILT_IN_INVOICE_TEMPLATES.some((b) => b.id === tpl.id);
          return (
            <div
              key={tpl.id}
              className="bg-white rounded-2xl border border-gray-200 p-4.5 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">{tpl.code}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        tpl.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      v{tpl.version} &bull; {tpl.status}
                    </span>
                  </div>
                </div>

                <h4 className="font-bold text-sm text-gray-900 leading-snug">{tpl.name}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{tpl.description}</p>

                {/* Badge tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                    {tpl.pricingModelId.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                    {tpl.lineTable.columns.filter((c) => c.show).length} cols
                  </span>
                  {tpl.totals.gstBlock && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                      GST Breakdown
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    handleOpenBuilder(tpl);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isBuiltIn ? 'Inspect / Clone' : 'Edit Template'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleExportJson(tpl)}
                    title="Export JSON definition"
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleClone(tpl)}
                    title="Clone to new custom template"
                    className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* VISUAL BUILDER MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
                    Visual Invoice Builder: {activeDraft.name}
                    <span className="text-xs px-2 py-0.5 rounded font-mono font-normal bg-gray-200 text-gray-700">
                      v{activeDraft.version} ({activeDraft.status})
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">Edit page layout, column bindings, formulas, and legal disclaimers.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleProposeBlocks}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Propose Blocks</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 text-lg font-bold rounded-lg cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Split Body: Controls (Left) and Live Preview (Right) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Controls Panel (5 cols) */}
              <div className="lg:col-span-5 border-r border-gray-200 flex flex-col h-full bg-white overflow-hidden">
                {/* Control Tabs */}
                <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50/50 p-1 text-xs font-semibold">
                  <button
                    onClick={() => setEditorTab('page')}
                    className={`px-3 py-2 rounded-lg transition-colors shrink-0 ${
                      editorTab === 'page' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Page &amp; Theme
                  </button>
                  <button
                    onClick={() => setEditorTab('header')}
                    className={`px-3 py-2 rounded-lg transition-colors shrink-0 ${
                      editorTab === 'header' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Header &amp; Meta
                  </button>
                  <button
                    onClick={() => setEditorTab('table')}
                    className={`px-3 py-2 rounded-lg transition-colors shrink-0 ${
                      editorTab === 'table' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Columns ({activeDraft.lineTable.columns.filter((c) => c.show).length})
                  </button>
                  <button
                    onClick={() => setEditorTab('breakup')}
                    className={`px-3 py-2 rounded-lg transition-colors shrink-0 ${
                      editorTab === 'breakup' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Breakup &amp; Tax
                  </button>
                  <button
                    onClick={() => setEditorTab('footer')}
                    className={`px-3 py-2 rounded-lg transition-colors shrink-0 ${
                      editorTab === 'footer' ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Footer &amp; Bank
                  </button>
                </div>

                {/* Tab Forms */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
                  {/* TAB 1: PAGE & THEME */}
                  {editorTab === 'page' && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">Template Name *</label>
                        <input
                          type="text"
                          value={activeDraft.name}
                          onChange={(e) => setActiveDraft({ ...activeDraft, name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={activeDraft.description || ''}
                          onChange={(e) => setActiveDraft({ ...activeDraft, description: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-700 font-semibold mb-1">Primary Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={activeDraft.styleTokens.primaryColor}
                              onChange={(e) =>
                                setActiveDraft({
                                  ...activeDraft,
                                  styleTokens: { ...activeDraft.styleTokens, primaryColor: e.target.value },
                                })
                              }
                              className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300"
                            />
                            <span className="font-mono text-gray-600">{activeDraft.styleTokens.primaryColor}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-semibold mb-1">Margin (mm)</label>
                          <input
                            type="number"
                            min={8}
                            max={25}
                            value={activeDraft.pageSetup.marginMm}
                            onChange={(e) =>
                              setActiveDraft({
                                ...activeDraft,
                                pageSetup: { ...activeDraft.pageSetup, marginMm: Number(e.target.value) },
                              })
                            }
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">Pricing Model Binding</label>
                        <select
                          value={activeDraft.pricingModelId}
                          onChange={(e) =>
                            setActiveDraft({ ...activeDraft, pricingModelId: e.target.value as any })
                          }
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white"
                        >
                          <option value="monthly_fixed">Monthly Fixed Contract (e.g. VTL)</option>
                          <option value="per_trip_package">Per-Trip Package (e.g. School)</option>
                          <option value="per_km">Per-KM Distance</option>
                          <option value="per_day">Daily Flat Rate</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="compactDensity"
                          checked={activeDraft.styleTokens.compactDensity}
                          onChange={(e) =>
                            setActiveDraft({
                              ...activeDraft,
                              styleTokens: { ...activeDraft.styleTokens, compactDensity: e.target.checked },
                            })
                          }
                          className="rounded text-emerald-600"
                        />
                        <label htmlFor="compactDensity" className="text-gray-700 font-medium">
                          Compact Table Density (Fits more rows on a single A4 page)
                        </label>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: HEADER & META */}
                  {editorTab === 'header' && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">Document Header Title</label>
                        <input
                          type="text"
                          value={activeDraft.header.titleText}
                          onChange={(e) =>
                            setActiveDraft({
                              ...activeDraft,
                              header: { ...activeDraft.header, titleText: e.target.value },
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white uppercase font-bold"
                        />
                      </div>

                      <div className="space-y-2 pt-1">
                        <label className="block text-gray-700 font-semibold">Header Block Visibility</label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 text-gray-600">
                            <input
                              type="checkbox"
                              checked={activeDraft.header.showSupplierAddress}
                              onChange={(e) =>
                                setActiveDraft({
                                  ...activeDraft,
                                  header: { ...activeDraft.header, showSupplierAddress: e.target.checked },
                                })
                              }
                            />
                            <span>Show Supplier Details (PAN, GSTIN, Address, Contacts)</span>
                          </label>
                          <label className="flex items-center gap-2 text-gray-600">
                            <input
                              type="checkbox"
                              checked={activeDraft.header.showRecipientDetails}
                              onChange={(e) =>
                                setActiveDraft({
                                  ...activeDraft,
                                  header: { ...activeDraft.header, showRecipientDetails: e.target.checked },
                                })
                              }
                            />
                            <span>Show Customer / Recipient Block</span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <label className="font-semibold text-gray-700">Metadata Field Chips</label>
                          <button
                            type="button"
                            onClick={() => {
                              const newField = {
                                key: `field-${Date.now()}`,
                                label: 'Custom Ref',
                                source: 'invoice.number',
                              };
                              setActiveDraft({
                                ...activeDraft,
                                header: {
                                  ...activeDraft.header,
                                  metaFields: [...activeDraft.header.metaFields, newField],
                                },
                              });
                            }}
                            className="text-emerald-700 font-semibold hover:text-emerald-800 text-xs"
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-2">
                          {activeDraft.header.metaFields.map((f, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                              <input
                                type="text"
                                value={f.label}
                                onChange={(e) => {
                                  const updated = [...activeDraft.header.metaFields];
                                  updated[idx].label = e.target.value;
                                  setActiveDraft({ ...activeDraft, header: { ...activeDraft.header, metaFields: updated } });
                                }}
                                className="w-1/2 border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                              />
                              <input
                                type="text"
                                value={f.source}
                                onChange={(e) => {
                                  const updated = [...activeDraft.header.metaFields];
                                  updated[idx].source = e.target.value;
                                  setActiveDraft({ ...activeDraft, header: { ...activeDraft.header, metaFields: updated } });
                                }}
                                className="w-1/2 font-mono text-[11px] border border-gray-300 rounded px-2 py-1 bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = activeDraft.header.metaFields.filter((_, i) => i !== idx);
                                  setActiveDraft({ ...activeDraft, header: { ...activeDraft.header, metaFields: updated } });
                                }}
                                className="text-gray-400 hover:text-red-600 font-bold px-1"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: LINE TABLE COLUMNS */}
                  {editorTab === 'table' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Columns Configuration</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newCol = {
                              id: `col-${Date.now()}`,
                              label: 'New Column',
                              source: 'row.netTotal',
                              format: 'money' as const,
                              align: 'right' as const,
                              width: '15%',
                              show: true,
                            };
                            setActiveDraft({
                              ...activeDraft,
                              lineTable: {
                                ...activeDraft.lineTable,
                                columns: [...activeDraft.lineTable.columns, newCol],
                              },
                            });
                          }}
                          className="text-emerald-700 font-semibold hover:text-emerald-800"
                        >
                          + Add Column
                        </button>
                      </div>

                      <div className="space-y-2">
                        {activeDraft.lineTable.columns.map((col, idx) => (
                          <div key={col.id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="flex items-center gap-1.5 font-semibold text-gray-800">
                                <input
                                  type="checkbox"
                                  checked={col.show}
                                  onChange={(e) => {
                                    const updated = [...activeDraft.lineTable.columns];
                                    updated[idx].show = e.target.checked;
                                    setActiveDraft({ ...activeDraft, lineTable: { ...activeDraft.lineTable, columns: updated } });
                                  }}
                                />
                                <span>{col.label}</span>
                              </label>
                              <div className="flex items-center gap-1">
                                <select
                                  value={col.align}
                                  onChange={(e) => {
                                    const updated = [...activeDraft.lineTable.columns];
                                    updated[idx].align = e.target.value as any;
                                    setActiveDraft({ ...activeDraft, lineTable: { ...activeDraft.lineTable, columns: updated } });
                                  }}
                                  className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = activeDraft.lineTable.columns.filter((_, i) => i !== idx);
                                    setActiveDraft({ ...activeDraft, lineTable: { ...activeDraft.lineTable, columns: updated } });
                                  }}
                                  className="text-gray-400 hover:text-red-600 px-1 font-bold"
                                >
                                  &times;
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Header Label"
                                value={col.label}
                                onChange={(e) => {
                                  const updated = [...activeDraft.lineTable.columns];
                                  updated[idx].label = e.target.value;
                                  setActiveDraft({ ...activeDraft, lineTable: { ...activeDraft.lineTable, columns: updated } });
                                }}
                                className="border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Data Source"
                                value={col.source}
                                onChange={(e) => {
                                  const updated = [...activeDraft.lineTable.columns];
                                  updated[idx].source = e.target.value;
                                  setActiveDraft({ ...activeDraft, lineTable: { ...activeDraft.lineTable, columns: updated } });
                                }}
                                className="font-mono text-[11px] border border-gray-300 rounded px-2 py-1 bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: BREAKUP & TAX */}
                  {editorTab === 'breakup' && (
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Breakup Adjustment Rows</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newB = {
                              id: `b-${Date.now()}`,
                              label: 'Custom Charge',
                              source: 'outputs.subtotal',
                              format: 'money' as const,
                            };
                            setActiveDraft({
                              ...activeDraft,
                              breakupRows: [...activeDraft.breakupRows, newB],
                            });
                          }}
                          className="text-emerald-700 font-semibold hover:text-emerald-800"
                        >
                          + Add Breakup
                        </button>
                      </div>

                      <div className="space-y-2">
                        {activeDraft.breakupRows.map((b, idx) => (
                          <div key={b.id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex items-center gap-2">
                            <input
                              type="text"
                              value={b.label}
                              onChange={(e) => {
                                const updated = [...activeDraft.breakupRows];
                                updated[idx].label = e.target.value;
                                setActiveDraft({ ...activeDraft, breakupRows: updated });
                              }}
                              className="w-1/2 border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                            />
                            <input
                              type="text"
                              value={b.source}
                              onChange={(e) => {
                                const updated = [...activeDraft.breakupRows];
                                updated[idx].source = e.target.value;
                                setActiveDraft({ ...activeDraft, breakupRows: updated });
                              }}
                              className="w-1/2 font-mono text-[11px] border border-gray-300 rounded px-2 py-1 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = activeDraft.breakupRows.filter((_, i) => i !== idx);
                                setActiveDraft({ ...activeDraft, breakupRows: updated });
                              }}
                              className="text-gray-400 hover:text-red-600 px-1 font-bold"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <label className="flex items-center gap-2 text-gray-700 font-semibold">
                          <input
                            type="checkbox"
                            checked={activeDraft.totals.gstBlock}
                            onChange={(e) =>
                              setActiveDraft({
                                ...activeDraft,
                                totals: { ...activeDraft.totals, gstBlock: e.target.checked },
                              })
                            }
                          />
                          <span>Show GST Schedule (CGST + SGST or IGST)</span>
                        </label>
                        <label className="flex items-center gap-2 text-gray-700 font-semibold">
                          <input
                            type="checkbox"
                            checked={activeDraft.totals.showInWords}
                            onChange={(e) =>
                              setActiveDraft({
                                ...activeDraft,
                                totals: { ...activeDraft.totals, showInWords: e.target.checked },
                              })
                            }
                          />
                          <span>Display Amount in Words (Indian Rupees)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: FOOTER & BANK */}
                  {editorTab === 'footer' && (
                    <div className="space-y-3.5">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-gray-700 font-semibold">
                          <input
                            type="checkbox"
                            checked={activeDraft.footer.bankDetails}
                            onChange={(e) =>
                              setActiveDraft({
                                ...activeDraft,
                                footer: { ...activeDraft.footer, bankDetails: e.target.checked },
                              })
                            }
                          />
                          <span>Show Bank Account Details (RTGS / NEFT)</span>
                        </label>
                        <label className="flex items-center gap-2 text-gray-700 font-semibold">
                          <input
                            type="checkbox"
                            checked={activeDraft.footer.upiQr}
                            onChange={(e) =>
                              setActiveDraft({
                                ...activeDraft,
                                footer: { ...activeDraft.footer, upiQr: e.target.checked },
                              })
                            }
                          />
                          <span>Include Scan &amp; Pay UPI QR Code</span>
                        </label>
                      </div>

                      <div className="pt-2 border-t border-gray-200">
                        <label className="block text-gray-700 font-semibold mb-1">Authorised Signatory Title</label>
                        <input
                          type="text"
                          value={activeDraft.footer.signatureBlock.title}
                          onChange={(e) =>
                            setActiveDraft({
                              ...activeDraft,
                              footer: {
                                ...activeDraft.footer,
                                signatureBlock: { ...activeDraft.footer.signatureBlock, title: e.target.value },
                              },
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">Terms &amp; Conditions (Line-by-Line)</label>
                        <textarea
                          rows={3}
                          value={activeDraft.footer.termsAndConditions.join('\n')}
                          onChange={(e) =>
                            setActiveDraft({
                              ...activeDraft,
                              footer: {
                                ...activeDraft.footer,
                                termsAndConditions: e.target.value.split('\n').filter((t) => t.trim().length > 0),
                              },
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls Action */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportJson(activeDraft)}
                    className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveDraft(false)}
                      className="px-3.5 py-2 border border-gray-300 rounded-xl text-gray-700 text-xs font-semibold hover:bg-white cursor-pointer"
                    >
                      Save Draft
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleSaveDraft(true)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        Publish Version {activeDraft.version + 1}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Live Preview Panel (7 cols) */}
              <div className="lg:col-span-7 bg-slate-100 p-4 md:p-6 overflow-y-auto flex flex-col items-center">
                {/* Preview Data Selector Bar */}
                <div className="w-full max-w-[650px] mb-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-600 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      Live Preview Data:
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('vtl_real')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        previewMode === 'vtl_real' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      VTL August 2026 (Real)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('sample')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        previewMode === 'sample' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Walk-in Ad-Hoc Sample
                    </button>
                  </div>

                  <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Valid Template Syntax
                  </span>
                </div>

                {/* Simulated A4 Paper Card */}
                <div className="w-full max-w-[650px] bg-white rounded-xl shadow-lg border border-gray-300 p-6 space-y-4 text-gray-900">
                  {/* Header */}
                  <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-extrabold tracking-tight uppercase">{activeContext.supplier.legalName}</h4>
                      <p className="text-xs font-semibold text-emerald-700">{activeContext.supplier.tradeName}</p>
                      <p className="text-[10px] text-gray-500 mt-1 max-w-[320px]">{activeContext.supplier.address}</p>
                      <div className="text-[10px] text-gray-600 mt-1 flex gap-3">
                        <span>PAN: {activeContext.supplier.pan}</span>
                        <span>GSTIN: {activeContext.supplier.gstin}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-800 font-extrabold rounded text-xs tracking-wider uppercase">
                        {renderedOutput.title}
                      </span>
                      <div className="mt-2 space-y-0.5 text-[10px] text-right">
                        {renderedOutput.metaFields.map((m, idx) => (
                          <div key={idx} className="flex justify-end gap-2">
                            <span className="text-gray-500">{m.label}:</span>
                            <span className="font-semibold text-gray-900">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recipient */}
                  {activeDraft.header.showRecipientDetails && (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between text-xs">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-gray-500">Billed To / Recipient:</div>
                        <div className="font-bold text-gray-900 mt-0.5">{activeContext.customer.name}</div>
                        <div className="text-[10px] text-gray-600 mt-0.5">{activeContext.customer.billingAddress}</div>
                      </div>
                      <div className="text-right text-[10px] text-gray-600">
                        {activeContext.customer.gstin && <div>GSTIN: {activeContext.customer.gstin}</div>}
                        <div>Place of Supply: Trivandrum, Kerala</div>
                      </div>
                    </div>
                  )}

                  {/* Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 text-[10px] uppercase font-semibold">
                          {renderedOutput.columns.map((col) => (
                            <th key={col.id} style={{ textAlign: col.align, width: col.width }} className="p-2 border-r border-gray-200 last:border-r-0">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {renderedOutput.rows.map((row, rIdx) => (
                          <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            {row.cells.map((cell, cIdx) => (
                              <td key={cIdx} style={{ textAlign: cell.align }} className="p-2 border-r border-gray-200 last:border-r-0 text-gray-800">
                                {cell.formattedText}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Breakup & Totals */}
                  <div className="flex justify-between gap-4 pt-1">
                    {/* Left: Breakup */}
                    <div className="w-1/2 text-xs">
                      {renderedOutput.breakupRows.length > 0 ? (
                        <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50 space-y-1">
                          <div className="font-bold text-[10px] text-gray-700 uppercase border-b border-gray-200 pb-1">
                            Breakup &amp; Adjustments
                          </div>
                          {renderedOutput.breakupRows.map((b, idx) => (
                            <div key={idx} className="flex justify-between text-[10px] py-0.5 border-b border-dashed border-gray-200 last:border-b-0">
                              <span className="text-gray-600">{b.label}:</span>
                              <span className="font-semibold text-gray-900">{b.formattedText}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2 border border-gray-200 rounded text-[10px] text-gray-500">
                          Billed strictly as per agreed contract terms.
                        </div>
                      )}
                    </div>

                    {/* Right: Totals */}
                    <div className="w-1/2 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-gray-600 text-[11px]">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-gray-900 font-mono">
                          ₹{renderedOutput.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {renderedOutput.roundOff !== 0 && (
                        <div className="flex justify-between text-gray-500 text-[10px]">
                          <span>Round Off:</span>
                          <span className="font-mono">
                            {renderedOutput.roundOff > 0 ? '+₹' + renderedOutput.roundOff.toFixed(2) : '-₹' + Math.abs(renderedOutput.roundOff).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="border-t-2 border-slate-900 pt-1.5 flex justify-between items-baseline">
                        <span className="font-extrabold text-xs">Total Payable:</span>
                        <span className="font-extrabold text-sm font-mono text-emerald-800">
                          ₹{renderedOutput.totalAmount.toLocaleString('en-IN')}/-
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-1 text-[9px] text-gray-500 italic">
                        {renderedOutput.amountInWords}
                      </div>
                    </div>
                  </div>

                  {/* Footer: Bank & Signature */}
                  <div className="border-t border-gray-200 pt-3 flex justify-between items-end text-xs">
                    <div className="w-3/5 text-[9px] text-gray-500 space-y-1">
                      {activeDraft.footer.bankDetails && (
                        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-gray-700">
                          <strong>Bank:</strong> State Bank of India &bull; <strong>A/c:</strong> 34289012345 &bull; <strong>IFSC:</strong> SBIN0070028
                        </div>
                      )}
                      <div>{renderedOutput.terms.join(' • ')}</div>
                    </div>
                    <div className="text-right w-2/5">
                      <div className="text-[10px] font-bold text-gray-900">{renderedOutput.signature.title}</div>
                      <div className="h-8 border-b border-dashed border-gray-300 w-28 ml-auto my-1"></div>
                      <div className="text-[9px] text-gray-500">{renderedOutput.signature.subtitle}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
