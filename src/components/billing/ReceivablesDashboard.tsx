import React, { useState } from 'react';
import {
  DollarSign,
  CheckCircle2,
  Ban,
  Search,
  Printer,
  MessageSquare,
} from 'lucide-react';
import { ReceivablesAgeingBucket } from '../../types';
import { PaymentModal } from './PaymentModal';
import { CreditDebitNoteModal } from './CreditDebitNoteModal';
import { WhatsAppReminderModal } from './WhatsAppReminderModal';
import { CustomerStatementModal } from './CustomerStatementModal';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface InvoiceRowItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  customerPan?: string | null;
  defaultTdsRate?: number | null;
  supplierName: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  totalPaid: number;
  totalTds: number;
  creditNotes: number;
  debitNotes: number;
  outstandingBalance: number;
  status: 'issued' | 'sent' | 'part_paid' | 'paid' | 'overdue' | 'cancelled' | 'locked';
  daysOverdue: number;
}

const SEED_INVOICES: InvoiceRowItem[] = [
  {
    id: 'inv-vtl-aug-2026',
    invoiceNumber: '108191',
    customerId: 'b0000000-0000-0000-0000-000000000001',
    customerName: 'M/s Vindhya Telelinks Limited',
    customerPhone: '+91 9846012345',
    customerPan: 'AAACV7757J',
    defaultTdsRate: 2.0,
    supplierName: 'M/S City Tours & Travels',
    issueDate: '2026-08-31',
    dueDate: '2026-09-30',
    totalAmount: 68662,
    totalPaid: 0,
    totalTds: 0,
    creditNotes: 0,
    debitNotes: 0,
    outstandingBalance: 68662,
    status: 'locked',
    daysOverdue: 0,
  },
  {
    id: 'inv-school-aug-2026',
    invoiceNumber: '106563',
    customerId: 'b0000000-0000-0000-0000-000000000002',
    customerName: 'Loyola School Trivandrum',
    customerPhone: '+91 9447012345',
    supplierName: 'StarCiti Group',
    issueDate: '2026-08-31',
    dueDate: '2026-09-15',
    totalAmount: 21210,
    totalPaid: 10000,
    totalTds: 0,
    creditNotes: 0,
    debitNotes: 0,
    outstandingBalance: 11210,
    status: 'part_paid',
    daysOverdue: 0,
  },
];

