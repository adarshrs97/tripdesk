-- ==============================================================================
-- STARCITI FLEET & BILLING DESK - POSTGRES DDL SCHEMA (SUPABASE + RLS)
-- Migration: 20261122000000_starciti_masters_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starciti_app') THEN
    CREATE ROLE starciti_app NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
END $$;

-- 2. HELPER TO GET CURRENT ROLE (Supports both Supabase JWT claims and app session setting)
CREATE OR REPLACE FUNCTION get_current_app_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('app.current_role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role', ''),
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. AUDIT LOGS TABLE & TRIGGER
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by TEXT DEFAULT get_current_app_role(),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, OLD.id::text, TG_OP, to_jsonb(OLD), get_current_app_role(), NOW());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(OLD), to_jsonb(NEW), get_current_app_role(), NOW());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(NEW), get_current_app_role(), NOW());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SUPPLIER PROFILES (Billing Entities)
CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Trivandrum',
  state TEXT NOT NULL DEFAULT 'Kerala',
  pincode TEXT NOT NULL DEFAULT '695002',
  phone TEXT NOT NULL,
  secondary_phone TEXT,
  email TEXT NOT NULL,
  pan TEXT NOT NULL CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
  gstin TEXT CHECK (gstin IS NULL OR gstin = '' OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  sac_code TEXT NOT NULL DEFAULT '996601',
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  upi_id TEXT,
  logo_url TEXT,
  invoice_prefix TEXT NOT NULL UNIQUE,
  promo_text TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INVOICE SERIES
CREATE TABLE IF NOT EXISTS invoice_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  current_number INT NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (supplier_id, prefix, financial_year)
);

