import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  Info,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

export interface GoLiveChecklistProps {
  onNavigateTab: (
    tab:
      | 'modules'
      | 'suppliers'
      | 'rules'
      | 'lists'
      | 'users'
      | 'series'
      | 'taxes'
      | 'catalogue'
      | 'tariffs'
      | 'fuel'
      | 'compliance'
      | 'templates'
      | 'financial'
  ) => void;
}

interface ChecklistItem {
  id: string;
  category: string;
  categoryMalayalam: string;
  title: string;
  titleMalayalam: string;
  description: string;
  descriptionMalayalam: string;
  targetTab:
    | 'suppliers'
    | 'series'
    | 'taxes'
    | 'templates'
    | 'rules'
    | 'users'
    | 'compliance';
  requiredInputs: string[];
  ownerPrompt: string;
  isCompleted: boolean;
}

const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'invoice_series',
    category: '1. Invoice Number Sequences',
    categoryMalayalam: '1. ഇൻവോയ്സ് നമ്പറുകൾ',
    title: 'Starting Invoice Numbers (Previous Paper Bill Continuation)',
    titleMalayalam: 'തുടങ്ങുന്ന ഇൻവോയ്സ് നമ്പറുകൾ (മുൻ ബില്ലുകളുടെ തുടർച്ച)',
    description:
      'Current system is seeded with TEST series (TEST-SC-0001 & TEST-CTT-0001). Provide the last invoice number issued from your paper books so billing continues without gaps or duplicates.',
    descriptionMalayalam:
      'ഇപ്പോൾ ടെസ്റ്റ് സീരീസിലാണ്. നിങ്ങളുടെ മുൻ പേപ്പർ ബില്ലിലെ അവസാന നമ്പർ നൽകി ഇവിടെ തുടർച്ച ഉറപ്പാക്കുക.',
    targetTab: 'series',
    requiredInputs: [
      'StarCiti Group: Last issued invoice number (e.g., SC/26-27/0142)',
      'M/S City Tours & Travels: Last issued invoice number (e.g., CTT/26-27/0089)',
      'Confirm Financial Year suffix or format (e.g. 2026-27)',
    ],
    ownerPrompt: 'Owner input needed: What were your last invoice numbers for StarCiti Group and City Tours & Travels?',
    isCompleted: false,
  },
  {
    id: 'bank_and_upi',
    category: '2. Banking & Payment QR Codes',
    categoryMalayalam: '2. ബാങ്ക് അക്കൗണ്ട് & യുപിഐ വിവരങ്ങൾ',
    title: 'Bank Accounts, IFSC & Dynamic UPI QR Details',
    titleMalayalam: 'ബാങ്ക് അക്കൗണ്ട്, IFSC & UPI വിവരങ്ങൾ',
    description:
      'Invoices generate bank transfer details and dynamic UPI QR codes. Provide operational bank accounts and UPI IDs (VPA) for both entities.',
    descriptionMalayalam:
      'ഇൻവോയ്സിൽ വരുന്ന ബാങ്ക് അക്കൗണ്ട്, IFSC കോഡ്, ക്യുആർ കോഡിനായുള്ള യുപിഐ ഐഡി എന്നിവ നൽകുക.',
    targetTab: 'suppliers',
    requiredInputs: [
      'StarCiti Group: Bank Name, Account No, IFSC, Branch Name',
      'M/S City Tours & Travels: Bank Name, Account No, IFSC, Branch Name',
      'UPI ID / VPA for instant customer invoice scanning (e.g. starciti@sbi or mobile@upi)',
    ],
    ownerPrompt: 'Owner input needed: Bank Account No, IFSC and UPI ID for both business entities.',
    isCompleted: false,
  },
  {
    id: 'gst_and_taxes',
    category: '3. GST & Tax Configurations',
    categoryMalayalam: '3. ജിഎസ്ടി & ടാക്സ് വിവരങ്ങൾ',
    title: 'GSTIN Registration Numbers & CA Tax Rate Advice',
    titleMalayalam: 'ജിഎസ്ടി നമ്പറുകൾ & ടാക്സ് നിരക്കുകൾ',
    description:
      'System defaults to "No tax" with "Confirm with your CA". Verify GST registration numbers and whether 5% without ITC or 12% with ITC applies to your contracts.',
    descriptionMalayalam:
      'ജിഎസ്ടി നമ്പറുകൾ നൽകുക. 5% അല്ലെങ്കിൽ 12% ടാക്സ് നിരക്ക് നിങ്ങളുടെ ചാർട്ടേഡ് അക്കൗണ്ടന്റുമായി സ്ഥിരീകരിക്കുക.',
    targetTab: 'taxes',
    requiredInputs: [
      'GSTIN for StarCiti Group (or mark as Unregistered / Nil GST)',
      'GSTIN for M/S City Tours & Travels (e.g., 32AAAAA0000A1Z5)',
      'Confirm with CA: Passenger transport GST rate (5% without ITC vs 12% with ITC)',
      'Confirm TDS deduction rate under Section 194C (1% individual / 2% company)',
    ],
    ownerPrompt: 'Owner input needed: GSTIN for operating entities and CA-confirmed GST / TDS rates.',
    isCompleted: false,
  },
  {
    id: 'logos_and_signatures',
    category: '4. Letterheads, Logos & Signatures',
    categoryMalayalam: '4. ലെറ്റർഹെഡ്, ലോഗോ & ഒപ്പ്',
    title: 'Official Company Logos & Authorized Signatory Image',
    titleMalayalam: 'കമ്പനി ലോഗോകളും ഔദ്യോഗിക ഒപ്പുകളും',
    description:
      'Upload high-resolution logos (PNG/SVG, 400x120px) and optional digital signature/seal for automatic placement on invoice headers and driver duty slips.',
    descriptionMalayalam:
      'ഇൻവോയ്സിലും ലോഗ്ബുക്കിലും പ്രിന്റ് ചെയ്യേണ്ട ലോഗോകളും അംഗീകൃത ഒപ്പും നൽകുക.',
    targetTab: 'suppliers',
    requiredInputs: [
      'StarCiti Group letterhead logo (PNG/SVG format)',
      'M/S City Tours & Travels letterhead logo (PNG/SVG format)',
      'Digital signature / stamp of Authorized Signatory (optional)',
      'Official registered office address and contact phone numbers',
    ],
    ownerPrompt: 'Owner input needed: High-res logo images for PDF letterheads.',
    isCompleted: false,
  },
  {
    id: 'terms_and_jurisdiction',
    category: '5. Terms, Conditions & Jurisdiction',
    categoryMalayalam: '5. നിബന്ധനകളും വ്യവസ്ഥകളും',
    title: 'Invoice Payment Terms & Legal Jurisdiction Text',
    titleMalayalam: 'പേയ്‌മെന്റ് നിബന്ധനകളും കോടതി അധികാരപരിധിയും',
    description:
      'Customise invoice footer clauses: payment due days (e.g. 15 or 30 days), interest rate on overdue payments, and city jurisdiction.',
    descriptionMalayalam:
      'ബിൽ അടയ്ക്കാനുള്ള ദിവസങ്ങൾ, വൈകിയാലുള്ള പലിശ, കോടതി അധികാരപരിധി (Jurisdiction) എന്നിവ നൽകുക.',
    targetTab: 'templates',
    requiredInputs: [
      'Payment credit period (e.g. "Payment due within 15 days of bill submission")',
      'Interest on overdue bills clause (e.g. "Interest @ 18% p.a. applicable after due date")',
      'Legal dispute jurisdiction (e.g. "Subject to Thiruvananthapuram jurisdiction only")',
      'Logbook verification statement for monthly corporate contracts',
    ],
    ownerPrompt: 'Owner input needed: Standard payment terms and jurisdiction text for your invoices.',
    isCompleted: false,
  },
  {
    id: 'driver_contacts',
    category: '6. Driver Verification & Phone Logins',
    categoryMalayalam: '6. ഡ്രൈവർമാരുടെ ഫോൺ നമ്പറുകൾ',
    title: 'Driver WhatsApp Mobile Numbers & Phone PWA Access',
    titleMalayalam: 'ഡ്രൈവർമാരുടെ വാട്സാപ്പ് നമ്പറുകളും മൊബൈൽ ലോഗിനും',
    description:
      'Verify real 10-digit mobile phone numbers for all active drivers (Hemanth, Muhammad Fayaz, Asheerkhan, Afzal) for WhatsApp duty slip dispatch and mobile PWA logins.',
    descriptionMalayalam:
      'ഡ്രൈവർമാർക്ക് വാട്സാപ്പിൽ ഡ്യൂട്ടി സ്ലിപ്പുകൾ അയക്കാനും ഫോണിൽ ലോഗിൻ ചെയ്യാനുമുള്ള മൊബൈൽ നമ്പറുകൾ നൽകുക.',
    targetTab: 'users',
    requiredInputs: [
      'Hemanth Kumar: Verified 10-digit mobile number',
      'Muhammad Fayaz.s: Verified 10-digit mobile number',
      'Asheerkhan: Verified 10-digit mobile number',
      'Afzal: Verified 10-digit mobile number',
    ],
    ownerPrompt: 'Owner input needed: Verified mobile numbers for active drivers.',
    isCompleted: false,
  },
  {
    id: 'remote_domain_tunnel',
    category: '7. Domain & Cloudflare Remote Access',
    categoryMalayalam: '7. ഡൊമെയ്ൻ & റിമോട്ട് കണക്ഷൻ',
    title: 'Cloudflare Tunnel Token & Custom Domain Name',
    titleMalayalam: 'ക്ലൗഡ്ഫ്ലെയർ ടണൽ ടോക്കണും സ്വന്തം ഡൊമെയ്നും',
    description:
      'For remote access from driver phones and customer portals without opening router ports, provide your Cloudflare Tunnel Token and domain (e.g. desk.starciti.in).',
    descriptionMalayalam:
      'പുറത്തുനിന്നും ഫോണിൽ നിന്നും സുരക്ഷിതമായി ആക്സസ് ചെയ്യാനുള്ള സ്വന്തം ഡൊമെയ്നും ക്ലൗഡ്ഫ്ലെയർ ടണൽ ടോക്കണും നൽകുക.',
    targetTab: 'rules',
    requiredInputs: [
      'Domain Name (e.g. desk.starcititravels.com or owner-chosen domain)',
      'Cloudflare Zero Trust Tunnel Token (TUNNEL_TOKEN)',
      'SSL/TLS Strict Mode enabled in Cloudflare Dashboard',
    ],
    ownerPrompt: 'Owner input needed: Domain name and Cloudflare Tunnel token for 24/7 HTTPS access.',
    isCompleted: false,
  },
];