export const ReceivablesDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRowItem[]>(SEED_INVOICES);
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers'>('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<InvoiceRowItem | null>(null);
  const [selectedInvoiceForNote, setSelectedInvoiceForNote] = useState<InvoiceRowItem | null>(null);
  const [selectedInvoiceForReminder, setSelectedInvoiceForReminder] = useState<InvoiceRowItem | null>(null);
  const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<any | null>(null);

  // Cancellation modal
  const [cancelModalInvoice, setCancelModalInvoice] = useState<InvoiceRowItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  // Compute receivables ageing summary
  const totalOutstanding = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + i.outstandingBalance, 0);

  const ageingBuckets: ReceivablesAgeingBucket = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    totalOutstanding,
  };

  for (const inv of invoices) {
    if (inv.status === 'cancelled' || inv.outstandingBalance <= 0) continue;
    if (inv.daysOverdue <= 0) {
      ageingBuckets.current += inv.outstandingBalance;
    } else if (inv.daysOverdue <= 30) {
      ageingBuckets.days1to30 += inv.outstandingBalance;
    } else if (inv.daysOverdue <= 60) {
      ageingBuckets.days31to60 += inv.outstandingBalance;
    } else if (inv.daysOverdue <= 90) {
      ageingBuckets.days61to90 += inv.outstandingBalance;
    } else {
      ageingBuckets.days90plus += inv.outstandingBalance;
    }
  }

  // Handle invoice cancellation
  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalInvoice || !cancelReason.trim()) return;

    try {
      setIsCancelling(true);
      if (isSupabaseConfigured) {
        const { error } = await supabase.rpc('cancel_invoice', {
          p_invoice_id: cancelModalInvoice.id,
          p_reason: cancelReason.trim(),
          p_admin_user: currentUser?.name || 'Admin',
        });
        if (error) throw error;
      }

      setInvoices((prev) =>
        prev.map((i) =>
          i.id === cancelModalInvoice.id
            ? { ...i, status: 'cancelled', outstandingBalance: 0 }
            : i
        )
      );

      setCancelModalInvoice(null);
      setCancelReason('');
    } catch (err: any) {
      alert('Cancellation Error: ' + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: InvoiceRowItem['status'], daysOverdue: number) => {
    if (status === 'cancelled') {
      return (
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-gray-200">
          Cancelled (Kept in sequence)
        </span>
      );
    }
    if (status === 'paid') {
      return (
        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 flex items-center gap-1 w-max">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Fully Paid
        </span>
      );
    }
    if (status === 'part_paid') {
      return (
        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-blue-200">
          Part Paid
        </span>
      );
    }
    if (daysOverdue > 0 || status === 'overdue') {
      return (
        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200">
          Overdue ({daysOverdue}d)
        </span>
      );
    }
    return (
      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">
        Issued / Pending
      </span>
    );
  };

  const filteredInvoices = invoices.filter((i) => {
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'overdue'
        ? i.daysOverdue > 0
        : i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-display">Payments & Receivables Desk</h1>
            <p className="text-xs text-gray-500">
              Track customer collections, TDS deductions, credit/debit notes, and ageing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Total Outstanding:</span>
          <span className="text-lg font-bold font-mono text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
            ₹{totalOutstanding.toLocaleString('en-IN')}/-
          </span>
        </div>
      </div>

      {/* Receivables Ageing Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total Due</span>
          <div className="text-base font-bold font-mono text-gray-900 mt-1">
            ₹{ageingBuckets.totalOutstanding.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-gray-400">All uncollected</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Current</span>
          <div className="text-base font-bold font-mono text-emerald-800 mt-1">
            ₹{ageingBuckets.current.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">Within terms</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">1 - 30 Days</span>
          <div className="text-base font-bold font-mono text-amber-800 mt-1">
            ₹{ageingBuckets.days1to30.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-amber-600">Grace period</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 block">31 - 60 Days</span>
          <div className="text-base font-bold font-mono text-orange-800 mt-1">
            ₹{ageingBuckets.days31to60.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-orange-600">Follow up</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block">61 - 90 Days</span>
          <div className="text-base font-bold font-mono text-red-800 mt-1">
            ₹{ageingBuckets.days61to90.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-red-600">Action needed</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-300 shadow-sm bg-red-50/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 block">90+ Days</span>
          <div className="text-base font-bold font-mono text-red-900 mt-1">
            ₹{ageingBuckets.days90plus.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-red-700 font-bold">Escalation</span>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'invoices' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Invoices & Collections ({filteredInvoices.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'customers' ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Customer Outstanding Statements
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="part_paid">Part Paid</option>
            <option value="paid">Fully Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Main Table: Invoices */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-right">Billed</th>
                  <th className="py-3 px-4 text-right">Paid + TDS</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-gray-900">#{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-gray-400">{inv.supplierName}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">{inv.customerName}</div>
                      {inv.customerPhone && (
                        <div className="text-[11px] text-gray-500">{inv.customerPhone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-gray-600">
                      <div>Issued: <strong className="text-gray-700">{inv.issueDate}</strong></div>
                      <div>Due: <strong className="text-gray-700">{inv.dueDate}</strong></div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-900">
                      ₹{inv.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700">
                      ₹{(inv.totalPaid + inv.totalTds).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-red-700">
                      ₹{inv.outstandingBalance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(inv.status, inv.daysOverdue)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {inv.status !== 'cancelled' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.outstandingBalance > 0 && (
                            <button
                              onClick={() => setSelectedInvoiceForPayment(inv)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                              title="Record Payment & TDS"
                            >
                              Record Payment
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedInvoiceForNote(inv)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                            title="Issue Credit or Debit Note"
                          >
                            CN/DN
                          </button>
                          <button
                            onClick={() => setSelectedInvoiceForReminder(inv)}
                            className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-200 cursor-pointer"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setCancelModalInvoice(inv)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 cursor-pointer"
                              title="Cancel Invoice (Keeps number in sequence)"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">Retired sequence #</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customers Tab: Statements */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">M/s Vindhya Telelinks Limited</h3>
                  <p className="text-[11px] text-gray-500">Corporate Long-term Contract Car Client</p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  Active
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 border-t border-gray-200 pt-2">
                <span>Outstanding Balance:</span>
                <span className="font-mono font-bold text-red-700">₹68,662.00</span>
              </div>
              <button
                onClick={() =>
                  setSelectedCustomerForStatement({
                    id: 'b0000000-0000-0000-0000-000000000001',
                    name: 'M/s Vindhya Telelinks Limited',
                    phone: '+91 9846012345',
                    email: 'admin@vindhyatelelinks.com',
                    gstin: '32AAACV7757J2Z0',
                  })
                }
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View & Print Account Statement</span>
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Loyola School Trivandrum</h3>
                  <p className="text-[11px] text-gray-500">Educational Institution Contract</p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  Active
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 border-t border-gray-200 pt-2">
                <span>Outstanding Balance:</span>
                <span className="font-mono font-bold text-red-700">₹11,210.00</span>
              </div>
              <button
                onClick={() =>
                  setSelectedCustomerForStatement({
                    id: 'b0000000-0000-0000-0000-000000000002',
                    name: 'Loyola School Trivandrum',
                    phone: '+91 9447012345',
                    email: 'accounts@loyolatvm.edu.in',
                  })
                }
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View & Print Account Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedInvoiceForPayment && (
        <PaymentModal
          invoice={selectedInvoiceForPayment}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onPaymentRecorded={() => {
            // Refresh invoice status locally
            setInvoices((prev) =>
              prev.map((i) =>
                i.id === selectedInvoiceForPayment.id
                  ? {
                      ...i,
                      totalPaid: selectedInvoiceForPayment.outstandingBalance,
                      outstandingBalance: 0,
                      status: 'paid',
                    }
                  : i
              )
            );
          }}
        />
      )}

      {selectedInvoiceForNote && (
        <CreditDebitNoteModal
          invoice={selectedInvoiceForNote}
          onClose={() => setSelectedInvoiceForNote(null)}
          onNoteCreated={() => {
            // Note created
          }}
        />
      )}

      {selectedInvoiceForReminder && (
        <WhatsAppReminderModal
          invoice={selectedInvoiceForReminder}
          onClose={() => setSelectedInvoiceForReminder(null)}
        />
      )}

      {selectedCustomerForStatement && (
        <CustomerStatementModal
          customer={selectedCustomerForStatement}
          onClose={() => setSelectedCustomerForStatement(null)}
        />
      )}

      {/* Cancellation Reason Modal */}
      {cancelModalInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-red-700 border-b border-gray-100 pb-3">
              <Ban className="w-5 h-5 flex-shrink-0" />
              <h3 className="font-bold text-gray-900 font-display">
                Cancel Invoice #{cancelModalInvoice.invoiceNumber}
              </h3>
            </div>

            <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-900 space-y-1">
              <span className="font-bold text-[10px] uppercase tracking-wider text-red-800">
                Number Preservation Notice:
              </span>
              <p>
                Per Starciti audit requirements, cancelling an invoice{' '}
                <strong>never deletes or reuses its sequence number</strong>. Status becomes <em>cancelled</em>,
                and associated daily trip entries will be released for re-billing.
              </p>
            </div>

            <form onSubmit={handleCancelInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Mandatory Cancellation Justification * (Min 5 chars)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Rate card mismatch reported by coordinator; releasing logbook for correction"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCancelModalInvoice(null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Keep Invoice
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
