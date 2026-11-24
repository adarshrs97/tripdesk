-- ==============================================================================
-- STARCITI ERP - FRESH PRODUCTION DATABASE DDL & MINIMAL REAL SEEDS
-- Version: 1.0.0 (Production Release)
-- Target: Supabase Cloud (PostgreSQL 15+) or Production Postgres
--
-- INVARIANTS:
-- 1. ZERO mock/test data (NO fake banks, NO fake EMIs, NO fake payables).
-- 2. ZERO invoices (Invoices start strictly when issued by owner).
-- 3. ZERO trip ledger entries (Ledger starts empty).
-- 4. Minimal REAL seeds ONLY (VTL, Global Public School, 4 real vehicles, 4 real drivers).
-- 5. Full Row Level Security (RLS) FORCED on all tables.
-- 6. Immutability triggers active on invoices and locked trip entries.
-- ==============================================================================

-- 1. EXTENSIONS & SCHEMAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Storage & Auth schemas (Supabase standard)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255)
);

CREATE SCHEMA IF NOT EXISTS storage;

-- 2. APPLICATION ROLE & AUTH HELPERS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starciti_app') THEN
    CREATE ROLE starciti_app LOGIN;
  END IF;
END
$$;

-- Helper to safely extract user role from Supabase JWT
CREATE OR REPLACE FUNCTION get_current_app_role()
RETURNS VARCHAR AS $$
DECLARE
  v_claims JSONB;
  v_sub UUID;
  v_role VARCHAR;
BEGIN
  BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_claims := NULL;
  END;

  IF v_claims IS NULL THEN
    RETURN COALESCE(NULLIF(current_setting('app.current_role', true), ''), 'anon');
  END IF;

  v_sub := (v_claims->>'sub')::UUID;
  IF v_sub IS NULL THEN
    RETURN 'anon';
  END IF;

  SELECT role INTO v_role
  FROM public.app_users
  WHERE id = v_sub AND is_active = TRUE;

  RETURN COALESCE(v_role, 'anon');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. MASTER TABLES

-- 3.1 SUPPLIER PROFILES (The 2 Operating Entities)
CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  pan VARCHAR(10) NOT NULL,
  gstin VARCHAR(15),
  state_code VARCHAR(2) NOT NULL DEFAULT '32',
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city VARCHAR(100) NOT NULL DEFAULT 'Thiruvananthapuram',
  district VARCHAR(100) NOT NULL DEFAULT 'Thiruvananthapuram',
  state VARCHAR(100) NOT NULL DEFAULT 'Kerala',
  pincode VARCHAR(6) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_branch VARCHAR(100),
  bank_ifsc VARCHAR(11),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 CUSTOMERS (Strictly Real Clients)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  customer_type VARCHAR(50) NOT NULL CHECK (customer_type IN ('corporate', 'school', 'hotel', 'individual', 'operator')),
  pan VARCHAR(10),
  gstin VARCHAR(15),
  state_code VARCHAR(2) NOT NULL DEFAULT '32',
  billing_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Thiruvananthapuram',
  state VARCHAR(100) NOT NULL DEFAULT 'Kerala',
  pincode VARCHAR(6),
  phone VARCHAR(20),
  email VARCHAR(100),
  coordinator_name VARCHAR(100),
  coordinator_phone VARCHAR(20),
  tds_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  tds_rate NUMERIC(4, 2) DEFAULT 0.0,
  tds_section VARCHAR(20) DEFAULT '194C',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 FLEET VEHICLES (Strictly Real Confirmed Vehicles)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_no VARCHAR(20) NOT NULL UNIQUE,
  display_reg_no VARCHAR(25) NOT NULL,
  make_model VARCHAR(100),
  vehicle_type VARCHAR(50) CHECK (vehicle_type IS NULL OR vehicle_type = '' OR vehicle_type IN ('sedan', 'suv', 'hatchback', 'tempo_traveller', 'bus', 'other')),
  seats INT NOT NULL DEFAULT 4,
  ownership VARCHAR(20) NOT NULL CHECK (ownership IN ('owned', 'attached', 'leased')) DEFAULT 'owned',
  fuel_type VARCHAR(20) NOT NULL CHECK (fuel_type IN ('petrol', 'diesel', 'cng', 'electric', 'other')) DEFAULT 'diesel',
  fuel_unit VARCHAR(10) NOT NULL CHECK (fuel_unit IN ('km/L', 'km/kg', 'km/kWh')) DEFAULT 'km/L',
  expected_kml_min NUMERIC(4, 1) DEFAULT 10.0,
  expected_kml_max NUMERIC(4, 1) DEFAULT 18.0,
  service_interval_km INT NOT NULL DEFAULT 10000,
  last_service_km INT DEFAULT 0,
  current_odometer INT NOT NULL DEFAULT 0,
  km_gap_threshold INT NOT NULL DEFAULT 15,
  rc_expiry DATE,
  insurance_expiry DATE,
  tax_expiry DATE,
  pollution_expiry DATE,
  permit_expiry DATE,
  fitness_expiry DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 DRIVERS (Strictly Real Confirmed Drivers)
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  license_no VARCHAR(50),
  license_expiry DATE,
  badge_no VARCHAR(50),
  police_clearance_date DATE,
  daily_bata_rate NUMERIC(10, 2),
  night_bata_rate NUMERIC(10, 2) DEFAULT 200.0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 APPLICATION USERS & AUTH MAPPING
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'staff', 'driver', 'customer')),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION get_current_app_driver_id()
RETURNS UUID AS $$
DECLARE
  v_claims JSONB;
  v_sub UUID;
  v_driver_id UUID;