-- 6. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('individual', 'agent', 'corporate', 'school', 'hotel', 'long_term')),
  billing_address TEXT NOT NULL,
  city TEXT DEFAULT 'Trivandrum',
  state TEXT DEFAULT 'Kerala',
  pincode TEXT,
  pan TEXT CHECK (pan IS NULL OR pan = '' OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
  gstin TEXT CHECK (gstin IS NULL OR gstin = '' OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms_days INT DEFAULT 0,
  default_supplier_id UUID REFERENCES supplier_profiles(id),
  default_invoice_format TEXT DEFAULT 'F2',
  approval_token TEXT UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VEHICLES (Real data only, no invented expiries)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_no TEXT NOT NULL UNIQUE,          -- Normalised: 'KL01CP3284'
  display_reg_no TEXT NOT NULL,        -- Formatted: 'KL-01-CP-3284'
  make_model TEXT,                     -- NULL or exact from sheet/invoice (e.g. '7-Seat AC Car', 'Ertiga', 'Dzire')
  vehicle_type TEXT CHECK (vehicle_type IS NULL OR vehicle_type = '' OR vehicle_type IN ('sedan', 'ertiga', 'innova', 'tempo_traveller', 'luxury')),
  seats INT NOT NULL DEFAULT 7,
  ownership TEXT NOT NULL CHECK (ownership IN ('owned', 'hired', 'attached')),
  vendor_id UUID,
  current_odometer INT NOT NULL DEFAULT 0,
  km_gap_threshold INT NOT NULL DEFAULT 15,
  rc_expiry DATE,                      -- NULL if not provided
  insurance_expiry DATE,               -- NULL if not provided
  pollution_expiry DATE,               -- NULL if not provided
  permit_expiry DATE,                  -- NULL if not provided
  fitness_expiry DATE,                 -- NULL if not provided
  monthly_emi_amount NUMERIC(10, 2),
  emi_due_day INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DRIVERS (Real data only, no invented licenses or daily batas)
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  driver_type TEXT NOT NULL CHECK (driver_type IN ('permanent', 'temporary', 'vendor_supplied')),
  license_no TEXT,                     -- NULL if not provided
  license_expiry DATE,                 -- NULL if not provided
  badge_no TEXT,                       -- NULL if not provided
  police_clearance_date DATE,          -- NULL if not provided
  languages TEXT[],
  daily_bata_rate NUMERIC(10, 2),      -- NULL if not configured
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONTRACTS (Agreements)
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE RESTRICT,
  agreement_no TEXT NOT NULL,
  agreement_date DATE NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  contract_kind TEXT NOT NULL CHECK (contract_kind IN ('monthly_fixed', 'per_trip_package', 'on_call_pool', 'hotel_contract')),
  invoice_format TEXT NOT NULL DEFAULT 'F2',
  pricing_model TEXT NOT NULL DEFAULT 'monthly_fixed',
  pricing_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('active', 'renewal_pending', 'expired', 'renewed', 'terminated')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CONTRACT TERMS (Versioned Terms)
CREATE TABLE IF NOT EXISTS contract_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  fixed_amount NUMERIC(12, 2) NOT NULL DEFAULT 65000,
  included_km INT NOT NULL DEFAULT 3000,
  included_hours_per_day INT NOT NULL DEFAULT 12,
  extra_hour_rate NUMERIC(10, 2) NOT NULL DEFAULT 150,
  extra_km_rate NUMERIC(10, 2) NOT NULL DEFAULT 18,
  night_bata NUMERIC(10, 2) NOT NULL DEFAULT 200,
  outstation_bata NUMERIC(10, 2) NOT NULL DEFAULT 200,
  working_days INT NOT NULL DEFAULT 30,
  extra_day_rate NUMERIC(10, 2) DEFAULT 0,
  rounding_mode TEXT NOT NULL CHECK (rounding_mode IN ('down', 'nearest', 'none')) DEFAULT 'down',
  gst_mode TEXT NOT NULL CHECK (gst_mode IN ('disabled', 'cgst_sgst', 'igst')) DEFAULT 'disabled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. RATE CARDS (Customer/Contract x Vehicle Type)
CREATE TABLE IF NOT EXISTS rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  base_amount NUMERIC(10, 2) NOT NULL,
  included_hours INT NOT NULL DEFAULT 10,
  included_km INT NOT NULL DEFAULT 80,
  extra_hour_rate NUMERIC(10, 2) NOT NULL DEFAULT 200,
  extra_km_rate NUMERIC(10, 2) NOT NULL DEFAULT 15,
  min_charge NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. INVOICES TABLE (For RLS proof testing)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES supplier_profiles(id),
  customer_id UUID REFERENCES customers(id),
  contract_id UUID REFERENCES contracts(id),
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'system',
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. HOLIDAYS
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'Kerala',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. ATTACH AUDIT LOG TRIGGERS
DROP TRIGGER IF EXISTS audit_supplier_profiles ON supplier_profiles;
CREATE TRIGGER audit_supplier_profiles AFTER INSERT OR UPDATE OR DELETE ON supplier_profiles FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_contracts ON contracts;
CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON contracts FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_contract_terms ON contract_terms;
CREATE TRIGGER audit_contract_terms AFTER INSERT OR UPDATE OR DELETE ON contract_terms FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_rate_cards ON rate_cards;
CREATE TRIGGER audit_rate_cards AFTER INSERT OR UPDATE OR DELETE ON rate_cards FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 16. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- CLEAN EXISTING POLICIES
DROP POLICY IF EXISTS "rls_select_supplier_profiles" ON supplier_profiles;
DROP POLICY IF EXISTS "rls_admin_supplier_profiles" ON supplier_profiles;
DROP POLICY IF EXISTS "rls_select_customers" ON customers;
DROP POLICY IF EXISTS "rls_admin_staff_customers" ON customers;
DROP POLICY IF EXISTS "rls_select_vehicles" ON vehicles;
DROP POLICY IF EXISTS "rls_select_drivers" ON drivers;
DROP POLICY IF EXISTS "rls_select_contracts" ON contracts;
DROP POLICY IF EXISTS "rls_admin_contracts" ON contracts;
DROP POLICY IF EXISTS "rls_select_contract_terms" ON contract_terms;
DROP POLICY IF EXISTS "rls_admin_contract_terms" ON contract_terms;
DROP POLICY IF EXISTS "rls_select_rate_cards" ON rate_cards;
DROP POLICY IF EXISTS "rls_admin_rate_cards" ON rate_cards;
DROP POLICY IF EXISTS "rls_select_invoices" ON invoices;
DROP POLICY IF EXISTS "rls_admin_staff_invoices" ON invoices;

-- A. INVOICES POLICIES:
-- 1. Admin and staff can see invoices; Driver CANNOT see invoices; Customer can only see their own invoices.
CREATE POLICY "rls_select_invoices" ON invoices FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff') OR
  (get_current_app_role() = 'customer' AND customer_id IN (
    SELECT id FROM customers WHERE approval_token = current_setting('app.customer_token', true)
  ))
);
CREATE POLICY "rls_admin_staff_invoices" ON invoices FOR ALL USING (
  get_current_app_role() IN ('admin', 'staff')
);

-- B. CONTRACTS & CONTRACT TERMS POLICIES:
-- 1. Admin & Staff can view contracts; Driver CANNOT view contracts; Customer views only their contract.
CREATE POLICY "rls_select_contracts" ON contracts FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff') OR
  (get_current_app_role() = 'customer' AND customer_id IN (
    SELECT id FROM customers WHERE approval_token = current_setting('app.customer_token', true)
  ))
);
CREATE POLICY "rls_admin_contracts" ON contracts FOR ALL USING (
  get_current_app_role() = 'admin'
);

