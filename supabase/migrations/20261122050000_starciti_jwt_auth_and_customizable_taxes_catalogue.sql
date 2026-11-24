-- ==============================================================================
-- Migration: 20261122050000_starciti_jwt_auth_and_customizable_taxes_catalogue.sql
-- 1. Real JWT Auth Role Resolution (auth.uid() -> app_users.role)
-- 2. Client Role Forgery Prevention
-- 3. Tax Profiles Schema & Scope Ladder
-- 4. Item Catalogue (Saved Services) Schema
-- 5. Ad-hoc / Quick Invoicing & Invoice Types Schema
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SUPABASE AUTH SCHEMA & JWT FUNCTIONS (Guarded for Real Supabase / PostgREST)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS uuid AS $body$
        SELECT COALESCE(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          ((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))
        )::uuid;
      $body$ LANGUAGE sql STABLE;
    $func$;
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS jsonb AS $body$
        SELECT COALESCE(
          nullif(current_setting('request.jwt.claims', true), '')::jsonb,
          '{}'::jsonb
        );
      $body$ LANGUAGE sql STABLE;
    $func$;
    BEGIN
      GRANT USAGE ON SCHEMA auth TO starciti_app;
      GRANT EXECUTE ON FUNCTION auth.uid() TO starciti_app;
      GRANT EXECUTE ON FUNCTION auth.jwt() TO starciti_app;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION auth.jwt() TO starciti_app;

-- ------------------------------------------------------------------------------
-- 2. ROLE RESOLUTION STRICTLY FROM auth.uid() -> app_users.role
-- Ignores any session GUC (app.current_role) so a client CANNOT forge its own role!
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_app_role()
RETURNS TEXT AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
BEGIN
  -- Extract authenticated user ID from JWT
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  -- If no authenticated JWT user, return anon
  IF v_uid IS NULL THEN
    RETURN 'anon';
  END IF;

  -- Strictly lookup role from app_users by auth.uid()
  SELECT role INTO v_role
  FROM public.app_users
  WHERE id = v_uid AND is_active = TRUE;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  RETURN 'anon';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_app_role() TO starciti_app;

-- ------------------------------------------------------------------------------
-- 3. UPDATE RLS POLICIES ON CORE TABLES TO USE get_current_app_role() & auth.uid()
-- ------------------------------------------------------------------------------

-- TRIP LEDGER
DROP POLICY IF EXISTS admin_trip_ledger_all ON trip_ledger;
DROP POLICY IF EXISTS staff_trip_ledger_all ON trip_ledger;
DROP POLICY IF EXISTS driver_trip_ledger_select ON trip_ledger;
DROP POLICY IF EXISTS driver_trip_ledger_insert ON trip_ledger;
DROP POLICY IF EXISTS driver_trip_ledger_update ON trip_ledger;
DROP POLICY IF EXISTS customer_trip_ledger_select ON trip_ledger;

CREATE POLICY admin_trip_ledger_all ON trip_ledger
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

CREATE POLICY staff_trip_ledger_all ON trip_ledger
  FOR ALL
  USING (get_current_app_role() = 'staff')
  WITH CHECK (get_current_app_role() = 'staff');

CREATE POLICY driver_trip_ledger_select ON trip_ledger
  FOR SELECT
  USING (
    get_current_app_role() = 'driver'
    AND driver_id = auth.uid()
  );

CREATE POLICY driver_trip_ledger_insert ON trip_ledger
  FOR INSERT
  WITH CHECK (
    get_current_app_role() = 'driver'
    AND driver_id = auth.uid()
  );

CREATE POLICY driver_trip_ledger_update ON trip_ledger
  FOR UPDATE
  USING (
    get_current_app_role() = 'driver'
    AND driver_id = auth.uid()
  );

CREATE POLICY customer_trip_ledger_select ON trip_ledger
  FOR SELECT
  USING (
    get_current_app_role() = 'customer_viewer'
    AND contract_id IN (
      SELECT id FROM contracts WHERE customer_id IN (
        SELECT id FROM customers WHERE email = (SELECT email FROM app_users WHERE id = auth.uid())
      )
    )
  );