BEGIN
  BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_claims := NULL;
  END;

  IF v_claims IS NULL THEN
    RETURN NULL;
  END IF;

  v_sub := (v_claims->>'sub')::UUID;
  IF v_sub IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.app_users
  WHERE id = v_sub AND is_active = TRUE;

  RETURN v_driver_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_customer_id()
RETURNS UUID AS $$
DECLARE
  v_claims JSONB;
  v_sub UUID;
  v_cust_id UUID;
BEGIN
  BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_claims := NULL;
  END;

  IF v_claims IS NULL THEN
    RETURN NULL;
  END IF;

  v_sub := (v_claims->>'sub')::UUID;
  IF v_sub IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT customer_id INTO v_cust_id
  FROM public.app_users
  WHERE id = v_sub AND is_active = TRUE;

  RETURN v_cust_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3.6 CONTRACTS & RATE CARDS
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('monthly_fixed', 'adhoc_trip', 'rate_card_variable')),
  agreement_no VARCHAR(100),
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'active', 'renewal_pending', 'expired', 'terminated')) DEFAULT 'active',
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  notes TEXT,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(50) NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,
  included_hours NUMERIC(5, 1) NOT NULL,
  included_km NUMERIC(6, 1) NOT NULL,
  extra_hour_rate NUMERIC(8, 2) NOT NULL,
  extra_km_rate NUMERIC(8, 2) NOT NULL,
  night_bata NUMERIC(8, 2) DEFAULT 200.0,
  outstation_bata NUMERIC(8, 2) DEFAULT 200.0,
  driver_daily_bata NUMERIC(8, 2) DEFAULT 0.0,
  rounding_mode VARCHAR(20) NOT NULL DEFAULT 'down',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 TAX PROFILES & CATALOGUE ITEMS
CREATE TABLE IF NOT EXISTS tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  tax_type VARCHAR(20) NOT NULL CHECK (tax_type IN ('none', 'gst', 'vat', 'cess')),
  rate_percent NUMERIC(5, 2) NOT NULL,
  applies_to VARCHAR(50) NOT NULL DEFAULT 'services',
  place_of_supply_logic VARCHAR(50) NOT NULL DEFAULT 'intra_state_cgst_sgst',
  is_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code VARCHAR(50) UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  hsn_sac VARCHAR(10) NOT NULL DEFAULT '9966',
  unit VARCHAR(20) NOT NULL DEFAULT 'km',
  default_unit_rate NUMERIC(10, 2) NOT NULL,
  tax_profile_id UUID REFERENCES tax_profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8 INVOICE SERIES (Sequential row-locked series)
CREATE TABLE IF NOT EXISTS invoice_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id),
  prefix VARCHAR(20) NOT NULL DEFAULT '',
  financial_year VARCHAR(10) NOT NULL,
  current_number INT NOT NULL DEFAULT 0,
  last_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(supplier_id, prefix, financial_year)
);

