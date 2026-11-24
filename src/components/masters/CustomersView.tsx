import React, { useState, useEffect } from 'react';
import { Customer, Contract, MastersService } from '../../services/mastersService';
import { FlagsService } from '../../services/flagsService';
import { InternalFlag } from '../../engine/flags';
import { EntityFlagBadge } from '../flags/EntityFlagBadge';
import { AddCustomerModal } from './AddCustomerModal';
import { AddContractModal } from './AddContractModal';
import {
  Building,
  AlertTriangle,
  Plus,
  FileText,
  Languages,
  CheckCircle2,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [allFlags, setAllFlags] = useState<InternalFlag[]>([]);
  const [lang, setLang] = useState<'en' | 'ml'>('en');

  // Modal States
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddContractOpen, setIsAddContractOpen] = useState(false);
  const [selectedCustomerIdForContract, setSelectedCustomerIdForContract] = useState<string | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    const [cList, ctList, fList] = await Promise.all([
      MastersService.getCustomers(),
      MastersService.getContracts(),
      FlagsService.getFlags({ isActive: true }),
    ]);
    setCustomers(cList);
    setContracts(ctList);
    setAllFlags(fList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCustomerAdded = (newCustomer: Customer) => {
    setCustomers((prev) => [...prev, newCustomer]);
    setToastMessage(
      lang === 'ml'
        ? `ഉപഭോക്താവ് "${newCustomer.name}" വിജയകരമായി ചേർത്തു.`
        : `Customer "${newCustomer.name}" registered successfully.`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleContractAdded = (newContract: Contract) => {
    setContracts((prev) => [...prev, newContract]);
    setToastMessage(
      lang === 'ml'
        ? `കരാർ #${newContract.agreementNo} വിജയകരമായി രജിസ്റ്റർ ചെയ്തു.`
        : `Contract #${newContract.agreementNo} registered with versioned terms.`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openAddContractForCustomer = (customerId: string) => {
    setSelectedCustomerIdForContract(customerId);
    setIsAddContractOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-card border border-line p-5 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <Building className="w-5 h-5 text-brand" />
            {lang === 'ml' ? 'ഉപഭോക്താക്കളും കരാറുകളും' : 'Customers & Institutional Contracts'}
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            {lang === 'ml'
              ? 'സ്ഥാപനപരമായ ഉപഭോക്താക്കൾ, വാർഷിക കരാറുകൾ, നിരക്ക് കാർഡുകൾ, ബില്ലിംഗ് മാതൃകകൾ.'
              : 'Institutional corporate, school, and long-term contracts. Each contract binds customer terms, rate cards, and billing formats.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Malayalam Toggle Button */}
          <button
            onClick={() => setLang(lang === 'en' ? 'ml' : 'en')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-paper border border-line hover:border-brand/40 text-ink transition-colors cursor-pointer"
            title="Toggle English / Malayalam"
          >
            <Languages className="w-3.5 h-3.5 text-brand" />
            <span>{lang === 'en' ? 'മലയാളം' : 'English'}</span>
          </button>

          <button
            onClick={() => {
              setSelectedCustomerIdForContract(undefined);
              setIsAddContractOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-paper border border-line hover:border-brand hover:text-brand text-ink transition-colors shadow-xs cursor-pointer"
          >
            <FileText className="w-4 h-4 text-brand" />
            <span>{lang === 'ml' ? '+ പുതിയ കരാർ' : '+ New Contract'}</span>
          </button>

          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ml' ? 'ഉപഭോക്താവിനെ ചേർക്കുക' : 'Add Customer'}</span>
          </button>
        </div>
      </div>

      {/* Customer & Contract Cards */}
      {customers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3">
          <Building className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-gray-900">
            {lang === 'ml' ? 'ഉപഭോക്താക്കൾ ചേർത്തിട്ടില്ല' : 'No Customers Added Yet'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {lang === 'ml'
              ? 'കരാറുകൾ നിർമ്മിക്കുന്നതിനും ഇൻവോയ്സുകൾ നൽകുന്നതിനും നിങ്ങളുടെ ഉപഭോക്താക്കളെ ചേർക്കുക.'
              : 'Add your corporate, institutional, or regular customers to create contracts and issue invoices.'}
          </p>
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ml' ? 'ആദ്യ ഉപഭോക്താവിനെ ചേർക്കുക' : 'Add Your First Customer'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {customers.map((cust) => {
            const custContracts = contracts.filter((c) => c.customerId === cust.id);
            const custFlags = allFlags.filter(
              (f) =>
                f.entityType === 'customer' &&
                (f.entityId === cust.id ||
                  f.entityId.toLowerCase() === cust.name.toLowerCase() ||
                  cust.name.toLowerCase().includes(f.entityId.toLowerCase()))
            );

            return (
              <div
                key={cust.id}
                className="bg-card border border-line rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-bold text-base text-ink">{cust.name}</h3>
                        <EntityFlagBadge flags={custFlags} compact />
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider bg-paper border border-line text-ink-soft">
                          {cust.customerType}
                        </span>
                      </div>
                      <p className="text-xs text-ink-soft mt-1">
                        {cust.billingAddress}, {cust.city}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-brand-tint text-brand">
                      {lang === 'ml' ? 'സജീവം' : 'Active Client'}
                    </span>
                  </div>

                  {/* Tax & Contact Block */}
                  <div className="mt-4 pt-3 border-t border-line/60 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-ink-soft">
                    <div>
                      <span className="text-ink-faint block">PAN:</span>
                      <span className="font-mono font-semibold text-ink">{cust.pan || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">GSTIN:</span>
                      <span className="font-mono font-semibold text-ink">
                        {cust.gstin || (lang === 'ml' ? 'രജിസ്റ്റർ ചെയ്തിട്ടില്ല' : 'Unregistered')}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-faint block">
                        {lang === 'ml' ? 'ബന്ധപ്പെടേണ്ട ആൾ:' : 'Contact:'}
                      </span>
                      <span className="font-medium text-ink">{cust.contactPerson || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Linked Contracts */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                        {lang === 'ml'
                          ? 'കരാറുകളും നിരക്ക് ഘടനയും'
                          : 'Linked Agreements & Pricing Models'}
                      </div>
                      <button
                        onClick={() => openAddContractForCustomer(cust.id)}
                        className="text-[11px] font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{lang === 'ml' ? 'കരാർ ചേർക്കുക' : 'Add Contract'}</span>
                      </button>
                    </div>

                    {custContracts.length === 0 ? (
                      <div className="p-3 bg-paper rounded-lg text-xs text-ink-faint italic flex items-center justify-between">
                        <span>
                          {lang === 'ml'
                            ? 'കരാറുകൾ രജിസ്റ്റർ ചെയ്തിട്ടില്ല.'
                            : 'No contracts registered yet.'}
                        </span>
                        <button
                          onClick={() => openAddContractForCustomer(cust.id)}
                          className="text-brand font-semibold hover:underline ml-2"
                        >
                          {lang === 'ml' ? '+ കരാർ ആരംഭിക്കുക' : '+ Add Agreement'}
                        </button>
                      </div>
                    ) : (
                      custContracts.map((c) => {
                        const isExpired = c.status === 'expired';

                        return (
                          <div
                            key={c.id}
                            className={`p-3.5 rounded-lg border text-xs space-y-2 transition-all ${
                              isExpired ? 'bg-amber-tint/30 border-amber/30' : 'bg-paper border-line'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-ink">
                                  Agr #{c.agreementNo}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-brand-tint text-brand">
                                  {c.invoiceFormat} ({c.contractKind.replace('_', ' ')})
                                </span>
                              </div>
                              {isExpired && (
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-tint text-red flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  EXPIRED
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-ink-soft flex items-center justify-between">
                              <span>
                                {lang === 'ml' ? 'കാലാവധി:' : 'Validity:'}{' '}
                                <strong>{c.validFrom}</strong> to <strong>{c.validTo}</strong>
                              </span>
                              <span className="font-mono text-brand font-semibold">
                                {c.pricingModel}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                  <span className="text-ink-faint">
                    {lang === 'ml' ? 'സ്ഥിരം ഫോർമാറ്റ്:' : 'Default Format:'}{' '}
                    <strong className="text-ink font-mono">{cust.defaultInvoiceFormat}</strong>
                  </span>
                  <button
                    onClick={() => openAddContractForCustomer(cust.id)}
                    className="text-brand font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{lang === 'ml' ? 'കരാർ ക്രമീകരിക്കുക' : 'Configure Contracts'}</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerAdded={handleCustomerAdded}
        lang={lang}
      />

      {/* Add Contract Modal */}
      <AddContractModal
        isOpen={isAddContractOpen}
        onClose={() => setIsAddContractOpen(false)}
        customers={customers}
        selectedCustomerId={selectedCustomerIdForContract}
        onContractAdded={handleContractAdded}
        lang={lang}
      />
    </div>
  );
};