-- INVOICES POLICIES
DROP POLICY IF EXISTS admin_invoices_all ON invoices;
DROP POLICY IF EXISTS staff_invoices_select ON invoices;
DROP POLICY IF EXISTS staff_invoices_insert ON invoices;
DROP POLICY IF EXISTS customer_invoices_select ON invoices;

CREATE POLICY admin_invoices_all ON invoices
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

CREATE POLICY staff_invoices_select ON invoices
  FOR SELECT
  USING (get_current_app_role() = 'staff');

CREATE POLICY staff_invoices_insert ON invoices
  FOR INSERT
  WITH CHECK (get_current_app_role() = 'staff');

CREATE POLICY customer_invoices_select ON invoices
  FOR SELECT
  USING (
    get_current_app_role() = 'customer_viewer'
    AND customer_id IN (
      SELECT id FROM customers WHERE email = (SELECT email FROM app_users WHERE id = auth.uid())
    )
  );

-- RATE CARDS & CONTRACT TERMS (Staff cannot modify, Driver cannot read)
DROP POLICY IF EXISTS admin_rate_cards_all ON rate_cards;
DROP POLICY IF EXISTS staff_rate_cards_select ON rate_cards;
DROP POLICY IF EXISTS admin_contract_terms_all ON contract_terms;
DROP POLICY IF EXISTS staff_contract_terms_select ON contract_terms;

CREATE POLICY admin_rate_cards_all ON rate_cards
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

CREATE POLICY staff_rate_cards_select ON rate_cards
  FOR SELECT
  USING (get_current_app_role() = 'staff');

CREATE POLICY admin_contract_terms_all ON contract_terms
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

CREATE POLICY staff_contract_terms_select ON contract_terms
  FOR SELECT
  USING (get_current_app_role() = 'staff');

-- STORAGE OBJECTS (Odometer photos)
DROP POLICY IF EXISTS "storage_driver_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_driver_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_staff_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_all" ON storage.objects;

CREATE POLICY "storage_driver_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    get_current_app_role() = 'driver'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage_driver_select" ON storage.objects
  FOR SELECT
  USING (
    get_current_app_role() = 'driver'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage_staff_select" ON storage.objects
  FOR SELECT
  USING (
    get_current_app_role() IN ('staff', 'admin')
  );

CREATE POLICY "storage_admin_all" ON storage.objects
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 4. TAX PROFILES (TAXES AS DATA - NOTHING HARD-CODED)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('gst', 'tds', 'tcs', 'cess', 'none')),
  rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  applies_to TEXT NOT NULL DEFAULT 'services' CHECK (applies_to IN ('all', 'goods', 'services')),
  place_of_supply_logic TEXT NOT NULL DEFAULT 'intra_state_cgst_sgst'
    CHECK (place_of_supply_logic IN ('intra_state_cgst_sgst', 'inter_state_igst', 'exempt', 'rcm')),
  sac_hsn_default TEXT DEFAULT '996601',
  is_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial tax profile examples (all editable/deletable, default "No tax")
INSERT INTO tax_profiles (id, name, tax_type, rate_percent, applies_to, place_of_supply_logic, sac_hsn_default, notes)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 'No Tax', 'none', 0.00, 'all', 'exempt', '996601', 'Default exemption profile for un-registered entities'),
  ('e1000000-0000-0000-0000-000000000002', 'GST 5% (CGST 2.5 + SGST 2.5)', 'gst', 5.00, 'services', 'intra_state_cgst_sgst', '996601', 'Rent-a-cab service without Input Tax Credit (ITC) - Confirm with your CA'),
  ('e1000000-0000-0000-0000-000000000003', 'GST 12% (CGST 6 + SGST 6)', 'gst', 12.00, 'services', 'intra_state_cgst_sgst', '996601', 'Passenger transport with Input Tax Credit (ITC) - Confirm with your CA'),
  ('e1000000-0000-0000-0000-000000000004', 'GST 18% (CGST 9 + SGST 9)', 'gst', 18.00, 'services', 'intra_state_cgst_sgst', '996601', 'Standard business support services - Confirm with your CA'),
  ('e1000000-0000-0000-0000-000000000005', 'TDS 194C 1% (Individual/Proprietor)', 'tds', 1.00, 'services', 'exempt', '996601', 'Contractor payment withholding for individual deductees'),
  ('e1000000-0000-0000-0000-000000000006', 'TDS 194C 2% (Company/Corporate)', 'tds', 2.00, 'services', 'exempt', '996601', 'Contractor payment withholding for corporate deductees')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_tax_profiles_all ON tax_profiles;
