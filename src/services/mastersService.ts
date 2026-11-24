import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Customer {
  id: string;
  name: string;
  customerType: 'individual' | 'agent' | 'corporate' | 'school' | 'hotel' | 'long_term';
  billingAddress: string;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  pan?: string | null;
  gstin?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  paymentTermsDays: number;
  defaultSupplierId?: string | null;
  defaultInvoiceFormat: string;
  approvalToken?: string | null;
  isActive: boolean;
}

export interface Vehicle {
  id: string;
  regNo: string;
  displayRegNo: string;
  makeModel?: string | null;
  vehicleType: 'sedan' | 'ertiga' | 'innova' | 'tempo_traveller' | 'luxury';
  fuelType?: 'petrol' | 'diesel' | 'cng' | 'electric' | 'other';
  seats: number;
  ownership: 'owned' | 'hired' | 'attached';
  vendorId?: string | null;
  currentOdometer: number;
  kmGapThreshold: number;
  serviceIntervalKm?: number;
  rcExpiry?: string | null;
  insuranceExpiry?: string | null;
  pollutionExpiry?: string | null;
  permitExpiry?: string | null;
  fitnessExpiry?: string | null;
  monthlyEmiAmount?: number | null;
  emiDueDay?: number | null;
  isActive: boolean;
}

export interface Driver {
  id: string;
  name: string;
  phone?: string | null;
  driverType: 'permanent' | 'temporary' | 'vendor_supplied';
  licenseNo?: string | null;
  licenseExpiry?: string | null;
  badgeNo?: string | null;
  policeClearanceDate?: string | null;
  languages?: string[] | null;
  dailyBataRate?: number | null;
  isActive: boolean;
}

export interface Contract {
  id: string;
  customerId: string;
  supplierId: string;
  agreementNo: string;
  agreementDate: string;
  validFrom: string;
  validTo: string;
  contractKind: 'monthly_fixed' | 'per_trip_package' | 'on_call_pool' | 'hotel_contract';
  invoiceFormat: string;
  pricingModel: string;
  pricingParams: Record<string, any>;
  status: 'active' | 'renewal_pending' | 'expired' | 'renewed' | 'terminated';
}

export interface ContractTerm {
  id: string;
  contractId: string;
  effectiveFrom: string;
  effectiveTo: string;
  fixedAmount: number;
  includedKm: number;
  includedHoursPerDay: number;
  extraHourRate: number;
  extraKmRate: number;
  nightBata: number;
  outstationBata: number;
  workingDays: number;
  extraDayRate: number;
  roundingMode: 'down' | 'nearest' | 'none';
  gstMode: 'disabled' | 'cgst_sgst' | 'igst';
  legacyDecimalHoursBug?: boolean;
}

export interface RateCard {
  id: string;
  contractId?: string | null;
  customerId?: string | null;
  vehicleType: string;
  baseAmount: number;
  includedHours: number;
  includedKm: number;
  extraHourRate: number;
  extraKmRate: number;
  minCharge: number;
}

// REAL DATA ONLY - NO INVENTED LICENSES, EXPIRIES, OR BATAS
const REAL_SEED_CUSTOMERS: Customer[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'M/s Vindhya Telelinks Limited (Public Limited Company)',
    customerType: 'corporate',
    billingAddress: 'CC No. 40/1072A, PRG-59, North Janatha Road, Palarivattom, Cochin',
    city: 'Ernakulam',
    state: 'Kerala',
    pincode: '682025',
    pan: 'AAACV7757J',
    gstin: '32AAACV7757J2Z0',
    contactPerson: null,
    phone: null,
    email: null,
    paymentTermsDays: 30,
    defaultSupplierId: 'a0000000-0000-0000-0000-000000000002',
    defaultInvoiceFormat: 'F2',
    approvalToken: 'token-vtl-approval-2026',
    isActive: true,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Global Public School',
    customerType: 'school',
    billingAddress: 'Technopark phase 3 campus, Kulathoor',
    city: 'Trivandrum',
    state: 'Kerala',
    pincode: '695583',
    pan: null,
    gstin: null,
    contactPerson: null,
    phone: null,
    email: null,
    paymentTermsDays: 0,
    defaultSupplierId: 'a0000000-0000-0000-0000-000000000001',
    defaultInvoiceFormat: 'F1',
    approvalToken: 'token-gps-approval-2026',
    isActive: true,
  },
];