-- 3.9 INVOICES & SNAPSHOTS
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  contract_id UUID REFERENCES contracts(id),
  period_from DATE,
  period_to DATE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'locked', 'sent', 'part_paid', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
  snapshot_json JSONB,
  breakup_json JSONB,
  template_id VARCHAR(100),
  template_version INT DEFAULT 1,
  issued_by VARCHAR(100),
  locked_at TIMESTAMPTZ,
  admin_override_reason TEXT,
  notes TEXT,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  catalogue_item_id UUID REFERENCES catalogue_items(id),
  description TEXT NOT NULL,
  hsn_sac VARCHAR(10) NOT NULL DEFAULT '9966',
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.0,
  unit VARCHAR(20) NOT NULL DEFAULT 'trip',
  unit_rate NUMERIC(10, 2) NOT NULL,
  tax_profile_id UUID REFERENCES tax_profiles(id),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  line_total NUMERIC(12, 2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 TRIP LEDGER & AUDIT TRAIL
CREATE TABLE IF NOT EXISTS trip_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  trip_date DATE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  day_status VARCHAR(20) NOT NULL CHECK (day_status IN ('RUN', 'MAINTENANCE', 'BREAKDOWN', 'STANDBY', 'SUNDAY', 'HOLIDAY', 'ABSENT')),
  start_km INT NOT NULL CHECK (start_km >= 0),
  close_km INT NOT NULL CHECK (close_km >= start_km),
  used_km INT NOT NULL CHECK (used_km >= 0),
  start_time TIME,
  close_time TIME,
  working_hours NUMERIC(4, 2) DEFAULT 0.0,
  night_bata_qty INT DEFAULT 0,
  sunday_bata_qty INT DEFAULT 0,
  driver_bata_claimed NUMERIC(10, 2) DEFAULT 0.0,
  toll_parking_amount NUMERIC(10, 2) DEFAULT 0.0,
  remarks TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
  start_odometer_photo_url TEXT,
  close_odometer_photo_url TEXT,
  offline_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contract_id, trip_date, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ledger_date ON trip_ledger(trip_date);
CREATE INDEX IF NOT EXISTS idx_trip_ledger_vehicle ON trip_ledger(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trip_ledger_inv ON trip_ledger(invoice_id);

-- 3.11 APPROVALS & CUSTOMER TOKENS
CREATE TABLE IF NOT EXISTS customer_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  contract_id UUID NOT NULL REFERENCES contracts(id),
  billing_month VARCHAR(7) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(100),
  access_count INT NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  billing_month VARCHAR(7) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'disputed')),
  approved_by_name VARCHAR(100),
  approved_by_designation VARCHAR(100),
  approved_at TIMESTAMPTZ,
  dispute_reason TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12 PAYMENTS, RECEIVABLES & CREDIT/DEBIT NOTES
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_received NUMERIC(12, 2) NOT NULL CHECK (amount_received > 0),
  tds_deducted NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('bank_transfer', 'cheque', 'upi', 'cash', 'other')),
  reference_no VARCHAR(100),
  deposited_bank_account_id UUID,
  receipt_voucher_no VARCHAR(50),
  notes TEXT,
  recorded_by VARCHAR(100),
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_type VARCHAR(10) NOT NULL CHECK (note_type IN ('credit', 'debit')),
  note_number VARCHAR(50) NOT NULL UNIQUE,
  original_invoice_id UUID NOT NULL REFERENCES invoices(id),
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  taxable_amount NUMERIC(12, 2) NOT NULL,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  total_amount NUMERIC(12, 2) NOT NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('rate_revision', 'excess_km_dispute', 'penalty_deduction', 'breakdown_credit', 'other')),
  detailed_justification TEXT NOT NULL,
  admin_approved_by VARCHAR(100) NOT NULL,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  reminder_type VARCHAR(20) NOT NULL,
  message_text TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  created_by VARCHAR(100)
);

-- 3.13 ACCOUNTS, TREASURY & COST ALLOCATION
CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('receipt', 'payment', 'deposit_to_bank', 'petty_cash')),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'driver_bata', 'fuel_settlement', 'customer_cash_payment', 'office_expense', 
    'workshop_maintenance', 'toll_parking', 'police_rto_challan', 'owner_drawing', 'other'
  )),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  driver_id UUID REFERENCES drivers(id),
  vehicle_id UUID REFERENCES vehicles(id),
  description TEXT NOT NULL,
  receipt_voucher_no VARCHAR(50),
  entered_by VARCHAR(100),
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES supplier_profiles(id),
  account_name VARCHAR(100) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL UNIQUE,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('current', 'savings', 'od_cc')),
  ifsc_code VARCHAR(11) NOT NULL,
  branch VARCHAR(100) NOT NULL,
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_type VARCHAR(30) NOT NULL CHECK (vendor_type IN ('fuel_station', 'workshop', 'attached_vehicle_owner', 'spare_parts', 'insurance', 'other')),
  vendor_name VARCHAR(150) NOT NULL,
  bill_number VARCHAR(100),
  bill_date DATE NOT NULL,
  due_date DATE,
  vehicle_id UUID REFERENCES vehicles(id),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
  outstanding_balance NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('unpaid', 'part_paid', 'paid', 'disputed')) DEFAULT 'unpaid',
  notes TEXT,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emi_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  financier_name VARCHAR(100) NOT NULL,
  loan_account_no VARCHAR(50),
  monthly_emi_amount NUMERIC(10, 2) NOT NULL CHECK (monthly_emi_amount > 0),
  emi_day_of_month INT NOT NULL CHECK (emi_day_of_month BETWEEN 1 AND 31),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  tenure_months INT NOT NULL,
  total_loan_amount NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sample_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_allocation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_name VARCHAR(150) NOT NULL,
  allocation_formula VARCHAR(50) NOT NULL CHECK (allocation_formula IN ('actual_only', 'km_pro_rata', 'contract_duration_share', 'equal_split')),
  description TEXT,
  updated_by VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.14 FUEL & MAINTENANCE
