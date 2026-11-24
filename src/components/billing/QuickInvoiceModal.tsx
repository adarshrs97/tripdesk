import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Package,
  AlertCircle,
  CheckCircle2,
  Send,
  Building,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSuppliers } from '../../context/SupplierContext';
import { Customer, MastersService } from '../../services/mastersService';
import { TaxProfile } from '../../types/tax';
import { CatalogueItem, AdHocLineItem, ItemUnit } from '../../types/catalogue';
import { TaxService } from '../../services/taxService';
import { CatalogueService } from '../../services/catalogueService';
import { InvoiceService } from '../../services/invoiceService';
import { inrWords } from '../../engine';

interface QuickInvoiceModalProps {
  onClose: () => void;
  onInvoiceCreated?: (invoiceId: string) => void;
}

export type InvoiceType =
  | 'tax_invoice'
  | 'bill_of_supply'
  | 'proforma'
  | 'trip_sheet'
  | 'agent_plain'
  | 'credit_note'
  | 'debit_note'
  | 'receipt_voucher'
  | 'quotation';

export const QuickInvoiceModal: React.FC<QuickInvoiceModalProps> = ({
  onClose,
  onInvoiceCreated,
}) => {
  const { currentUser } = useAuth();
  const { suppliers, activeSupplier } = useSuppliers();

  // Master options
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([]);
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>([]);

  // Invoice Header Fields
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('tax_invoice');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(activeSupplier.id);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustPan, setNewCustPan] = useState('');

  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dueTermsDays, setDueTermsDays] = useState<number>(30);
  const [notes, setNotes] = useState('');

  // Free-form Line Items
  const [lineItems, setLineItems] = useState<AdHocLineItem[]>([
    {
      id: 'line-1',
      description: 'Airport Transfer (Trivandrum TRV)',
      quantity: 1,
      unit: 'trip',
      rate: 1200,
      discountAmount: 0,
      discountType: 'flat',
      taxProfileId: '',
      sacHsn: '996601',
      lineTotal: 1200,
      taxAmount: 0,
      netTotal: 1200,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load masters
  useEffect(() => {
    async function init() {
      const [custList, taxes, cat] = await Promise.all([
        MastersService.getCustomers(),
        TaxService.getTaxProfiles(),
        CatalogueService.getItems(),
      ]);
      setCustomers(custList);
      setTaxProfiles(taxes);
      setCatalogueItems(cat);

      if (custList.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custList[0].id);
      }
    }
    init();
  }, []);

  // Update a line item and recalculate
  const updateLineItem = (index: number, updates: Partial<AdHocLineItem>) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], ...updates };

      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const gross = qty * rate;

      let discount = Number(item.discountAmount) || 0;
      if (item.discountType === 'percent') {
        discount = Math.round((gross * (discount / 100)) * 100) / 100;
      }
      const taxable = Math.max(0, gross - discount);

      // Tax calculation
      const profile = taxProfiles.find((t) => t.id === item.taxProfileId);
      let tax = 0;
      if (profile && profile.ratePercent > 0) {
        tax = Math.round(taxable * (profile.ratePercent / 100) * 100) / 100;
      }

      item.lineTotal = taxable;
      item.taxAmount = tax;
      item.netTotal = taxable + tax;

      updated[index] = item;
      return updated;
    });
  };

  const addBlankLine = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        description: '',
        quantity: 1,
        unit: 'trip',
        rate: 0,
        discountAmount: 0,
        discountType: 'flat',
        taxProfileId: taxProfiles[0]?.id || '',
        sacHsn: '996601',
        lineTotal: 0,
        taxAmount: 0,
        netTotal: 0,
      },
    ]);
  };

  const addFromCatalogue = (catItem: CatalogueItem) => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        description: catItem.name,
        quantity: 1,
        unit: catItem.defaultUnit,
        rate: catItem.defaultRate,
        discountAmount: 0,
        discountType: 'flat',
        taxProfileId: catItem.taxProfileId || '',
        sacHsn: catItem.sacHsn || '996601',
        lineTotal: catItem.defaultRate,
        taxAmount: 0,
        netTotal: catItem.defaultRate,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Grand totals
  const subtotal = lineItems.reduce((acc, l) => acc + (l.quantity * l.rate), 0);
  const totalDiscount = lineItems.reduce((acc, l) => {
    const gross = l.quantity * l.rate;
    const disc = l.discountType === 'percent' ? (gross * (l.discountAmount / 100)) : l.discountAmount;
    return acc + disc;
  }, 0);
  const taxableTotal = lineItems.reduce((acc, l) => acc + l.lineTotal, 0);
  const totalTax = lineItems.reduce((acc, l) => acc + l.taxAmount, 0);
  const grandTotal = Math.round(taxableTotal + totalTax);

  const handleIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0 || grandTotal <= 0) {
      setStatusMsg({ type: 'error', text: 'Invoice must contain at least one valid line item with an amount.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMsg(null);

      // 1. Resolve or create customer
      let customerId = selectedCustomerId;
      let customerObj: any = customers.find((c) => c.id === selectedCustomerId);

      if (isNewCustomer) {
        if (!newCustName.trim()) {
          throw new Error('Please provide customer name.');
        }
        const created = await MastersService.createCustomer({
          name: newCustName.trim(),
          phone: newCustPhone.trim() || null,
          email: newCustEmail.trim() || null,
          billingAddress: newCustAddress.trim() || 'Trivandrum, Kerala',
          gstin: newCustGstin.trim() || null,
          pan: newCustPan.trim() || null,
          customerType: 'individual',
          paymentTermsDays: dueTermsDays,
          defaultSupplierId: selectedSupplierId,
        });
        customerId = created.id;
        customerObj = created;
      }

      const supplierObj = suppliers.find((s) => s.id === selectedSupplierId) || activeSupplier;

      // 2. Build invoice snapshot
      const snapshotJson = {
        invoiceType,
        customer: {
          id: customerId,
          name: customerObj?.name || newCustName,
          phone: customerObj?.phone || newCustPhone,
          email: customerObj?.email || newCustEmail,
          billingAddress: customerObj?.billingAddress || newCustAddress,
          gstin: customerObj?.gstin || newCustGstin,
          pan: customerObj?.pan || newCustPan,
        },
        supplier: {
          id: supplierObj.id,
          legalName: supplierObj.legalName,
          tradeName: supplierObj.tradeName,
          address: supplierObj.address,
          gstin: supplierObj.gstin,
          pan: supplierObj.pan,
          phones: [(supplierObj as any).phone || (supplierObj as any).phones].flat().filter(Boolean),
        },
        items: lineItems.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          rate: l.rate,
          discount: l.discountAmount,
          taxAmount: l.taxAmount,
          netTotal: l.netTotal,
          sacHsn: l.sacHsn,
        })),
        totals: {
          subtotal,
          totalDiscount,
          taxableTotal,
          totalTax,
          grandTotal,
          inWords: inrWords(grandTotal),
        },
        notes: notes.trim(),
      };

      // 3. Issue invoice atomically through InvoiceService
      const issueRes = await InvoiceService.issueInvoice({
        supplierId: selectedSupplierId,
        customerId,
        periodFrom: issueDate,
        periodTo: issueDate,
        totalAmount: grandTotal,
        snapshotJson: snapshotJson as any,
        templateId: invoiceType === 'tax_invoice' ? 'format1_package_school' : 'format2_fixed_vtl_2026',
        templateVersion: 1,
        issuedBy: currentUser?.name || 'Admin',
        adminOverrideReason: `Ad-hoc ${invoiceType.toUpperCase()} issued for ${customerObj?.name || newCustName}`,
      });

      setStatusMsg({
        type: 'success',
        text: `Invoice #${issueRes.invoiceNumber} issued and locked successfully!`,
      });

      if (onInvoiceCreated) {
        onInvoiceCreated(issueRes.invoiceId);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to issue invoice.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 font-display text-base">
                Create Quick Invoice (Ad-hoc / Anyone)
              </h3>
              <p className="text-xs text-gray-500">
                Issue tax invoices, bills of supply, proformas or trip sheets for any person without a prior contract
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm font-semibold">
            ✕
          </button>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleIssueInvoice} className="space-y-4 text-xs">
          {/* Row 1: Invoice Type, Supplier, Date & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Invoice Type *</label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
              >
                <option value="tax_invoice">Tax Invoice (Standard GST)</option>
                <option value="bill_of_supply">Bill of Supply (Exempt)</option>
                <option value="proforma">Proforma Invoice</option>
                <option value="trip_sheet">Trip Sheet / Duty Slip</option>
                <option value="agent_plain">Agent Plain (No Letterhead)</option>
                <option value="quotation">Quotation / Estimate</option>
                <option value="receipt_voucher">Receipt Voucher</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Billing Entity *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tradeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Invoice Date *</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">Payment Due</label>
              <select
                value={dueTermsDays}
                onChange={(e) => setDueTermsDays(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
              >
                <option value={0}>Due Immediately on Receipt</option>
                <option value={15}>Net 15 Days</option>
                <option value={30}>Net 30 Days</option>
                <option value={45}>Net 45 Days</option>
              </select>
            </div>
          </div>

          {/* Row 2: Customer Selection or Inline Creation */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-gray-500" />
                Customer / Billed To
              </span>
              <button
                type="button"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
                className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 text-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isNewCustomer ? 'Select Existing Customer' : '+ Add New Customer Inline'}</span>
              </button>
            </div>

            {!isNewCustomer ? (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} — {c.billingAddress}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Name / Company *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe / Tata Consultancy"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 9846012345"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-gray-700 font-semibold mb-1">Billing Address</label>
                  <input
                    type="text"
                    placeholder="Address, City, Kerala"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="32AAAAA0000A1Z5"
                    value={newCustGstin}
                    onChange={(e) => setNewCustGstin(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-white uppercase"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">PAN (Optional)</label>
                  <input
                    type="text"
                    placeholder="AAAAA1234A"
                    value={newCustPan}
                    onChange={(e) => setNewCustPan(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-white uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Quick Add from Catalogue */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-gray-500 font-semibold flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-emerald-700" />
              Quick Pick Service:
            </span>
            {catalogueItems.slice(0, 5).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => addFromCatalogue(cat)}
                className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 border border-gray-200 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              >
                + {cat.name} (₹{cat.defaultRate})
              </button>
            ))}
          </div>

          {/* Line Items Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100/80 border-b border-gray-200 text-gray-700 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                  <th className="py-2.5 px-2 w-20">Unit</th>
                  <th className="py-2.5 px-2 w-24 text-right">Rate (₹)</th>
                  <th className="py-2.5 px-2 w-24 text-right">Discount</th>
                  <th className="py-2.5 px-2 w-32">Tax Profile</th>
                  <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        required
                        placeholder="Service / package description..."
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        required
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs text-center font-mono"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={item.unit}
                        onChange={(e) => updateLineItem(idx, { unit: e.target.value as ItemUnit })}
                        className="w-full border border-gray-300 rounded px-1 py-1 text-xs bg-white"
                      >
                        <option value="trip">Trip</option>
                        <option value="km">km</option>
                        <option value="hr">hr</option>
                        <option value="day">Day</option>
                        <option value="month">Month</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={item.rate}
                        onChange={(e) => updateLineItem(idx, { rate: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs text-right font-mono font-semibold"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={item.discountAmount}
                        onChange={(e) => updateLineItem(idx, { discountAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs text-right font-mono"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={item.taxProfileId}
                        onChange={(e) => updateLineItem(idx, { taxProfileId: e.target.value })}
                        className="w-full border border-gray-300 rounded px-1 py-1 text-xs bg-white truncate"
                      >
                        <option value="">No Tax (0%)</option>
                        {taxProfiles.map((tp) => (
                          <option key={tp.id} value={tp.id}>
                            {tp.name} ({tp.ratePercent}%)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                      ₹{item.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="text-gray-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={addBlankLine}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Line</span>
            </button>

            {/* Totals Summary Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 w-72 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-mono">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono">-₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {totalTax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax (GST):</span>
                  <span className="font-mono">₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-gray-900 border-t border-gray-200 pt-1.5">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-800">
                  ₹{grandTotal.toLocaleString('en-IN')}/-
                </span>
              </div>
              <div className="text-[10px] text-gray-500 italic text-right truncate">
                {inrWords(grandTotal)}
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          <div>
            <label className="block text-gray-700 font-semibold mb-1 text-xs">Invoice Notes / Terms</label>
            <input
              type="text"
              placeholder="e.g. Thanks for your business! Payment due within 30 days."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end items-center gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Issuing & Locking...' : 'Issue & Lock Invoice'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