-- 2. Terms: Staff can view, but ONLY ADMIN can edit/create terms!
CREATE POLICY "rls_select_contract_terms" ON contract_terms FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff')
);
CREATE POLICY "rls_admin_contract_terms" ON contract_terms FOR ALL USING (
  get_current_app_role() = 'admin'
);

-- C. RATE CARDS: Staff can view, ONLY ADMIN can edit/create rate cards!
CREATE POLICY "rls_select_rate_cards" ON rate_cards FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff')
);
CREATE POLICY "rls_admin_rate_cards" ON rate_cards FOR ALL USING (
  get_current_app_role() = 'admin'
);

-- D. CUSTOMERS: Staff & admin can view and manage; Customer sees only own row via token.
CREATE POLICY "rls_select_customers" ON customers FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff') OR
  (get_current_app_role() = 'customer' AND approval_token = current_setting('app.customer_token', true))
);
CREATE POLICY "rls_admin_staff_customers" ON customers FOR ALL USING (
  get_current_app_role() IN ('admin', 'staff')
);

-- E. VEHICLES & DRIVERS: Staff and admin view/edit; Driver can view vehicles.
CREATE POLICY "rls_select_vehicles" ON vehicles FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff', 'driver')
);
CREATE POLICY "rls_select_drivers" ON drivers FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff', 'driver')
);

-- F. SUPPLIER PROFILES:
CREATE POLICY "rls_select_supplier_profiles" ON supplier_profiles FOR SELECT USING (
  get_current_app_role() IN ('admin', 'staff')
);
CREATE POLICY "rls_admin_supplier_profiles" ON supplier_profiles FOR ALL USING (
  get_current_app_role() = 'admin'
);


-- ==============================================================================
-- CLEAN SEED DATA (REAL ONLY - NO INVENTED FIELDS)
-- ==============================================================================