DROP POLICY IF EXISTS staff_tax_profiles_select ON tax_profiles;

CREATE POLICY admin_tax_profiles_all ON tax_profiles
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

CREATE POLICY staff_tax_profiles_select ON tax_profiles
  FOR SELECT
  USING (get_current_app_role() IN ('staff', 'admin'));

-- ------------------------------------------------------------------------------
-- 5. ITEM CATALOGUE (SAVED SERVICES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_catalogue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_unit TEXT NOT NULL DEFAULT 'trip' CHECK (default_unit IN ('trip', 'km', 'hr', 'day', 'month', 'fixed', 'item')),
  default_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_profile_id UUID REFERENCES tax_profiles(id) ON DELETE SET NULL,
  sac_hsn TEXT DEFAULT '996601',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed item catalogue examples
INSERT INTO item_catalogue (id, supplier_id, name, description, default_unit, default_rate, tax_profile_id, sac_hsn)
VALUES
  ('f1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Fixed Monthly Rental (Sedan)', 'Monthly contract car rental with included km and hours', 'month', 65000.00, 'e1000000-0000-0000-0000-000000000001', '996601'),
  ('f1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Airport Transfer (Trivandrum TRV)', 'One-way pickup or drop to Trivandrum International Airport', 'trip', 1200.00, 'e1000000-0000-0000-0000-000000000001', '996601'),
  ('f1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'City Package (8h / 80km)', 'Trivandrum city local usage up to 8 hours and 80 km', 'day', 2400.00, 'e1000000-0000-0000-0000-000000000001', '996601'),
  ('f1000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Outstation Running per KM', 'Per kilometer rate for trips outside Trivandrum city limits', 'km', 16.00, 'e1000000-0000-0000-0000-000000000001', '996601'),
  ('f1000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Extra Hour Charges', 'Hourly detention / run charges beyond daily allowance (per minute pro-rata)', 'hr', 150.00, 'e1000000-0000-0000-0000-000000000001', '996601'),
  ('f1000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'Night Bata Allowance', 'Driver night stay or early/late duty allowance', 'day', 200.00, 'e1000000-0000-0000-0000-000000000001', '996601')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE item_catalogue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_item_catalogue_all ON item_catalogue;
DROP POLICY IF EXISTS staff_item_catalogue_all ON item_catalogue;

CREATE POLICY admin_item_catalogue_all ON item_catalogue
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

CREATE POLICY staff_item_catalogue_all ON item_catalogue
  FOR ALL
  USING (get_current_app_role() IN ('staff', 'admin'))
  WITH CHECK (get_current_app_role() IN ('staff', 'admin'));

-- ------------------------------------------------------------------------------
-- 6. INVOICE TYPES & NUMBERING SERIES SUPPORT
-- Types: tax_invoice, bill_of_supply, proforma, trip_sheet, agent_plain,
--        credit_note, debit_note, receipt_voucher, quotation
-- ------------------------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'tax_invoice';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_profile_id UUID REFERENCES tax_profiles(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;

-- Customer table enhancement for TDS default & PAN entity category
ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_tds_rate NUMERIC(5, 2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pan_category TEXT;

-- Seed default TDS rate for VTL (Corporate 2% Sec 194C)
UPDATE customers
SET default_tds_rate = 2.00, pan_category = 'Company / Corporate (Sec 194C @ 2%)'
WHERE id = 'c0000000-0000-0000-0000-000000000001';

-- Grants to starciti_app
GRANT SELECT, INSERT, UPDATE, DELETE ON tax_profiles TO starciti_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON item_catalogue TO starciti_app;