const STORAGE_KEY = 'starciti_golive_checklist_state';

export const GoLiveChecklist: React.FC<GoLiveChecklistProps> = ({ onNavigateTab }) => {
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_CHECKLIST_ITEMS.map((item) => ({
          ...item,
          isCompleted: !!parsed[item.id],
        }));
      }
    } catch (e) {
      // Fallback
    }
    return DEFAULT_CHECKLIST_ITEMS;
  });

  const [language, setLanguage] = useState<'en' | 'ml'>('en');

  // Persist state changes
  useEffect(() => {
    try {
      const stateObj = items.reduce<Record<string, boolean>>((acc, item) => {
        acc[item.id] = item.isCompleted;
        return acc;
      }, {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateObj));
    } catch (e) {
      // Ignore
    }
  }, [items]);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isCompleted: !item.isCompleted } : item))
    );
  };

  const handleReset = () => {
    if (confirm('Reset all checklist items to pending state?')) {
      setItems(DEFAULT_CHECKLIST_ITEMS);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const completedCount = items.filter((i) => i.isCompleted).length;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="space-y-6" data-testid="golive-checklist-container">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-amber-500/10 via-brand-tint/30 to-emerald-500/10 border border-amber-300/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500 text-white rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-heading font-bold text-lg text-ink">
                {language === 'en' ? 'Go-Live Preparation Checklist' : 'ഗോ-ലൈവ് തയ്യാറെടുപ്പ് ചെക്ക്‌ലിസ്റ്റ്'}
              </h3>
              <p className="text-xs text-ink-soft mt-0.5">
                {language === 'en'
                  ? 'Missing-input review: Settings and values required from the owner before switching from TEST series to live production.'
                  : 'ടെസ്റ്റ് സീരീസിൽ നിന്നും ലൈവ് പ്രൊഡക്ഷനിലേക്ക് മാറുന്നതിന് മുൻപായി ഉടമ നൽകേണ്ട വിവരങ്ങൾ.'}
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Language toggle & Reset */}
        <div className="flex items-center gap-3 self-end md:self-center">
          <div className="inline-flex rounded-lg border border-line p-0.5 bg-paper text-xs font-semibold">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                language === 'en' ? 'bg-white text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('ml')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                language === 'ml' ? 'bg-white text-emerald-800 shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              മലയാളം
            </button>
          </div>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg border border-line bg-paper text-ink-soft hover:text-ink hover:bg-white text-xs inline-flex items-center gap-1"
            title="Reset checklist progress"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="bg-card border border-line rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand" />
            <span className="text-xs font-semibold text-ink uppercase tracking-wider">
              {language === 'en' ? 'Owner Input Completion Status' : 'വിവരങ്ങൾ നൽകിയതിന്റെ പുരോഗതി'}
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-brand">
            {completedCount} / {totalCount} {language === 'en' ? 'Categories Ready' : 'വിഭാഗങ്ങൾ പൂർത്തിയായി'} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-paper rounded-full h-2.5 overflow-hidden border border-line/60">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              progressPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressPercent < 100 ? (
          <p className="text-[11px] text-amber-800 mt-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>
              {language === 'en'
                ? `${totalCount - completedCount} categories still require confirmed values from the owner. You can safely pilot with TEST series until these are provided.`
                : `${totalCount - completedCount} കാര്യങ്ങൾ കൂടി ഉടമസ്ഥൻ നൽകാനുണ്ട്. ഇവ നൽകുന്നതുവരെ ടെസ്റ്റ് സീരീസിൽ പ്രവർത്തനം തുടരാം.`}
            </span>
          </p>
        ) : (
          <p className="text-[11px] text-emerald-800 mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>
              {language === 'en'
                ? 'All owner inputs and configurations have been verified! System is 100% prepared for live production.'
                : 'എല്ലാ വിവരങ്ങളും പരിശോധിച്ചുറപ്പിച്ചു! സിസ്റ്റം പൂർണ്ണമായും ലൈവ് പ്രൊഡക്ഷന് സജ്ജമാണ്.'}
            </span>
          </p>
        )}
      </div>

      {/* Checklist Cards List */}
      <div className="space-y-4">
        {items.map((item) => {
          const isDone = item.isCompleted;

          return (
            <div
              key={item.id}
              data-testid={`golive-item-${item.id}`}
              className={`bg-card border rounded-xl p-5 transition-all shadow-xs ${
                isDone
                  ? 'border-emerald-300/80 bg-emerald-50/15'
                  : 'border-amber-300/70 bg-card hover:border-amber-400'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {/* Completion Toggle Checkbox */}
                  <button
                    onClick={() => toggleItem(item.id)}
                    aria-label={`Mark ${item.title} as ${isDone ? 'pending' : 'completed'}`}
                    className={`mt-0.5 p-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'border-amber-300 bg-white hover:border-amber-500 text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 fill-current" />
                  </button>

                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-paper border border-line text-ink-soft">
                        {language === 'en' ? item.category : item.categoryMalayalam}
                      </span>
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {language === 'en' ? 'Verified & Ready' : 'പരിശോധിച്ചുറപ്പിച്ചു'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-700" />
                          {language === 'en' ? 'Pending Owner Input' : 'ഉടമയുടെ വിവരം കാത്തിരിക്കുന്നു'}
                        </span>
                      )}
                    </div>

                    <h4 className="font-heading font-bold text-sm text-ink">
                      {language === 'en' ? item.title : item.titleMalayalam}
                    </h4>

                    <p className="text-xs text-ink-soft leading-relaxed">
                      {language === 'en' ? item.description : item.descriptionMalayalam}
                    </p>

                    {/* Specific Input Points Required */}
                    <div className="mt-3 p-3 bg-paper/60 border border-line/70 rounded-lg space-y-1.5">
                      <div className="text-[11px] font-semibold text-ink flex items-center gap-1">
                        <Info className="w-3 h-3 text-brand" />
                        <span>{language === 'en' ? 'Required Owner Inputs:' : 'ആവശ്യമായ വിവരങ്ങൾ:'}</span>
                      </div>
                      <ul className="text-xs text-ink-soft space-y-1 pl-4 list-disc marker:text-amber-500">
                        {item.requiredInputs.map((input, idx) => (
                          <li key={idx} className="leading-snug">
                            {input}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Owner Prompt Banner */}
                    <div className="text-[11px] font-mono text-amber-900 bg-amber-50/80 border border-amber-200/60 p-2 rounded-md">
                      👉 {item.ownerPrompt}
                    </div>
                  </div>
                </div>

                {/* Jump to Relevant Setting Tab Button */}
                <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-line/60">
                  <button
                    onClick={() => onNavigateTab(item.targetTab)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-line text-ink hover:border-brand hover:text-brand shadow-xs transition-all cursor-pointer group"
                    title={`Open ${item.targetTab} configuration`}
                  >
                    <span>{language === 'en' ? 'Go to Setting' : 'സെറ്റിംഗ്സിലേക്ക് പോകുക'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-ink-soft group-hover:text-brand group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    onClick={() => toggleItem(item.id)}
                    className="text-[11px] text-ink-soft hover:text-ink underline cursor-pointer"
                  >
                    {isDone
                      ? (language === 'en' ? 'Mark as Pending' : 'പെൻഡിംഗ് ആക്കുക')
                      : (language === 'en' ? 'Mark as Verified' : 'പൂർത്തിയായതായി രേഖപ്പെടുത്തുക')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
