import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  ArrowRight,
  CheckCircle2,
  Car,
  Calendar,
  MapPin,
  Phone,
  Filter,
} from 'lucide-react';
import { CustomerEnquiry, CustomerType, VehicleCategory } from '../../engine/dispatch/types';
import { DispatchService } from '../../services/dispatchService';

interface EnquiriesViewProps {
  onNavigateToQuote?: (enquiryId?: string) => void;
}

export const EnquiriesView: React.FC<EnquiriesViewProps> = ({ onNavigateToQuote }) => {
  const [enquiries, setEnquiries] = useState<CustomerEnquiry[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'quoted' | 'converted'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('corporate');
  const [pickupLocation, setPickupLocation] = useState('Technopark, Trivandrum');
  const [dropLocation, setDropLocation] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('sedan');
  const [estimatedKm, setEstimatedKm] = useState('150');
  const [estimatedDays, setEstimatedDays] = useState('1');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    const list = await DispatchService.getEnquiries();
    setEnquiries(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !dropLocation) return;

    await DispatchService.createEnquiry({
      enquiryDate: new Date().toISOString().slice(0, 10),
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      customerType,
      pickupLocation,
      dropLocation,
      startDate,
      endDate,
      vehicleCategory,
      estimatedKm: parseFloat(estimatedKm) || 100,
      estimatedDays: parseInt(estimatedDays, 10) || 1,
      estimatedHours: (parseInt(estimatedDays, 10) || 1) * 10,
      status: 'new',
      notes: notes || undefined,
    });

    setShowAddModal(false);
    // Reset
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setDropLocation('');
    setNotes('');
    await loadData();
  };

  const filtered = enquiries.filter((e) => {
    if (activeFilter === 'all') return true;
    return e.status === activeFilter;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-card border border-line p-5 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-ink flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand" />
            Customer Enquiries &amp; Charter Leads
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Capture incoming phone, email, and WhatsApp requirements. Convert directly into multi-tier price quotes.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Capture New Enquiry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="text-xs text-ink-soft font-medium">Total Enquiries</div>
          <div className="text-2xl font-bold font-heading text-ink mt-1">{enquiries.length}</div>
        </div>
        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="text-xs text-amber-700 font-medium">New / Unquoted</div>
          <div className="text-2xl font-bold font-heading text-amber-700 mt-1">
            {enquiries.filter((e) => e.status === 'new').length}
          </div>
        </div>
        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="text-xs text-blue-700 font-medium">Quoted Active</div>
          <div className="text-2xl font-bold font-heading text-blue-700 mt-1">
            {enquiries.filter((e) => e.status === 'quoted').length}
          </div>
        </div>
        <div className="bg-card border border-line p-4 rounded-xl shadow-xs">
          <div className="text-xs text-emerald-700 font-medium">Converted to Bookings</div>
          <div className="text-2xl font-bold font-heading text-emerald-700 mt-1">
            {enquiries.filter((e) => e.status === 'converted').length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <Filter className="w-3.5 h-3.5 text-ink-soft" />
        <span className="text-xs text-ink-soft font-medium">Filter:</span>
        {(['all', 'new', 'quoted', 'converted'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
              activeFilter === tab
                ? 'bg-brand text-white'
                : 'text-ink-soft hover:text-ink bg-paper'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Enquiries Table */}
      <div className="bg-card border border-line rounded-xl overflow-hidden shadow-xs">
        <table className="min-w-full divide-y divide-line text-xs">
          <thead className="bg-paper text-ink-soft font-semibold uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Route / Itinerary</th>
              <th className="px-4 py-3 text-left">Vehicle &amp; Est.</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                  No enquiries matching selected status.
                </td>
              </tr>
            ) : (
              filtered.map((enq) => (
                <tr key={enq.id} className="hover:bg-paper/50">
                  <td className="px-4 py-3 whitespace-nowrap text-ink-soft font-mono">
                    {enq.enquiryDate}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">{enq.customerName}</div>
                    <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-ink-faint" />
                      {enq.customerPhone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-ink flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-brand shrink-0" />
                      <span className="truncate max-w-xs">{enq.pickupLocation} &rarr; {enq.dropLocation}</span>
                    </div>
                    <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-ink-faint" />
                      {enq.startDate} ({enq.estimatedDays} day{enq.estimatedDays > 1 ? 's' : ''})
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-semibold text-ink uppercase flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-ink-soft" />
                      {enq.vehicleCategory}
                    </div>
                    <div className="text-[11px] text-ink-soft mt-0.5 font-mono">
                      ~{enq.estimatedKm} km
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        enq.status === 'converted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : enq.status === 'quoted'
                          ? 'bg-blue-100 text-blue-800'
                          : enq.status === 'new'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {enq.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {enq.status === 'new' ? (
                      <button
                        onClick={() => onNavigateToQuote && onNavigateToQuote(enq.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-brand text-white hover:bg-brand-dark transition-colors shadow-xs"
                      >
                        Create Quote <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : enq.status === 'quoted' ? (
                      <button
                        onClick={() => onNavigateToQuote && onNavigateToQuote(enq.quoteId)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-paper border border-line text-ink hover:border-brand transition-colors"
                      >
                        View Quote
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-medium flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Booked
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-line max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand" />
              Capture New Customer Enquiry
            </h3>

            <form onSubmit={handleCreateEnquiry} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Customer / Organization Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Technopark Delegate or Guest"
                  className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 94470 00000"
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Customer Type</label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  >
                    <option value="corporate">Corporate Client</option>
                    <option value="individual">Individual / Tourist</option>
                    <option value="agent">Travel Agent</option>
                    <option value="school">School / College</option>
                    <option value="long_term">Long-Term Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Pickup Location</label>
                  <input
                    type="text"
                    required
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Drop / Destination</label>
                  <input
                    type="text"
                    required
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                    placeholder="e.g. Kanyakumari / Kochi / Airport"
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Trip Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Trip End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Vehicle Category</label>
                  <select
                    value={vehicleCategory}
                    onChange={(e) => setVehicleCategory(e.target.value as VehicleCategory)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none uppercase"
                  >
                    <option value="sedan">Sedan (Dzire/Etios)</option>
                    <option value="suv">SUV (Ertiga/Innova)</option>
                    <option value="tempo">Tempo Traveller</option>
                    <option value="luxury">Luxury Car</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Estimated KM</label>
                  <input
                    type="number"
                    value={estimatedKm}
                    onChange={(e) => setEstimatedKm(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Days</label>
                  <input
                    type="number"
                    value={estimatedDays}
                    onChange={(e) => setEstimatedDays(e.target.value)}
                    min={1}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Remarks &amp; Special Requirements</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Flight arrival timing, English-speaking driver, luggage carrier..."
                  className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-line rounded-lg text-ink hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark"
                >
                  Save Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