const REAL_SEED_VEHICLES: Vehicle[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    regNo: 'KL01CP3284',
    displayRegNo: 'KL-01-CP-3284',
    makeModel: '7-Seat AC Car', // Exact wording from VTL invoice, NOT invented Ertiga
    vehicleType: 'ertiga',
    fuelType: 'diesel',
    seats: 7,
    ownership: 'owned',
    currentOdometer: 157748,
    kmGapThreshold: 15,
    serviceIntervalKm: 10000,
    rcExpiry: null,
    insuranceExpiry: null,
    pollutionExpiry: null,
    permitExpiry: null,
    fitnessExpiry: null,
    monthlyEmiAmount: null,
    emiDueDay: null,
    isActive: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    regNo: 'KL824889',
    displayRegNo: 'KL-82-4889',
    makeModel: 'Ertiga', // From sheet ALL: 'ERTIGA KL 82 4889'
    vehicleType: 'ertiga',
    fuelType: 'diesel',
    seats: 7,
    ownership: 'owned',
    currentOdometer: 129163,
    kmGapThreshold: 15,
    serviceIntervalKm: 10000,
    rcExpiry: null,
    insuranceExpiry: null,
    pollutionExpiry: null,
    permitExpiry: null,
    fitnessExpiry: null,
    monthlyEmiAmount: null,
    emiDueDay: null,
    isActive: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    regNo: 'KL74E3694',
    displayRegNo: 'KL-74-E-3694',
    makeModel: null, // Substitute on 20 Aug
    vehicleType: 'sedan',
    fuelType: 'diesel',
    seats: 5,
    ownership: 'attached',
    currentOdometer: 41884,
    kmGapThreshold: 15,
    serviceIntervalKm: 10000,
    rcExpiry: null,
    insuranceExpiry: null,
    pollutionExpiry: null,
    permitExpiry: null,
    fitnessExpiry: null,
    monthlyEmiAmount: null,
    emiDueDay: null,
    isActive: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    regNo: 'KL21M2378',
    displayRegNo: 'KL-21-M-2378',
    makeModel: 'Dzire', // From sheet ALL: 'DZIRE KL 21 M 2378'
    vehicleType: 'sedan',
    fuelType: 'diesel',
    seats: 5,
    ownership: 'owned',
    currentOdometer: 218609,
    kmGapThreshold: 15,
    serviceIntervalKm: 10000,
    rcExpiry: null,
    insuranceExpiry: null,
    pollutionExpiry: null,
    permitExpiry: null,
    fitnessExpiry: null,
    monthlyEmiAmount: null,
    emiDueDay: null,
    isActive: true,
  },
];

const REAL_SEED_DRIVERS: Driver[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    name: 'Hemanth Kumar',
    phone: null,
    driverType: 'permanent',
    licenseNo: null,
    licenseExpiry: null,
    badgeNo: null,
    policeClearanceDate: null,
    languages: null,
    dailyBataRate: null,
    isActive: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    name: 'Muhammad Fayaz.s',
    phone: null,
    driverType: 'permanent',
    licenseNo: null,
    licenseExpiry: null,
    badgeNo: null,
    policeClearanceDate: null,
    languages: null,
    dailyBataRate: null,
    isActive: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    name: 'Asheerkhan',
    phone: null,
    driverType: 'permanent',
    licenseNo: null,
    licenseExpiry: null,
    badgeNo: null,
    policeClearanceDate: null,
    languages: null,
    dailyBataRate: null,
    isActive: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    name: 'Afzal',
    phone: null,
    driverType: 'temporary',
    licenseNo: null,
    licenseExpiry: null,
    badgeNo: null,
    policeClearanceDate: null,
    languages: null,
    dailyBataRate: null,
    isActive: true,
  },
];

const REAL_SEED_CONTRACTS: Contract[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    customerId: 'c0000000-0000-0000-0000-000000000001',
    supplierId: 'a0000000-0000-0000-0000-000000000002',
    agreementNo: '202526000005308395',
    agreementDate: '2025-11-01',
    validFrom: '2025-11-01',
    validTo: '2026-09-30',
    contractKind: 'monthly_fixed',
    invoiceFormat: 'F2',
    pricingModel: 'monthly_fixed',
    pricingParams: { fixed_amount: 65000, included_km: 3000, included_hours: 12 },
    status: 'renewal_pending', // VTL status renewal_pending
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    customerId: 'c0000000-0000-0000-0000-000000000002',
    supplierId: 'a0000000-0000-0000-0000-000000000001',
    agreementNo: 'GPS-TRV-2026-08',
    agreementDate: '2026-06-01',
    validFrom: '2026-06-01',
    validTo: '2027-05-31',
    contractKind: 'per_trip_package',
    invoiceFormat: 'F1',
    pricingModel: 'per_trip_package',
    pricingParams: { base_amount: 2415, included_km: 80, included_hours: 10 },
    status: 'active',
  },
];