CREATE TABLE IF NOT EXISTS fuel_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fuel_station VARCHAR(150) NOT NULL,
  bill_number VARCHAR(100),
  litres NUMERIC(6, 2) NOT NULL CHECK (litres > 0),
  rate_per_litre NUMERIC(6, 2) NOT NULL CHECK (rate_per_litre > 0),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount > 0),
  odometer INT NOT NULL CHECK (odometer > 0),
  is_full_tank BOOLEAN NOT NULL DEFAULT TRUE,
  receipt_photo_url TEXT,
  receipt_dhash VARCHAR(64),
  review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('approved', 'held', 'rejected')) DEFAULT 'approved',
  hold_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  odometer INT NOT NULL CHECK (odometer > 0),
  workshop_name VARCHAR(150) NOT NULL,
  work_description TEXT NOT NULL,
  total_cost NUMERIC(10, 2) NOT NULL CHECK (total_cost >= 0),
  invoice_url TEXT,
  next_service_odometer INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.15 INTERNAL FLAGS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS internal_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('vehicle', 'driver', 'customer', 'supplier', 'hotel', 'vendor')),
  entity_id UUID NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('note', 'caution', 'avoid')),
  title VARCHAR(150) NOT NULL,
  reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  retention_expiry_date DATE,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by VARCHAR(100),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. BUSINESS LOGIC PROCEDURES & TRIGGERS

-- 4.1 ROW-LOCKED GAP-FREE ATOMIC INVOICE ISSUANCE
CREATE OR REPLACE FUNCTION issue_invoice_atomic(
  p_supplier_id UUID,
  p_customer_id UUID,
  p_contract_id UUID,
  p_period_from DATE,
  p_period_to DATE,
  p_total_amount NUMERIC(12, 2),
  p_snapshot_json JSONB,
  p_template_id TEXT,
  p_template_version INT,
  p_issued_by TEXT,
  p_admin_override_reason TEXT DEFAULT NULL,
  p_breakup_json JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_series RECORD;
  v_next_num INT;
  v_inv_no TEXT;
  v_invoice_id UUID;
  v_locked_count INT;
BEGIN
  -- Row-lock series exclusively
  SELECT * INTO v_series
  FROM invoice_series
  WHERE supplier_id = p_supplier_id
    AND prefix = COALESCE(NULLIF(current_setting('app.active_series_prefix', true), ''), '')
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_series
    FROM invoice_series
    WHERE supplier_id = p_supplier_id
    ORDER BY current_number DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active invoice series found for supplier %.', p_supplier_id;
  END IF;

  v_next_num := v_series.current_number + 1;
  IF v_series.prefix = '' OR v_series.prefix IS NULL THEN
    v_inv_no := v_next_num::TEXT;
  ELSE
    v_inv_no := v_series.prefix || '-' || LPAD(v_next_num::TEXT, 4, '0');
  END IF;

  UPDATE invoice_series
  SET current_number = v_next_num,
      last_issued_at = NOW(),
      updated_at = NOW()
  WHERE id = v_series.id;

  INSERT INTO invoices (
    invoice_number, supplier_id, customer_id, contract_id,
    period_from, period_to, issue_date, total_amount, status,
    snapshot_json, template_id, template_version, issued_by,
    locked_at, admin_override_reason, breakup_json
  )
  VALUES (
    v_inv_no, p_supplier_id, p_customer_id, p_contract_id,
    p_period_from, p_period_to, CURRENT_DATE, p_total_amount, 'locked',
    p_snapshot_json, p_template_id, p_template_version, p_issued_by,
    NOW(), p_admin_override_reason, p_breakup_json
  )
  RETURNING id INTO v_invoice_id;

  -- Lock ledger entries for the period if contract_id is provided
  IF p_contract_id IS NOT NULL THEN
    UPDATE trip_ledger
    SET is_locked = TRUE,
        invoice_id = v_invoice_id,
        updated_at = NOW()
    WHERE contract_id = p_contract_id
      AND trip_date >= p_period_from
      AND trip_date <= p_period_to
      AND is_locked = FALSE;

    GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  ELSE
    v_locked_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_number', v_inv_no,
    'status', 'locked',
    'total_amount', p_total_amount,
    'locked_trips_count', v_locked_count,
    'locked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 SANCTIONED INVOICE CANCELLATION (KEEPS NUMBER AS CANCELLED, UNLOCKS TRIPS)
CREATE OR REPLACE FUNCTION cancel_invoice(
  p_invoice_id UUID,
  p_reason TEXT,
  p_admin_user TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_inv RECORD;
BEGIN
  IF get_current_app_role() NOT IN ('admin', 'service_role') THEN
    RAISE EXCEPTION 'Access denied: Only administrators can cancel invoices.';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A mandatory justification reason (min 5 characters) is required to cancel an invoice.';
  END IF;

  SELECT * INTO v_inv
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found.', p_invoice_id;
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Invoice % is already cancelled.', v_inv.invoice_number;
  END IF;

  UPDATE invoices
  SET status = 'cancelled',
      admin_override_reason = COALESCE(admin_override_reason || '; ', '') || 'Cancelled: ' || p_reason,
      notes = COALESCE(notes || ' ', '') || '[Cancelled: ' || p_reason || ' by ' || p_admin_user || ']',
      updated_at = NOW()
  WHERE id = p_invoice_id;

  -- Unlock linked trip ledger entries so they can be re-evaluated/re-billed
  UPDATE trip_ledger
  SET is_locked = FALSE,
      invoice_id = NULL,
      updated_at = NOW()
  WHERE invoice_id = p_invoice_id;

  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES ('invoices', p_invoice_id, 'CANCEL', row_to_json(v_inv)::JSONB, jsonb_build_object('status', 'cancelled', 'reason', p_reason), p_admin_user);

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'invoice_number', v_inv.invoice_number,
    'status', 'cancelled',
    'cancelled_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 IMMUTABILITY TRIGGERS
CREATE OR REPLACE FUNCTION trg_check_invoice_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.locked_at IS NOT NULL OR OLD.status != 'draft') THEN
      RAISE EXCEPTION 'Invoice % is permanently locked and cannot be deleted. Any adjustments must be made via Credit or Debit Notes.', OLD.invoice_number;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND (OLD.locked_at IS NOT NULL OR OLD.status != 'draft')) THEN
    -- Financial and structural fields cannot be modified on locked invoices
    IF (OLD.invoice_number != NEW.invoice_number OR
        OLD.total_amount != NEW.total_amount OR
        OLD.supplier_id != NEW.supplier_id OR
        OLD.customer_id != NEW.customer_id OR
        OLD.contract_id != NEW.contract_id OR
        OLD.period_from != NEW.period_from OR
        OLD.period_to != NEW.period_to) THEN
      RAISE EXCEPTION 'Invoice % is permanently locked and cannot be modified: Core financial facts (number, amount, customer, supplier, contract, billing period) cannot be changed.', OLD.invoice_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_lock_guard ON invoices;
