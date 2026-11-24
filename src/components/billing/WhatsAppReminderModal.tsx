import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2, Phone } from 'lucide-react';
import { PaymentService } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';

interface WhatsAppReminderModalProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    customerPhone?: string | null;
    supplierName?: string;
    totalAmount: number;
    outstandingBalance: number;
    dueDate: string;
    daysOverdue?: number;
  };
  onClose: () => void;
}

export const WhatsAppReminderModal: React.FC<WhatsAppReminderModalProps> = ({ invoice, onClose }) => {
  const { currentUser } = useAuth();
  const [reminderType, setReminderType] = useState<'due_minus_3' | 'due_date' | 'overdue_7' | 'overdue_14' | 'custom'>(
    (invoice.daysOverdue || 0) >= 14
      ? 'overdue_14'
      : (invoice.daysOverdue || 0) > 0
      ? 'overdue_7'
      : 'due_date'
  );
  const [recipientPhone, setRecipientPhone] = useState(invoice.customerPhone || '+91 9846012345');
  const [customText, setCustomText] = useState('');
  const [isLogged, setIsLogged] = useState(false);

  const supplierName = invoice.supplierName || 'M/S City Tours & Travels';

  // Generate initial template
  const { messageText: generatedText } = PaymentService.generateWhatsAppReminder({
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    customerPhone: recipientPhone,
    supplierName,
    amount: invoice.outstandingBalance,
    dueDate: invoice.dueDate,
    daysOverdue: invoice.daysOverdue,
    reminderType,
  });

  const activeMessage = customText || generatedText;

  const handleSend = async () => {
    try {
      await PaymentService.logPaymentReminder({
        invoiceId: invoice.id,
        reminderType,
        recipientPhone,
        messageText: activeMessage,
        createdBy: currentUser?.name || 'Staff',
      });
      setIsLogged(true);

      // Open WhatsApp Web / App in a new tab
      const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
      const finalLink = `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(activeMessage)}`;
      window.open(finalLink, '_blank');
    } catch (err) {
      console.error('Failed to log reminder', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 font-display text-sm">Send Payment Reminder (WhatsApp)</h3>
              <p className="text-[11px] text-gray-500">Invoice #{invoice.invoiceNumber} • {invoice.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>

        {isLogged && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Reminder sent and logged to audit trail!</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Reminder Schedule Trigger</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'due_minus_3', label: '3 Days Before' },
                { id: 'due_date', label: 'On Due Date' },
                { id: 'overdue_7', label: '7 Days Overdue' },
                { id: 'overdue_14', label: '14+ Days Overdue' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setReminderType(t.id as any);
                    setCustomText('');
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all text-[11px] ${
                    reminderType === t.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Customer Phone (WhatsApp) *</label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              WhatsApp Message Preview (Editable)
            </label>
            <textarea
              rows={6}
              value={activeMessage}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-xs leading-relaxed font-sans focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-gray-50"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">
              Opens wa.me URL directly in chat
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send WhatsApp Message</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