const REAL_SEED_TERMS: ContractTerm[] = [
  {
    id: 't-vtl-2025',
    contractId: 'b0000000-0000-0000-0000-000000000001',
    effectiveFrom: '2025-08-01',
    effectiveTo: '2025-10-31',
    fixedAmount: 65000,
    includedKm: 2700,
    includedHoursPerDay: 10,
    extraHourRate: 150,
    extraKmRate: 18,
    nightBata: 250,
    outstationBata: 250,
    workingDays: 30,
    extraDayRate: 0,
    roundingMode: 'down',
    gstMode: 'disabled',
  },
  {
    id: 't-vtl-2026',
    contractId: 'b0000000-0000-0000-0000-000000000001',
    effectiveFrom: '2025-11-01',
    effectiveTo: '2026-09-30',
    fixedAmount: 65000,
    includedKm: 3000,
    includedHoursPerDay: 12,
    extraHourRate: 150,
    extraKmRate: 18,
    nightBata: 200,
    outstationBata: 200,
    workingDays: 30,
    extraDayRate: 0,
    roundingMode: 'down',
    gstMode: 'disabled',
  },
];

// SEDAN ONLY SEEDED (Per decision 5: Ertiga, Innova, Tempo Traveller blank and configurable)
const REAL_SEED_RATE_CARDS: RateCard[] = [
  {
    id: 'rc-sedan-gps',
    contractId: 'b0000000-0000-0000-0000-000000000002',
    customerId: 'c0000000-0000-0000-0000-000000000002',
    vehicleType: 'sedan',
    baseAmount: 2415,
    includedHours: 10,
    includedKm: 80,
    extraHourRate: 200,
    extraKmRate: 15,
    minCharge: 2415,
  },
];