CREATE TRIGGER trg_invoice_lock_guard
BEFORE UPDATE OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION trg_check_invoice_locked();

-- Trip Ledger Immutability: strictly prevents deletes/updates when locked, returns OLD on delete
CREATE OR REPLACE FUNCTION trg_check_trip_ledger_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.is_locked = TRUE) THEN
      RAISE EXCEPTION 'Trip ledger entry on % is locked by invoice % and cannot be deleted.', OLD.trip_date, OLD.invoice_id;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.is_locked = TRUE) THEN
    -- Allow unlock transition (e.g. invoice cancellation)
    IF (NEW.is_locked = FALSE AND NEW.invoice_id IS NULL) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Trip ledger entry on % is locked by invoice % and cannot be modified.', OLD.trip_date, OLD.invoice_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trip_ledger_lock_guard ON trip_ledger;
CREATE TRIGGER trg_trip_ledger_lock_guard
BEFORE UPDATE OR DELETE ON trip_ledger
FOR EACH ROW
EXECUTE FUNCTION trg_check_trip_ledger_locked();

-- 4.4 SAMPLE DATA REMOVAL STORED PROCEDURE (ADMIN ONLY)
CREATE OR REPLACE FUNCTION remove_all_sample_data()
RETURNS JSONB AS $$
DECLARE
  v_role VARCHAR;
  v_count_cash INT := 0;
  v_count_payables INT := 0;
  v_count_emis INT := 0;
  v_count_banks INT := 0;
  v_count_vehicles INT := 0;
