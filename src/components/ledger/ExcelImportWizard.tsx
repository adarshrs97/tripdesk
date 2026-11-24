import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Download,
  Languages,
  Bookmark,
  Building,
  Sparkles,
} from 'lucide-react';
import {
  exportLedgerToExcel,
  DayLedgerEntry,
  ImportColumnMapping,
  autoDetectColumnMapping,
  parseWorksheetWithMapping,
  saveCustomerImportProfile,
  getCustomerImportProfile,
  ValidationErrorItem,
} from '../../engine';
import { ledgerService } from '../../services/ledgerService';
import { Customer, Contract, MastersService } from '../../services/mastersService';

interface ExcelImportWizardProps {
  onImportComplete: () => void;
  onCancel: () => void;
}

export const ExcelImportWizard: React.FC<ExcelImportWizardProps> = ({
  onImportComplete,
  onCancel,
}) => {
  const [lang, setLang] = useState<'en' | 'ml'>('en');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');

  // Excel Raw State
  const [fileName, setFileName] = useState<string>('');
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);

  // Column Mapping State
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({
    dateCol: '',
    driverCol: '',
    vehicleCol: '',
    startKmCol: '',
    closeKmCol: '',
    usedKmCol: '',
    startTimeCol: '',
    closeTimeCol: '',
    nightBataCol: '',
    outstationBataCol: '',
    tollCol: '',
    remarksCol: '',
  });

  // Parsed Output & Validation State
  const [parsedEntries, setParsedEntries] = useState<DayLedgerEntry[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load Customers and Contracts on mount
  useEffect(() => {
    async function loadMasters() {
      const [custList, ctrList] = await Promise.all([
        MastersService.getCustomers(),
        MastersService.getContracts(),
      ]);
      setCustomers(custList);
      setContracts(ctrList);
      if (custList.length > 0) {
        setSelectedCustomerId(custList[0].id);
        const linked = ctrList.find((c) => c.customerId === custList[0].id);
        if (linked) setSelectedContractId(linked.id);
      }
    }
    loadMasters();
  }, []);

  // Update contract when customer changes
  const handleCustomerChange = async (newCustId: string) => {
    setSelectedCustomerId(newCustId);
    const linked = contracts.find((c) => c.customerId === newCustId);
    if (linked) setSelectedContractId(linked.id);

    // Load saved profile from database if available
    const saved = await getCustomerImportProfile(newCustId);
    if (saved && sheetHeaders.length > 0) {
      setColumnMapping(saved.mapping);
    }
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });
        setRawWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const initialSheet = wb.SheetNames[0] || '';
        setActiveSheetName(initialSheet);

        // Extract headers from first sheet
        if (initialSheet && wb.Sheets[initialSheet]) {
          processSheetHeaders(wb.Sheets[initialSheet], selectedCustomerId);
        }
      } catch (err) {
        console.error('Failed to parse workbook:', err);
        alert('Could not parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processSheetHeaders = async (sheet: XLSX.WorkSheet, custId: string) => {
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!rawRows || rawRows.length === 0) return;

    // Locate header row
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      const row = rawRows[i];
      if (Array.isArray(row)) {
        const rowStr = row.map((c) => String(c || '').toLowerCase()).join(' ');
        if (rowStr.includes('date') || rowStr.includes('km') || rowStr.includes('driver')) {
          headerRowIdx = i;
          break;
        }
      }
    }

    const headers = (rawRows[headerRowIdx] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
    setSheetHeaders(headers);

    // Check if customer has a saved profile in DB
    const savedProfile = custId ? await getCustomerImportProfile(custId) : null;
    let mapping: ImportColumnMapping;
    if (savedProfile) {
      mapping = savedProfile.mapping;
    } else {
      mapping = autoDetectColumnMapping(headers);
    }
    setColumnMapping(mapping);

    // Parse with mapping
    const result = parseWorksheetWithMapping(sheet, mapping);
    setParsedEntries(result.entries);
    setValidationErrors(result.validationErrors);
  };

  // Re-parse when sheet or mapping changes
  const handleSheetChange = (newSheetName: string) => {
    setActiveSheetName(newSheetName);
    if (rawWorkbook && rawWorkbook.Sheets[newSheetName]) {
      processSheetHeaders(rawWorkbook.Sheets[newSheetName], selectedCustomerId);
    }
  };

  const handleMappingChange = (field: keyof ImportColumnMapping, value: string) => {
    const updated = { ...columnMapping, [field]: value };
    setColumnMapping(updated);

    if (rawWorkbook && activeSheetName && rawWorkbook.Sheets[activeSheetName]) {
      const result = parseWorksheetWithMapping(rawWorkbook.Sheets[activeSheetName], updated);
      setParsedEntries(result.entries);
      setValidationErrors(result.validationErrors);
    }
  };

  // Save current mapping as customer profile into PostgreSQL DB
  const handleSaveProfile = async () => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    try {
      await saveCustomerImportProfile(
        selectedCustomerId,
        customer?.name || 'Customer Profile',
        columnMapping
      );
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 2500);
    } catch (err) {
      console.error('Failed to save profile to database:', err);
    }
  };

  // Commit Parsed Entries to Starciti Ledger
  const handleCommitToLedger = () => {
    if (!selectedContractId || parsedEntries.length === 0) return;

    // Save each parsed entry into ledgerService for the chosen contract and month
    parsedEntries.forEach((entry) => {
      ledgerService.saveEntry(selectedContractId, selectedMonth, entry);
    });

    setSaveSuccess(true);
    setTimeout(() => {
      onImportComplete();
    }, 1200);
  };

  // Export current clean sheet
  const handleExportCleanExcel = () => {
    if (parsedEntries.length === 0) return;
    const bytes = exportLedgerToExcel(parsedEntries, {
      sheetTitle: `${activeSheetName || 'Trip_Ledger'} Cleaned`,
    });
    const blob = new Blob([bytes as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Starciti_Clean_${activeSheetName || 'Ledger'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId);
  const activeContract = contracts.find((c) => c.id === selectedContractId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-ink">
      {/* Top Header Card */}
      <div className="bg-card rounded-2xl p-6 border border-line shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
              {lang === 'ml' ? 'സ്മാർട്ട് എക്സൽ ഇംപോർട്ടർ' : 'Smart Excel Ingestion & Clean-Up'}
            </span>
            <button
              onClick={() => setLang(lang === 'en' ? 'ml' : 'en')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline px-2 py-0.5 rounded bg-paper border border-line"
              title="Toggle English / Malayalam"
            >
              <Languages className="w-3 h-3" />
              <span>{lang === 'en' ? 'മലയാളം' : 'English'}</span>
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading mt-1">
            {lang === 'ml' ? 'എക്സൽ ട്രിപ്പ് ലോഗ്ബുക്ക് ഇംപോർട്ട്' : 'Smart Excel Logbook Import Wizard'}
          </h1>
          <p className="text-xs text-ink-soft mt-1 max-w-2xl">
            {lang === 'ml'
              ? 'ഏത് എക്സൽ ലേഔട്ടും മാപ്പ് ചെയ്യുക, ഉപഭോക്താവിനായി പ്രൊഫൈൽ സൂക്ഷിക്കുക, തെറ്റുകൾ തിരുത്തി ലെഡ്ജറിലേക്ക് ചേർക്കുക.'
              : 'Map arbitrary Excel layouts, save reusable import profiles per customer, preview validation errors (bad HH.MM, km gaps, duplicates), and commit to ledger.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-line rounded-xl text-xs font-semibold text-ink-soft hover:bg-paper transition"
          >
            {lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
          </button>
        </div>
      </div>

      {/* Target Customer & Contract Selector */}
      <div className="bg-card border border-line rounded-2xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1.5 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-brand" />
            <span>{lang === 'ml' ? 'ലക്ഷ്യ ഉപഭോക്താവ് *' : 'Target Customer *'}</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-medium"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1.5">
            {lang === 'ml' ? 'കരാർ *' : 'Linked Contract *'}
          </label>
          <select
            value={selectedContractId}
            onChange={(e) => setSelectedContractId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-medium"
          >
            {contracts
              .filter((c) => c.customerId === selectedCustomerId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Agr #{c.agreementNo} ({c.contractKind.replace('_', ' ')})
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1.5">
            {lang === 'ml' ? 'ബില്ലിംഗ് മാസം (YYYY-MM)' : 'Billing Month (YYYY-MM)'}
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-paper border border-line rounded-xl text-ink focus:outline-none focus:border-brand font-mono"
          />
        </div>
      </div>

      {/* Upload Drop Zone */}
      {!rawWorkbook ? (
        <div className="bg-card border-2 border-dashed border-line hover:border-brand rounded-2xl p-12 text-center transition flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-brand-tint text-brand rounded-2xl">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-heading">
              {lang === 'ml'
                ? 'പ്രതിദിന ലോഗ്ബുക്ക് എക്സൽ ഫയൽ അപ്‌ലോഡ് ചെയ്യുക'
                : 'Upload Daily Trip Logbook (.xlsx or .xls)'}
            </h3>
            <p className="text-xs text-ink-soft">
              {lang === 'ml'
                ? 'ഏതൊരു ലോഗ്ബുക്കും ഡ്രാഗ് ആൻഡ് ഡ്രോപ്പ് ചെയ്യുക.'
                : 'Supports any layout: VTL monthly log, school trip sheets, or custom formats.'}
            </p>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold shadow-xs transition">
            <Upload className="w-4 h-4" />
            <span>{isProcessing ? 'Processing Workbook...' : 'Choose Excel File'}</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      ) : (
        /* Review, Mapping & Commit Container */
        <div className="space-y-6">
          {/* Sheet Selector Bar */}
          <div className="bg-card p-4 rounded-xl border border-line shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-brand" />
              <div>
                <span className="text-xs font-bold font-mono">{fileName}</span>
                <span className="text-[10px] text-ink-soft block">
                  {sheetNames.length} sheet(s) detected in workbook
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSheetChange(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeSheetName === name
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-paper hover:bg-line/60 text-ink'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Column Mapping Screen & Reusable Profile */}
          <div className="bg-card rounded-2xl border border-line shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-bold font-heading flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  <span>
                    {lang === 'ml'
                      ? 'കോളങ്ങൾ മാപ്പ് ചെയ്യുക & പ്രൊഫൈൽ സൂക്ഷിക്കുക'
                      : 'Interactive Column Mapping & Import Profile'}
                  </span>
                </h3>
                <p className="text-[11px] text-ink-soft mt-0.5">
                  {lang === 'ml'
                    ? `${activeCustomer?.name || 'Customer'} എന്നതിനായുള്ള കോളം പൊരുത്തപ്പെടുത്തൽ.`
                    : `Map spreadsheet columns to system fields for ${activeCustomer?.name || 'Customer'}. Saved profiles persist across months.`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const auto = autoDetectColumnMapping(sheetHeaders);
                    setColumnMapping(auto);
                    if (rawWorkbook && activeSheetName && rawWorkbook.Sheets[activeSheetName]) {
                      const res = parseWorksheetWithMapping(rawWorkbook.Sheets[activeSheetName], auto);
                      setParsedEntries(res.entries);
                      setValidationErrors(res.validationErrors);
                    }
                  }}
                  className="px-3 py-1.5 bg-paper hover:bg-line/60 border border-line text-ink rounded-lg text-xs font-semibold transition"
                >
                  Smart Auto-Detect
                </button>

                <button
                  onClick={handleSaveProfile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{profileSavedToast ? 'Profile Saved!' : 'Save Customer Profile'}</span>
                </button>
              </div>
            </div>

            {/* Field Mapping Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { key: 'dateCol', label: 'Trip Date *', required: true },
                { key: 'startKmCol', label: 'Start / Opening KM *', required: true },
                { key: 'closeKmCol', label: 'Close / Closing KM *', required: true },
                { key: 'usedKmCol', label: 'Total / Used KM' },
                { key: 'startTimeCol', label: 'Start / Reporting Time' },
                { key: 'closeTimeCol', label: 'Close / Relieving Time' },
                { key: 'driverCol', label: 'Driver Name' },
                { key: 'vehicleCol', label: 'Vehicle Number' },
                { key: 'nightBataCol', label: 'Night Bata / Halt' },
                { key: 'outstationBataCol', label: 'Outstation Bata' },
                { key: 'tollCol', label: 'Toll / Parking' },
                { key: 'remarksCol', label: 'Remarks / Notes' },
              ].map((f) => (
                <div key={f.key} className="bg-paper p-2.5 rounded-xl border border-line">
                  <span className="text-[10px] font-bold text-ink-soft uppercase block mb-1">
                    {f.label}
                  </span>
                  <select
                    value={columnMapping[f.key as keyof ImportColumnMapping] || ''}
                    onChange={(e) =>
                      handleMappingChange(f.key as keyof ImportColumnMapping, e.target.value)
                    }
                    className="w-full text-xs bg-card border border-line rounded-lg p-1.5 text-ink focus:outline-none focus:border-brand font-medium"
                  >
                    <option value="">-- Not Mapped --</option>
                    {sheetHeaders.map((hdr) => (
                      <option key={hdr} value={hdr}>
                        {hdr}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Validation & Error List Banner */}
          {validationErrors.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {lang === 'ml'
                      ? `പരിശോധനാ മുന്നറിയിപ്പുകൾ (${validationErrors.length})`
                      : `Pre-Commit Validation Warnings & Errors (${validationErrors.length})`}
                  </h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {lang === 'ml'
                      ? 'തെറ്റായ സമയങ്ങൾ, ഓഡോമീറ്റർ വ്യത്യാസങ്ങൾ, ഡ്യൂപ്ലിക്കേറ്റുകൾ എന്നിവ കണ്ടെത്തി.'
                      : 'Detected bad HH.MM time components, odometer km gaps, or duplicate entries. Review before committing.'}
                  </p>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-amber-200/60 bg-white rounded-xl border border-amber-200 text-xs font-mono">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="p-2.5 flex items-start gap-2.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                        err.severity === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {err.type.replace('_', ' ')}
                    </span>
                    <div>
                      <span className="font-bold text-ink">
                        Row {err.row} • {err.field}:
                      </span>
                      <span className="text-ink-soft ml-1.5">{err.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Ledger Grid Preview */}
          <div className="bg-card rounded-2xl border border-line shadow-xs overflow-hidden">
            <div className="p-4 bg-paper border-b border-line flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <span>{lang === 'ml' ? 'ട്രിപ്പ് ലോഗ് പ്രിവ്യൂ' : 'Parsed Trip Ledger Preview'}</span>
                <span className="text-[10px] bg-brand-tint text-brand px-2 py-0.5 rounded-full font-bold">
                  {parsedEntries.length} trips
                </span>
              </h3>

              <button
                onClick={handleExportCleanExcel}
                className="px-3 py-1.5 border border-line rounded-lg text-xs font-semibold text-ink hover:bg-card transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-ink-soft" />
                <span>Export Cleaned .XLSX</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-paper text-ink-soft font-semibold uppercase text-[10px] tracking-wider sticky top-0 border-b border-line">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Vehicle</th>
                    <th className="px-3 py-2.5">Driver</th>
                    <th className="px-3 py-2.5 text-right">Start KM</th>
                    <th className="px-3 py-2.5 text-right">Close KM</th>
                    <th className="px-3 py-2.5 text-right">Used KM</th>
                    <th className="px-3 py-2.5 text-center">Hours</th>
                    <th className="px-3 py-2.5 text-center">Night Bata</th>
                    <th className="px-3 py-2.5 text-center">Outstation</th>
                    <th className="px-3 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {parsedEntries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-paper/80 transition font-mono">
                      <td className="px-3 py-2 text-ink font-bold">{entry.date}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            entry.dayStatus === 'RUN'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-paper text-ink-soft'
                          }`}
                        >
                          {entry.dayStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink">{entry.vehiclePlate || '-'}</td>
                      <td className="px-3 py-2 text-ink">{entry.driverName || '-'}</td>
                      <td className="px-3 py-2 text-right">{entry.startKm ?? '-'}</td>
                      <td className="px-3 py-2 text-right">{entry.closeKm ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-bold text-ink">{entry.usedKm ?? 0}</td>
                      <td className="px-3 py-2 text-center text-ink-soft">
                        {entry.startTime && entry.closeTime
                          ? `${entry.startTime} - ${entry.closeTime}`
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {entry.nightBata ? (
                          <span className="text-emerald-700 font-bold">✓</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {entry.outstationBata ? (
                          <span className="text-amber-700 font-bold">✓</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-soft font-sans truncate max-w-xs">
                        {entry.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Commit Action Bar */}
          <div className="bg-card p-4 rounded-2xl border border-line shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-ink block">
                {lang === 'ml'
                  ? `${parsedEntries.length} ട്രിപ്പുകൾ ലെഡ്ജറിലേക്ക് മാറ്റാൻ തയാറാണ്`
                  : `Ready to Commit ${parsedEntries.length} Trips to Daily Ledger`}
              </span>
              <span className="text-[11px] text-ink-soft">
                Target Contract: {activeContract?.agreementNo || 'Selected Agreement'} &bull; Month: {selectedMonth}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCommitToLedger}
                disabled={saveSuccess || parsedEntries.length === 0}
                className="px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {saveSuccess
                    ? lang === 'ml'
                      ? 'ലെഡ്ജറിൽ രേഖപ്പെടുത്തി!'
                      : 'Saved to Ledger!'
                    : lang === 'ml'
                    ? 'ലെഡ്ജറിലേക്ക് സമർപ്പിക്കുക'
                    : 'Commit to Trip Ledger'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