// Unified API Service
export const MastersService = {
  async getCustomers(): Promise<Customer[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('customers').select('*');
      if (!error && data && data.length > 0) return data;
    }
    return REAL_SEED_CUSTOMERS;
  },

  async getVehicles(): Promise<Vehicle[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('vehicles').select('*');
      if (!error && data && data.length > 0) return data;
    }
    return REAL_SEED_VEHICLES;
  },

  async getDrivers(): Promise<Driver[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('drivers').select('*');
      if (!error && data && data.length > 0) return data;
    }
    return REAL_SEED_DRIVERS;
  },

  async getContracts(): Promise<Contract[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('contracts').select('*');
      if (!error && data && data.length > 0) return data;
    }
    return REAL_SEED_CONTRACTS;
  },

  async getTermsForDate(contractId: string, date: string): Promise<ContractTerm | undefined> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('contract_terms')
        .select('*')
        .eq('contract_id', contractId)
        .lte('effective_from', date)
        .gte('effective_to', date)
        .maybeSingle();
      if (!error && data) return data;
    }
    return REAL_SEED_TERMS.find(t =>
      t.contractId === contractId &&
      date >= t.effectiveFrom &&
      date <= t.effectiveTo
    );
  },

  async getRateCard(contractId: string | undefined, vehicleType: string): Promise<RateCard | undefined> {
    if (isSupabaseConfigured) {
      let query = supabase.from('rate_cards').select('*').eq('vehicle_type', vehicleType);
      if (contractId) {
        query = query.eq('contract_id', contractId);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) return data;
    }
    return REAL_SEED_RATE_CARDS.find(rc =>
      (contractId ? rc.contractId === contractId : true) &&
      rc.vehicleType.toLowerCase() === vehicleType.toLowerCase()
    );
  },

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    const newCustomer: Customer = {
      id: customer.id || crypto.randomUUID(),
      name: customer.name || 'Walk-in Customer',
      customerType: customer.customerType || 'individual',
      billingAddress: customer.billingAddress || 'Trivandrum, Kerala',
      city: customer.city || 'Trivandrum',
      state: customer.state || 'Kerala',
      pincode: customer.pincode || '',
      pan: customer.pan || null,
      gstin: customer.gstin || null,
      contactPerson: customer.contactPerson || null,
      phone: customer.phone || null,
      email: customer.email || null,
      paymentTermsDays: customer.paymentTermsDays || 0,
      defaultSupplierId: customer.defaultSupplierId || null,
      defaultInvoiceFormat: customer.defaultInvoiceFormat || 'F2',
      isActive: true,
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .insert({
            id: newCustomer.id.startsWith('c-') ? undefined : newCustomer.id,
            name: newCustomer.name,
            customer_type: newCustomer.customerType,
            billing_address: newCustomer.billingAddress,
            city: newCustomer.city,
            state: newCustomer.state,
            pincode: newCustomer.pincode,
            pan: newCustomer.pan,
            gstin: newCustomer.gstin,
            contact_person: newCustomer.contactPerson,
            phone: newCustomer.phone,
            email: newCustomer.email,
            payment_terms_days: newCustomer.paymentTermsDays,
            default_supplier_id: newCustomer.defaultSupplierId,
            default_invoice_format: newCustomer.defaultInvoiceFormat,
            is_active: true,
          })
          .select()
          .single();
        if (!error && data) {
          return {
            id: data.id,
            name: data.name,
            customerType: data.customer_type,
            billingAddress: data.billing_address,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
            pan: data.pan,
            gstin: data.gstin,
            contactPerson: data.contact_person,
            phone: data.phone,
            email: data.email,
            paymentTermsDays: data.payment_terms_days,
            defaultSupplierId: data.default_supplier_id,
            defaultInvoiceFormat: data.default_invoice_format,
            isActive: data.is_active,
          };
        }
      } catch (err) {
        console.warn('Fallback saving customer locally:', err);
      }
    }

    REAL_SEED_CUSTOMERS.push(newCustomer);
    return newCustomer;
  },

  getContractSync(contractId: string): Contract | undefined {
    return REAL_SEED_CONTRACTS.find((c) => c.id === contractId || contractId.includes(c.id) || (contractId === 'vtl' && c.id === 'b0000000-0000-0000-0000-000000000001') || (contractId === 'school' && c.id === 'b0000000-0000-0000-0000-000000000002'));
  },

  getCustomerSync(customerId: string): Customer | undefined {
    return REAL_SEED_CUSTOMERS.find((c) => c.id === customerId || customerId.includes(c.id) || (customerId === 'vtl' && c.id === 'c0000000-0000-0000-0000-000000000001') || (customerId === 'school' && c.id === 'c0000000-0000-0000-0000-000000000002'));
  },

  async getCustomerById(customerId: string): Promise<Customer | undefined> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          customerType: data.customer_type,
          billingAddress: data.billing_address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          pan: data.pan,
          gstin: data.gstin,
          contactPerson: data.contact_person,
          phone: data.phone,
          email: data.email,
          paymentTermsDays: data.payment_terms_days,
          defaultSupplierId: data.default_supplier_id,
          defaultInvoiceFormat: data.default_invoice_format,
          isActive: data.is_active,
        };
      }
    }
    return this.getCustomerSync(customerId);
  },

  async getContractById(contractId: string): Promise<Contract | undefined> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('contracts').select('*').eq('id', contractId).maybeSingle();
      if (!error && data) {
        return {
          id: data.id,
          customerId: data.customer_id,
          supplierId: data.supplier_id,
          agreementNo: data.agreement_no,
          agreementDate: data.agreement_date,
          validFrom: data.valid_from,
          validTo: data.valid_to,
          contractKind: data.contract_kind,
          invoiceFormat: data.invoice_format,
          pricingModel: data.pricing_model,
          pricingParams: data.pricing_params || {},
          status: data.status,
        };
      }
    }
    return this.getContractSync(contractId);
  },

  async createContract(contract: Partial<Contract>): Promise<Contract> {
    const newContract: Contract = {
      id: contract.id || crypto.randomUUID(),
      customerId: contract.customerId || '',
      supplierId: contract.supplierId || '',
      agreementNo: contract.agreementNo || `AGR-${Date.now()}`,
      agreementDate: contract.agreementDate || new Date().toISOString().slice(0, 10),
      validFrom: contract.validFrom || new Date().toISOString().slice(0, 10),
      validTo: contract.validTo || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      contractKind: contract.contractKind || 'per_trip_package',
      invoiceFormat: contract.invoiceFormat || 'template-inv-format1-school',
      pricingModel: contract.pricingModel || 'per_trip_package',
      pricingParams: contract.pricingParams || {},
      status: contract.status || 'active',
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('contracts')
          .insert({
            id: newContract.id,
            customer_id: newContract.customerId,
            supplier_id: newContract.supplierId,
            agreement_no: newContract.agreementNo,
            agreement_date: newContract.agreementDate,
            valid_from: newContract.validFrom,
            valid_to: newContract.validTo,
            contract_kind: newContract.contractKind,
            invoice_format: newContract.invoiceFormat,
            pricing_model: newContract.pricingModel,
            pricing_params: newContract.pricingParams,
            status: newContract.status,
          })
          .select()
          .single();
        if (!error && data) {
          return {
            id: data.id,
            customerId: data.customer_id,
            supplierId: data.supplier_id,
            agreementNo: data.agreement_no,
            agreementDate: data.agreement_date,
            validFrom: data.valid_from,
            validTo: data.valid_to,
            contractKind: data.contract_kind,
            invoiceFormat: data.invoice_format,
            pricingModel: data.pricing_model,
            pricingParams: data.pricing_params,
            status: data.status,
          };
        }
      } catch (err) {
        console.warn('Fallback saving contract locally:', err);
      }
    }

    REAL_SEED_CONTRACTS.push(newContract);
    return newContract;
  },

  async getContractTerms(contractId: string): Promise<ContractTerm[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('contract_terms')
        .select('*')
        .eq('contract_id', contractId)
        .order('effective_from', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          contractId: d.contract_id,
          effectiveFrom: d.effective_from,
          effectiveTo: d.effective_to,
          fixedAmount: Number(d.fixed_amount || 0),
          includedKm: Number(d.included_km || 0),
          includedHoursPerDay: Number(d.included_hours_per_day || 0),
          extraHourRate: Number(d.extra_hour_rate || 0),
          extraKmRate: Number(d.extra_km_rate || 0),
          nightBata: Number(d.night_bata || 0),
          outstationBata: Number(d.outstation_bata || 0),
          workingDays: Number(d.working_days || 30),
          extraDayRate: Number(d.extra_day_rate || 0),
          roundingMode: d.rounding_mode || 'down',
          gstMode: d.gst_mode || 'disabled',
        }));
      }
    }
    return REAL_SEED_TERMS.filter((t) => t.contractId === contractId);
  },

  async createContractTerm(term: Partial<ContractTerm>): Promise<ContractTerm> {
    const newTerm: ContractTerm = {
      id: term.id || crypto.randomUUID(),
      contractId: term.contractId || '',
      effectiveFrom: term.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: term.effectiveTo || '2099-12-31',
      fixedAmount: Number(term.fixedAmount || 0),
      includedKm: Number(term.includedKm || 0),
      includedHoursPerDay: Number(term.includedHoursPerDay || 0),
      extraHourRate: Number(term.extraHourRate || 0),
      extraKmRate: Number(term.extraKmRate || 0),
      nightBata: Number(term.nightBata || 0),
      outstationBata: Number(term.outstationBata || 0),
      workingDays: Number(term.workingDays || 30),
      extraDayRate: Number(term.extraDayRate || 0),
      roundingMode: term.roundingMode || 'down',
      gstMode: term.gstMode || 'disabled',
      legacyDecimalHoursBug: term.legacyDecimalHoursBug,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('contract_terms').insert({
          id: newTerm.id,
          contract_id: newTerm.contractId,
          effective_from: newTerm.effectiveFrom,
          effective_to: newTerm.effectiveTo,
          fixed_amount: newTerm.fixedAmount,
          included_km: newTerm.includedKm,
          included_hours_per_day: newTerm.includedHoursPerDay,
          extra_hour_rate: newTerm.extraHourRate,
          extra_km_rate: newTerm.extraKmRate,
          night_bata: newTerm.nightBata,
          outstation_bata: newTerm.outstationBata,
          working_days: newTerm.workingDays,
          extra_day_rate: newTerm.extraDayRate,
          rounding_mode: newTerm.roundingMode,
          gst_mode: newTerm.gstMode,
        });
      } catch (err) {
        console.warn('Fallback saving contract term locally:', err);
      }
    }

    REAL_SEED_TERMS.push(newTerm);
    return newTerm;
  },
};