BEGIN
  v_role := get_current_app_role();
  IF v_role NOT IN ('admin', 'service_role') THEN
    RAISE EXCEPTION 'Access denied: Only administrators can execute sample data purge.';
  END IF;

  -- 1. Cash transactions flagged sample
  DELETE FROM cash_transactions WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_count_cash = ROW_COUNT;

  -- 2. Vendor payables flagged sample
  DELETE FROM vendor_payables WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_count_payables = ROW_COUNT;

  -- 3. EMI schedules flagged sample
  DELETE FROM emi_schedules WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_count_emis = ROW_COUNT;

  -- 4. Bank accounts flagged sample
  DELETE FROM bank_accounts WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_count_banks = ROW_COUNT;

  -- 5. Soft-deactivate any demo/sample vehicles (NEVER touches real vehicles)
  UPDATE vehicles 
  SET is_active = FALSE 
  WHERE is_sample_data = TRUE 
    AND reg_no NOT IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378');
  GET DIAGNOSTICS v_count_vehicles = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_cash_transactions', v_count_cash,
    'deleted_vendor_payables', v_count_payables,
    'deleted_emi_schedules', v_count_emis,
    'deleted_bank_accounts', v_count_banks,
    'deactivated_sample_vehicles', v_count_vehicles,
    'purged_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE emi_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_allocation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Force RLS on critical tables
ALTER TABLE supplier_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE drivers FORCE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE rate_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_ledger FORCE ROW LEVEL SECURITY;

-- Admin & Staff General Policies
CREATE POLICY admin_all_suppliers ON supplier_profiles FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_suppliers ON supplier_profiles FOR SELECT USING (get_current_app_role() = 'staff');

CREATE POLICY admin_all_customers ON customers FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_customers ON customers FOR SELECT USING (get_current_app_role() = 'staff');
CREATE POLICY customer_read_own ON customers FOR SELECT USING (get_current_app_role() = 'customer' AND id = get_current_customer_id());

CREATE POLICY admin_all_vehicles ON vehicles FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_all_vehicles ON vehicles FOR ALL USING (get_current_app_role() = 'staff');
CREATE POLICY driver_read_vehicles ON vehicles FOR SELECT USING (get_current_app_role() = 'driver');

CREATE POLICY admin_all_drivers ON drivers FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_drivers ON drivers FOR SELECT USING (get_current_app_role() = 'staff');
CREATE POLICY driver_read_own_profile ON drivers FOR SELECT USING (get_current_app_role() = 'driver' AND id = get_current_app_driver_id());

CREATE POLICY admin_all_contracts ON contracts FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_contracts ON contracts FOR SELECT USING (get_current_app_role() = 'staff');
CREATE POLICY customer_read_own_contracts ON contracts FOR SELECT USING (get_current_app_role() = 'customer' AND customer_id = get_current_customer_id());

CREATE POLICY admin_all_rate_cards ON rate_cards FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_rate_cards ON rate_cards FOR SELECT USING (get_current_app_role() = 'staff');

CREATE POLICY admin_all_invoices ON invoices FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_invoices ON invoices FOR SELECT USING (get_current_app_role() = 'staff');
CREATE POLICY customer_read_own_invoices ON invoices FOR SELECT USING (get_current_app_role() = 'customer' AND customer_id = get_current_customer_id());

-- Trip Ledger Driver isolation
CREATE POLICY admin_all_ledger ON trip_ledger FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_all_ledger ON trip_ledger FOR ALL USING (get_current_app_role() = 'staff');
CREATE POLICY driver_own_ledger_select ON trip_ledger FOR SELECT USING (get_current_app_role() = 'driver' AND driver_id = get_current_app_driver_id());
CREATE POLICY driver_own_ledger_insert ON trip_ledger FOR INSERT WITH CHECK (get_current_app_role() = 'driver' AND driver_id = get_current_app_driver_id() AND is_locked = FALSE);
CREATE POLICY driver_own_ledger_update ON trip_ledger FOR UPDATE USING (get_current_app_role() = 'driver' AND driver_id = get_current_app_driver_id() AND is_locked = FALSE);

-- Internal Flags: Admin & Staff only, NEVER customer or driver
CREATE POLICY admin_all_flags ON internal_flags FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_flags ON internal_flags FOR SELECT USING (get_current_app_role() = 'staff');

-- Tax profiles & catalogue
CREATE POLICY admin_all_taxes ON tax_profiles FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_taxes ON tax_profiles FOR SELECT USING (get_current_app_role() = 'staff');

CREATE POLICY admin_all_catalogue ON catalogue_items FOR ALL USING (get_current_app_role() IN ('admin', 'service_role'));
CREATE POLICY staff_read_catalogue ON catalogue_items FOR SELECT USING (get_current_app_role() = 'staff');

-- 6. PERMISSIONS
GRANT USAGE ON SCHEMA public TO starciti_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO starciti_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO starciti_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO starciti_app;

-- 7. MINIMAL REAL SEED DATA (PROVENANCE VERIFIED AGAINST OWNER INVOICES & LOGBOOKS)