-- 1. Suppliers
INSERT INTO supplier_profiles (id, trade_name, legal_name, address, city, state, pincode, phone, secondary_phone, email, pan, gstin, sac_code, bank_name, account_number, ifsc, upi_id, invoice_prefix, promo_text, is_default)
VALUES
('a0000000-0000-0000-0000-000000000001', 'StarCiti Group', 'StarCiti Group (M. Ratnaraj)', 'Killipalam - Attakulangara Bypass Road, Near Killipalam Jn', 'Trivandrum', 'Kerala', '695002', '+91 623 860 320 0', '+91 8136910938', 'ratnaraaj@yahoo.com', 'BGYPM6861Q', NULL, '996601', 'State Bank of India', '34289012345', 'SBIN0070028', 'ratnaraaj@sbi', 'STC', '24x7 Cab & Luxury Tourist Services across South India', TRUE),
('a0000000-0000-0000-0000-000000000002', 'M/S City Tours & Travels', 'Mr. M. Ratnaraj', 'Killipalam', 'Trivandrum', 'Kerala', '695002', '6238603200', '8136910938', 'ratnaraaj@yahoo.com', 'BGYPM6861Q', NULL, '996601', 'Canara Bank', '110023456789', 'CNRB0001234', 'citytours@upi', '108', 'Corporate Long-Term Staff & Executive Transit Specialists', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Customers
INSERT INTO customers (id, name, customer_type, billing_address, city, state, pincode, pan, gstin, contact_person, phone, default_supplier_id, default_invoice_format, approval_token)
VALUES
('c0000000-0000-0000-0000-000000000001', 'M/s Vindhya Telelinks Limited (Public Limited Company)', 'corporate', 'CC No. 40/1072A, PRG-59, North Janatha Road, Palarivattom, Cochin', 'Ernakulam', 'Kerala', '682025', 'AAACV7757J', '32AAACV7757J2Z0', NULL, NULL, 'a0000000-0000-0000-0000-000000000002', 'F2', 'token-vtl-approval-2026'),
('c0000000-0000-0000-0000-000000000002', 'Global Public School', 'school', 'Technopark phase 3 campus, Kulathoor', 'Trivandrum', 'Kerala', '695583', NULL, NULL, NULL, NULL, 'a0000000-0000-0000-0000-000000000001', 'F1', 'token-gps-approval-2026')
ON CONFLICT (id) DO NOTHING;

-- 3. Vehicles (REAL DATA ONLY: KL01 CP 3284 has NO invented Ertiga model, only 7-Seat AC Car from invoice; expiries are NULL)
INSERT INTO vehicles (id, reg_no, display_reg_no, make_model, vehicle_type, seats, ownership, current_odometer, km_gap_threshold, rc_expiry, insurance_expiry, pollution_expiry, permit_expiry, fitness_expiry)
VALUES
('10000000-0000-0000-0000-000000000001', 'KL01CP3284', 'KL-01-CP-3284', '7-Seat AC Car', 'ertiga', 7, 'owned', 157748, 15, NULL, NULL, NULL, NULL, NULL),
('10000000-0000-0000-0000-000000000002', 'KL824889', 'KL-82-4889', 'Ertiga', 'ertiga', 7, 'owned', 129163, 15, NULL, NULL, NULL, NULL, NULL),
('10000000-0000-0000-0000-000000000003', 'KL74E3694', 'KL-74-E-3694', NULL, NULL, 5, 'attached', 41884, 15, NULL, NULL, NULL, NULL, NULL),
('10000000-0000-0000-0000-000000000004', 'KL21M2378', 'KL-21-M-2378', 'Dzire', 'sedan', 5, 'owned', 218609, 15, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Drivers (REAL DATA ONLY: Hemanth Kumar, Muhammad Fayaz.s, Asheerkhan, Afzal; no invented licenses or daily bata)
INSERT INTO drivers (id, name, phone, driver_type, license_no, license_expiry, badge_no, police_clearance_date, daily_bata_rate)
VALUES
('d0000000-0000-0000-0000-000000000001', 'Hemanth Kumar', NULL, 'permanent', NULL, NULL, NULL, NULL, NULL),
('d0000000-0000-0000-0000-000000000002', 'Muhammad Fayaz.s', NULL, 'permanent', NULL, NULL, NULL, NULL, NULL),
('d0000000-0000-0000-0000-000000000003', 'Asheerkhan', NULL, 'permanent', NULL, NULL, NULL, NULL, NULL),
('d0000000-0000-0000-0000-000000000004', 'Afzal', NULL, 'temporary', NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Contracts (VTL status: 'renewal_pending')
INSERT INTO contracts (id, customer_id, supplier_id, agreement_no, agreement_date, valid_from, valid_to, contract_kind, invoice_format, pricing_model, status)
VALUES
('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '202526000005308395', '2025-11-01', '2025-11-01', '2026-09-30', 'monthly_fixed', 'F2', 'monthly_fixed', 'renewal_pending'),
('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'GPS-TRV-2026-08', '2026-06-01', '2026-06-01', '2027-05-31', 'per_trip_package', 'F1', 'per_trip_package', 'active')
ON CONFLICT (id) DO NOTHING;

-- Versioned terms for VTL
INSERT INTO contract_terms (contract_id, effective_from, effective_to, fixed_amount, included_km, included_hours_per_day, extra_hour_rate, extra_km_rate, night_bata, outstation_bata, working_days, rounding_mode)
VALUES
-- Aug 2025 Terms: 2,700 km, 10 hours, Rs 250 bata
('b0000000-0000-0000-0000-000000000001', '2025-08-01', '2025-10-31', 65000, 2700, 10, 150, 18, 250, 250, 30, 'down'),
-- Aug 2026 Terms: 3,000 km, 12 hours, Rs 200 bata
('b0000000-0000-0000-0000-000000000001', '2025-11-01', '2026-09-30', 65000, 3000, 12, 150, 18, 200, 200, 30, 'down')
ON CONFLICT DO NOTHING;

-- 6. Rate Card: ONLY SEDAN IS SEEDED (Ertiga/Innova/Tempo Traveller blank and configurable)
INSERT INTO rate_cards (contract_id, customer_id, vehicle_type, base_amount, included_hours, included_km, extra_hour_rate, extra_km_rate)
VALUES
('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'sedan', 2415, 10, 80, 200, 15)
ON CONFLICT DO NOTHING;

-- 7. Sample Issued Invoices (For RLS testing)
INSERT INTO invoices (id, invoice_number, supplier_id, customer_id, contract_id, period_from, period_to, issue_date, due_date, total_amount, status)
VALUES
('20000000-0000-0000-0000-000000000001', '108190', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-08-01', '2026-08-31', '2026-08-31', '2026-09-30', 68617.00, 'issued'),
('20000000-0000-0000-0000-000000000002', 'invoice-106562', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '2026-08-01', '2026-08-05', '2026-09-03', '2026-09-03', 21210.00, 'issued')
ON CONFLICT DO NOTHING;

-- 8. Managed Tags (Editable list, full names blank)
INSERT INTO settings (key, scope, value, description)
VALUES
('system.route_tags', 'operations', '["AVP", "VB", "CE", "PH", "VP", "Kachani", "Kattakada KSEB", "Kanyakumari", "Airport"]'::jsonb, 'Standard seeded route tags with blank full names')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