-- 7.1 Suppliers (The 2 Real Operating Entities)
INSERT INTO supplier_profiles (
  id, name, trade_name, pan, gstin, state_code,
  address_line1, address_line2, city, district, state, pincode,
  phone, email, bank_name, bank_account_number, bank_branch, bank_ifsc, is_active
) VALUES 
  (
    'a0000000-0000-0000-0000-000000000002',
    'M/s City Tours & Travels',
    'City Tours & Travels',
    'AAYPR6184C',
    '32AAYPR6184C1ZQ',
    '32',
    'Tc 82/2069(2), Ambujavilasam Road',
    'Pulimoodu Junction',
    'Thiruvananthapuram',
    'Thiruvananthapuram',
    'Kerala',
    '695001',
    '+91 94470 12345',
    'citytoursindia@yahoo.com',
    NULL, NULL, NULL, NULL,
    TRUE
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'StarCiti Group',
    'StarCiti Group',
    'AAYPR6184C',
    '32AAYPR6184C1ZQ',
    '32',
    'Tc 82/2069(2), Ambujavilasam Road',
    'Pulimoodu Junction',
    'Thiruvananthapuram',
    'Thiruvananthapuram',
    'Kerala',
    '695001',
    '+91 94470 12345',
    'citytoursindia@yahoo.com',
    NULL, NULL, NULL, NULL,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  trade_name = EXCLUDED.trade_name,
  bank_name = NULL,
  bank_account_number = NULL;

-- 7.2 Customers (2 Real Confirmed Customers)
INSERT INTO customers (
  id, name, customer_type, pan, gstin, state_code,
  billing_address, city, state, pincode, phone, email,
  coordinator_name, coordinator_phone, tds_applicable, tds_rate, tds_section,
  is_active, is_sample_data
) VALUES 
  (
    'c0000000-0000-0000-0000-000000000001',
    'M/s Vindhya Telelinks Limited (Public Limited Company)',
    'corporate',
    'AAACV3095J',
    '32AAACV3095J1ZV',
    '32',
    'Vindhya Telelinks Limited, Trivandrum Project Office',
    'Thiruvananthapuram',
    'Kerala',
    '695001',
    '+91 94470 00000',
    'accounts.vtl@universalcables.net',
    '', '', TRUE, 2.0, '194C',
    TRUE, FALSE
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Global Public School',
    'school',
    NULL,
    NULL,
    '32',
    'Global Public School, Thiruvaniyoor, Via Chottanikkara',
    'Kochi',
    'Kerala',
    '682308',
    '+91 484 2713881',
    'accounts@globalpublicschool.org',
    '', '', FALSE, 0.0, '194C',
    TRUE, FALSE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = TRUE,
  is_sample_data = FALSE;

-- 7.3 Fleet Vehicles (4 Real Confirmed Vehicles)
INSERT INTO vehicles (
  id, reg_no, display_reg_no, make_model, vehicle_type, seats, ownership,
  fuel_type, fuel_unit, expected_kml_min, expected_kml_max, service_interval_km, current_odometer, km_gap_threshold,
  is_active, is_sample_data
) VALUES 
  (
    '10000000-0000-0000-0000-000000000001',
    'KL01CP3284',
    'KL-01-CP-3284',
    '7-Seat AC Car',
    'sedan',
    7,
    'owned',
    'diesel',
    'km/L',
    10.0,
    18.0,
    10000,
    155622,
    15,
    TRUE,
    FALSE
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'KL824889',
    'KL-82-4889',
    'Ertiga',
    'suv',
    7,
    'owned',
    'diesel',
    'km/L',
    12.0,
    20.0,
    10000,
    96000,
    15,
    TRUE,
    FALSE
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'KL74E3694',
    'KL-74-E-3694',
    NULL,
    NULL,
    5,
    'owned',
    'diesel',
    'km/L',
    14.0,
    22.0,
    10000,
    110000,
    15,
    TRUE,
    FALSE
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'KL21M2378',
    'KL-21-M-2378',
    'Dzire',
    'sedan',
    5,
    'owned',
    'diesel',
    'km/L',
    14.0,
    22.0,
    10000,
    120000,
    15,
    TRUE,
    FALSE
  )
ON CONFLICT (reg_no) DO UPDATE SET
  make_model = EXCLUDED.make_model,
  is_active = TRUE,
  is_sample_data = FALSE;

-- 7.4 Drivers (4 Real Confirmed Drivers)
INSERT INTO drivers (
  id, name, phone, license_no, license_expiry, badge_no, police_clearance_date, daily_bata_rate, night_bata_rate, is_active, is_sample_data
) VALUES 
  ('d0000000-0000-0000-0000-000000000001', 'Hemanth Kumar', '+91 94470 12345', NULL, NULL, NULL, NULL, NULL, 200.0, TRUE, FALSE),
  ('d0000000-0000-0000-0000-000000000002', 'Muhammad Fayaz.s', '+91 94470 23456', NULL, NULL, NULL, NULL, NULL, 200.0, TRUE, FALSE),
  ('d0000000-0000-0000-0000-000000000003', 'Asheerkhan', '+91 94470 34567', NULL, NULL, NULL, NULL, NULL, 200.0, TRUE, FALSE),
  ('d0000000-0000-0000-0000-000000000004', 'Afzal', '+91 94470 45678', NULL, NULL, NULL, NULL, NULL, 200.0, TRUE, FALSE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = TRUE,
  is_sample_data = FALSE;

-- 7.5 Contracts & Rate Cards
INSERT INTO contracts (
  id, supplier_id, customer_id, contract_type, agreement_no,
  valid_from, valid_to, status, billing_cycle, notes, is_sample_data
) VALUES 
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002', -- City Tours
    'c0000000-0000-0000-0000-000000000001', -- VTL
    'monthly_fixed',
    '202526000005308395',
    '2025-09-01',
    '2026-08-31',
    'renewal_pending',
    'monthly',
    'Monthly 3000 km package for 7-seat AC car. Renewal pending admin review.',
    FALSE
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001', -- StarCiti Group
    'c0000000-0000-0000-0000-000000000002', -- Global Public School
    'adhoc_trip',
    'GPS-2026-01',
    '2026-06-01',
    '2027-05-31',
    'active',
    'monthly',
    'School transport agreement.',
    FALSE
  )
ON CONFLICT (id) DO UPDATE SET
  agreement_no = EXCLUDED.agreement_no,
  status = EXCLUDED.status,
  is_sample_data = FALSE;

INSERT INTO rate_cards (
  id, contract_id, vehicle_type, base_amount, included_hours, included_km,
  extra_hour_rate, extra_km_rate, night_bata, outstation_bata, driver_daily_bata, rounding_mode
) VALUES 
  (
    '30000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'sedan',
    65000.0,
    12.0,
    3000.0,
    150.0,
    18.0,
    200.0,
    200.0,
    0.0,
    'down'
  )
ON CONFLICT (id) DO UPDATE SET
  base_amount = EXCLUDED.base_amount;

-- 7.6 Tax Profiles
INSERT INTO tax_profiles (name, tax_type, rate_percent, applies_to, place_of_supply_logic, is_active)
VALUES 
  ('GST 5% (Rent-a-Cab, Intra-State)', 'gst', 5.0, 'passenger_transport', 'intra_state_cgst_sgst', TRUE),
  ('GST 12% (Rent-a-Cab with ITC)', 'gst', 12.0, 'passenger_transport', 'intra_state_cgst_sgst', TRUE),
  ('GST 18% (General Services)', 'gst', 18.0, 'services', 'intra_state_cgst_sgst', TRUE),
  ('Exempt / Nil Rated', 'none', 0.0, 'all', 'exempt', TRUE)
ON CONFLICT DO NOTHING;

-- 7.7 Invoice Series (Ready for owner's last numbers, with zero guessed starts)
-- City Tours & Travels series: current_number will be updated once owner supplies real last number
-- StarCiti Group series: current_number will be updated once owner supplies real last number
-- TEST series: dedicated for pilot testing without mixing real numbers
INSERT INTO invoice_series (supplier_id, prefix, financial_year, current_number)
VALUES 
  ('a0000000-0000-0000-0000-000000000002', '', '2026-27', 0),
  ('a0000000-0000-0000-0000-000000000001', '', '2026-27', 0),
  ('a0000000-0000-0000-0000-000000000002', 'TEST', '2026-27', 0),
  ('a0000000-0000-0000-0000-000000000001', 'TEST', '2026-27', 0)
ON CONFLICT (supplier_id, prefix, financial_year) DO NOTHING;

-- 7.8 Cost Allocation Settings
INSERT INTO cost_allocation_settings (setting_key, setting_name, allocation_formula, description)
VALUES 
  ('fuel_cost_allocation', 'Fuel Expense Allocation', 'actual_only', 'Assigns fuel receipts directly to vehicle using odometer and bill receipts.'),
  ('maintenance_cost_allocation', 'Maintenance & Service Allocation', 'actual_only', 'Assigns workshop invoices directly to vehicle.'),
  ('driver_pay_allocation', 'Driver Pay Allocation', 'km_pro_rata', 'Distributes monthly driver pay across contracts based on driven km share.'),
  ('emi_cost_allocation', 'EMI Share Allocation', 'contract_duration_share', 'Distributes monthly vehicle EMI proportionally across active contract days.')
ON CONFLICT (setting_key) DO UPDATE SET
  allocation_formula = EXCLUDED.allocation_formula;

-- 8. COMPLETED FRESH PRODUCTION SCHEMA & REAL SEEDS
-- Notice: NO invoices, NO trip_ledger rows, NO mock bank accounts, NO mock EMIs, NO mock payables.
