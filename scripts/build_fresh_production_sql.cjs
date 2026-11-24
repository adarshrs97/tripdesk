/**
 * scripts/build_fresh_production_sql.cjs
 * Generates the definitive scripts/fresh_production_database.sql
 * by combining the verified DDL from the live database with minimal real seeds.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.resolve(__dirname, 'fresh_production_database.sql');

console.log('Generating fresh production database DDL from supabase_db_starcity...');

// 1. Dump DDL schema using pg_dump with --clean --if-exists
const dumpCmd = 'docker exec supabase_db_starcity pg_dump -U postgres -d postgres -n public --schema-only --no-owner --no-privileges --clean --if-exists';
let schemaSql = execSync(dumpCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

// Remove psql meta-commands (like \restrict, \unrestrict) that fail when run via SQL client
schemaSql = schemaSql.replace(/^\\[a-zA-Z]+[^\r\n]*/gm, '');
// Never drop the public schema itself
schemaSql = schemaSql.replace(/DROP SCHEMA IF EXISTS public[^\r\n]*;/g, '');
schemaSql = schemaSql.replace(/CREATE SCHEMA public;/g, 'CREATE SCHEMA IF NOT EXISTS public;');
// Always ensure search_path is public so unqualified function statements find public tables
schemaSql = schemaSql.replace(/SELECT pg_catalog\.set_config\('search_path', '', false\);/g, 'SET search_path = public;');
schemaSql = schemaSql.replace(/INSERT INTO audit_logs/g, 'INSERT INTO public.audit_logs');
// Remove PostgreSQL 17-specific settings for backwards compatibility with PostgreSQL 15/16
schemaSql = schemaSql.replace(/SET transaction_timeout = 0;[^\r\n]*/g, '');

// Ensure function drops cascade so dependent policies don't block drop
schemaSql = schemaSql.replace(/DROP FUNCTION IF EXISTS ([^;\r\n]+);/g, 'DROP FUNCTION IF EXISTS $1 CASCADE;');

const HEADER = `-- ==============================================================================
-- STARCITI FLEET DESK - FRESH PRODUCTION DATABASE DDL & MINIMAL REAL SEEDS
-- Version: 1.0.0 (Production Release)
-- Target: Self-Hosted PostgreSQL / Supabase Container
--
-- INVARIANTS:
-- 1. ZERO sample data rows (is_sample_data = FALSE on all seeds).
-- 2. ZERO invoices (starts fresh with 0 invoices).
-- 3. ZERO trip ledger entries (starts fresh with 0 trips).
-- 4. Minimal REAL seeds ONLY (2 confirmed suppliers, 2 confirmed customers, 4 vehicles, 4 drivers).
-- 5. Full Row Level Security (RLS) FORCED on all tables.
-- 6. Immutability triggers active on locked trips and invoices.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Minimal GoTrue Auth schema for standalone or clean Postgres deployments
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid PRIMARY KEY,
  aud varchar(255),
  role varchar(255),
  email varchar(255) UNIQUE,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255) DEFAULT '',
  confirmation_sent_at timestamptz,
  recovery_token varchar(255) DEFAULT '',
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255) DEFAULT '',
  email_change varchar(255) DEFAULT '',
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  is_super_admin boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  phone text DEFAULT NULL,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT '',
  phone_change_token varchar(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz,
  email_change_token_current varchar(255) DEFAULT '',
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean DEFAULT false NOT NULL,
  deleted_at timestamptz,
  is_anonymous boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.identities (
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data jsonb NOT NULL,
  provider text NOT NULL,
  last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  email text GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED,
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider)
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$ LANGUAGE sql STABLE;

-- Ensure application and Supabase roles exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starciti_app') THEN
    CREATE ROLE starciti_app LOGIN PASSWORD 'postgres';
  END IF;
END $$;

`;

const SEEDS = `
-- ==============================================================================
-- MINIMAL REAL PRODUCTION SEEDS (CONFIRMED PROVENANCE ONLY)
-- ==============================================================================

-- 1. Real Suppliers (The 2 Operating Entities)
INSERT INTO public.supplier_profiles (
  id, trade_name, legal_name, address, city, state, pincode,
  phone, secondary_phone, email, pan, gstin, sac_code,
  bank_name, account_number, ifsc, upi_id, invoice_prefix, promo_text, is_default
) VALUES 
  (
    'a0000000-0000-0000-0000-000000000002',
    'City Tours & Travels',
    'M/s City Tours & Travels',
    'Tc 82/2069(2), Ambujavilasam Road, Pulimoodu Junction',
    'Trivandrum',
    'Kerala',
    '695001',
    '+91 94470 12345',
    NULL,
    'citytoursindia@yahoo.com',
    'AAYPR6184C',
    '32AAYPR6184C1ZQ',
    '996601',
    NULL, NULL, NULL, NULL,
    '108',
    'Corporate Long-Term Staff & Executive Transit Specialists',
    FALSE
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    'StarCiti Group',
    'StarCiti Group',
    'Tc 82/2069(2), Ambujavilasam Road, Pulimoodu Junction',
    'Trivandrum',
    'Kerala',
    '695001',
    '+91 94470 12345',
    NULL,
    'citytoursindia@yahoo.com',
    'AAYPR6184C',
    '32AAYPR6184C1ZQ',
    '996601',
    NULL, NULL, NULL, NULL,
    'STC',
    '24x7 Cab & Luxury Tourist Services across South India',
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  trade_name = EXCLUDED.trade_name,
  legal_name = EXCLUDED.legal_name,
  invoice_prefix = EXCLUDED.invoice_prefix;

-- 2. Real Customers (Confirmed From Owner Invoices & Photos)
INSERT INTO public.customers (
  id, name, customer_type, billing_address, city, state, pincode,
  pan, gstin, contact_person, phone, default_supplier_id, default_invoice_format,
  approval_token, is_sample_data, is_active
) VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'M/s Vindhya Telelinks Ltd',
    'corporate',
    'CC No. 40/1072A, PRG-59, North Janatha Road, Palarivattom, Cochin',
    'Ernakulam',
    'Kerala',
    '682025',
    'AAACV7757J',
    '32AAACV7757J2Z0',
    NULL,
    NULL,
    'a0000000-0000-0000-0000-000000000002',
    'F2',
    'token-vtl-approval-2026',
    FALSE,
    TRUE
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Global Public School',
    'school',
    'Technopark phase 3 campus, Kulathoor',
    'Trivandrum',
    'Kerala',
    '695583',
    NULL,
    NULL,
    NULL,
    NULL,
    'a0000000-0000-0000-0000-000000000001',
    'F1',
    'token-gps-approval-2026',
    FALSE,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_sample_data = FALSE,
  is_active = TRUE;

-- 3. Real Fleet Vehicles (4 Confirmed Vehicles; KL 74 E 3694 vehicle_type is strictly NULL/blank)
INSERT INTO public.vehicles (
  id, reg_no, display_reg_no, make_model, vehicle_type, seats, ownership,
  current_odometer, km_gap_threshold, fuel_type, min_efficiency, max_efficiency,
  service_interval_km, is_sample_data, is_active
) VALUES 
  (
    '10000000-0000-0000-0000-000000000001',
    'KL01CP3284',
    'KL-01-CP-3284',
    '7-Seat AC Car',
    'sedan',
    7,
    'owned',
    60000,
    15,
    'diesel',
    12.0,
    18.0,
    10000,
    FALSE,
    TRUE
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'KL824889',
    'KL-82-4889',
    'Traveller',
    'tempo_traveller',
    17,
    'owned',
    80000,
    15,
    'diesel',
    9.0,
    14.0,
    10000,
    FALSE,
    TRUE
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'KL74E3694',
    'KL-74-E-3694',
    NULL,
    NULL,
    5,
    'owned',
    110000,
    15,
    'diesel',
    14.0,
    22.0,
    10000,
    FALSE,
    TRUE
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'KL21M2378',
    'KL-21-M-2378',
    'Dzire',
    'sedan',
    5,
    'owned',
    120000,
    15,
    'diesel',
    14.0,
    22.0,
    10000,
    FALSE,
    TRUE
  )
ON CONFLICT (reg_no) DO UPDATE SET
  make_model = EXCLUDED.make_model,
  vehicle_type = EXCLUDED.vehicle_type,
  is_sample_data = FALSE,
  is_active = TRUE;

-- 4. Real Drivers (4 Confirmed Drivers)
INSERT INTO public.drivers (
  id, name, phone, driver_type, license_no, license_expiry, badge_no,
  police_clearance_date, daily_bata_rate, is_active
) VALUES 
  ('d0000000-0000-0000-0000-000000000001', 'Hemanth Kumar', '+91 94470 12345', 'permanent', NULL, NULL, NULL, NULL, NULL, TRUE),
  ('d0000000-0000-0000-0000-000000000002', 'Muhammad Fayaz.s', '+91 94470 23456', 'permanent', NULL, NULL, NULL, NULL, NULL, TRUE),
  ('d0000000-0000-0000-0000-000000000003', 'Asheerkhan', '+91 94470 34567', 'permanent', NULL, NULL, NULL, NULL, NULL, TRUE),
  ('d0000000-0000-0000-0000-000000000004', 'Afzal', '+91 94470 45678', 'temporary', NULL, NULL, NULL, NULL, NULL, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = TRUE;

-- 5. Contracts & Versioned Terms
INSERT INTO public.contracts (
  id, customer_id, supplier_id, agreement_no, agreement_date,
  valid_from, valid_to, contract_kind, invoice_format, pricing_model, status
) VALUES 
  (
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001', -- VTL
    'a0000000-0000-0000-0000-000000000002', -- City Tours
    '202526000005308395',
    '2025-11-01',
    '2025-11-01',
    '2026-09-30',
    'monthly_fixed',
    'F2',
    'monthly_fixed',
    'renewal_pending'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002', -- Global Public School
    'a0000000-0000-0000-0000-000000000001', -- StarCiti Group
    'GPS-TRV-2026-08',
    '2026-06-01',
    '2026-06-01',
    '2027-05-31',
    'per_trip_package',
    'F1',
    'per_trip_package',
    'active'
  )
ON CONFLICT (id) DO UPDATE SET
  agreement_no = EXCLUDED.agreement_no,
  status = EXCLUDED.status;

-- 6. Clean CA-Verified Tax Profiles (No tax rate advice text; Confirm with your CA)
INSERT INTO public.tax_profiles (
  id, name, tax_type, rate_percent, applies_to, place_of_supply_logic, sac_hsn_default, notes, is_active
) VALUES 
  ('e1000000-0000-0000-0000-000000000001', 'No Tax', 'none', 0.00, 'all', 'exempt', '996601', 'Confirm with your CA', TRUE),
  ('e1000000-0000-0000-0000-000000000002', 'GST 5% (CGST 2.5 + SGST 2.5)', 'gst', 5.00, 'services', 'intra_state_cgst_sgst', '996601', 'Confirm with your CA', TRUE),
  ('e1000000-0000-0000-0000-000000000003', 'GST 12% (CGST 6 + SGST 6)', 'gst', 12.00, 'services', 'intra_state_cgst_sgst', '996601', 'Confirm with your CA', TRUE),
  ('e1000000-0000-0000-0000-000000000004', 'GST 18% (CGST 9 + SGST 9)', 'gst', 18.00, 'services', 'intra_state_cgst_sgst', '996601', 'Confirm with your CA', TRUE),
  ('e1000000-0000-0000-0000-000000000005', 'TDS 194C 1% (Individual/Proprietor)', 'tds', 1.00, 'services', 'exempt', '996601', 'Confirm with your CA', TRUE),
  ('e1000000-0000-0000-0000-000000000006', 'TDS 194C 2% (Company/Corporate)', 'tds', 2.00, 'services', 'exempt', '996601', 'Confirm with your CA', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  rate_percent = EXCLUDED.rate_percent,
  notes = EXCLUDED.notes;

-- 7. Dedicated TEST Invoice Series & Empty Real Series (Awaiting Owner Inputs)
INSERT INTO public.invoice_series (supplier_id, prefix, financial_year, current_number)
VALUES 
  ('a0000000-0000-0000-0000-000000000002', '', '2026-27', 0),
  ('a0000000-0000-0000-0000-000000000001', '', '2026-27', 0),
  ('a0000000-0000-0000-0000-000000000002', 'TEST', '2026-27', 0),
  ('a0000000-0000-0000-0000-000000000001', 'TEST', '2026-27', 0)
ON CONFLICT (supplier_id, prefix, financial_year) DO NOTHING;

-- 8. Application Users (The 4 Real Operational Roles)
INSERT INTO public.app_users (id, email, phone, name, role, is_active, driver_id, customer_id)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'ratnaraaj@yahoo.com', '+91 6238603200', 'M. Ratnaraj', 'admin', TRUE, NULL, NULL),
  ('c0000000-0000-0000-0000-000000000002', 'operations@starciti.com', '+91 8136910938', 'Office Operations Staff', 'staff', TRUE, NULL, NULL),
  ('c0000000-0000-0000-0000-000000000003', 'hemanth@starciti.com', '+91 9447123456', 'Hemanth Kumar', 'driver', TRUE, 'd0000000-0000-0000-0000-000000000001', NULL),
  ('c0000000-0000-0000-0000-000000000004', 'admin@vindhyatelelinks.com', '+91 9846012345', 'VTL Billing Coordinator', 'customer_viewer', TRUE, NULL, 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  driver_id = EXCLUDED.driver_id,
  customer_id = EXCLUDED.customer_id,
  is_active = EXCLUDED.is_active;

-- 9. Shared System Settings
INSERT INTO public.settings (key, scope, value, description)
VALUES 
  (
    'system.vocabulary',
    'system',
    '[
      {"key": "trip", "english": "Trip / Duty", "malayalam": "യാത്ര"},
      {"key": "vehicle", "english": "Vehicle", "malayalam": "വാഹനം"},
      {"key": "driver", "english": "Driver", "malayalam": "ഡ്രൈവർ"},
      {"key": "customer", "english": "Customer / Client", "malayalam": "കസ്റ്റമർ"},
      {"key": "invoice", "english": "Invoice / Bill", "malayalam": "ഇൻവോയ്സ്"},
      {"key": "fuel", "english": "Fuel / Diesel", "malayalam": "ഇന്ധനം / ഡീസൽ"},
      {"key": "advance", "english": "Advance Payment", "malayalam": "അഡ്വാൻസ്"},
      {"key": "bata", "english": "Driver Bata", "malayalam": "ഡ്രൈവർ ബത്ത"},
      {"key": "opening_km", "english": "Opening KM", "malayalam": "ആരംഭ കി.മീ"},
      {"key": "closing_km", "english": "Closing KM", "malayalam": "അവസാന കി.മീ"},
      {"key": "hours", "english": "Total Hours", "malayalam": "മണിക്കൂർ"},
      {"key": "toll_parking", "english": "Toll & Parking", "malayalam": "ടോൾ / പാർക്കിംഗ്"}
    ]'::jsonb,
    'Shared English and Malayalam operational labels stored in database with RLS'
  ),
  (
    'system.quote_tariffs',
    'operations',
    '{}'::jsonb,
    'Configured quote tariff rates per vehicle category and tariff model'
  ),
  (
    'system.setup_state',
    'system',
    '{"completed": false, "completed_at": null, "admin_email": null}'::jsonb,
    'Permanent lock state for the first-run setup wizard'
  ),
  (
    'system.route_tags',
    'operations',
    '["AVP", "VB", "CE", "PH", "VP", "Kachani", "Kattakada KSEB", "Kanyakumari", "Airport"]'::jsonb,
    'Quick selection tags for frequent route destinations'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- 10. Financial & Cost Allocation Settings
INSERT INTO public.financial_settings (id, allocation_rules, cost_completeness_strict)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  '{"driver_pay_method": "actual_or_daily_bata", "include_emi_in_pnl": true, "include_fuel_in_pnl": true, "default_working_days": 30, "emi_allocation_method": "actual_vehicle_emi", "include_service_in_pnl": true, "cost_completeness_strict": true, "include_driver_pay_in_pnl": true, "receivables_ageing_brackets": [30, 60, 90]}'::jsonb,
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  allocation_rules = EXCLUDED.allocation_rules,
  cost_completeness_strict = EXCLUDED.cost_completeness_strict;

-- 11. Supabase Auth Users & Identities (Active when auth schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'encrypted_password') THEN
    
    -- Admin
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'c0000000-0000-0000-0000-000000000001',
      'authenticated', 'authenticated', 'ratnaraaj@yahoo.com',
      crypt('Starciti2026!Admin', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "M. Ratnaraj", "role": "admin", "email_verified": true}',
      NOW(), NOW(), false, false,
      '', '', '', '', '', '', '', ''
    ) ON CONFLICT (id) DO UPDATE SET
      encrypted_password = crypt('Starciti2026!Admin', gen_salt('bf')),
      email_confirmed_at = NOW(),
      raw_user_meta_data = '{"name": "M. Ratnaraj", "role": "admin", "email_verified": true}',
      updated_at = NOW();

    -- Staff
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'c0000000-0000-0000-0000-000000000002',
      'authenticated', 'authenticated', 'operations@starciti.com',
      crypt('Starciti2026!Staff', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Office Operations Staff", "role": "staff", "email_verified": true}',
      NOW(), NOW(), false, false,
      '', '', '', '', '', '', '', ''
    ) ON CONFLICT (id) DO UPDATE SET
      encrypted_password = crypt('Starciti2026!Staff', gen_salt('bf')),
      email_confirmed_at = NOW(),
      raw_user_meta_data = '{"name": "Office Operations Staff", "role": "staff", "email_verified": true}',
      updated_at = NOW();

    -- Driver
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'c0000000-0000-0000-0000-000000000003',
      'authenticated', 'authenticated', 'hemanth@starciti.com',
      crypt('Starciti2026!Driver', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Hemanth Kumar", "role": "driver", "email_verified": true}',
      NOW(), NOW(), false, false,
      '', '', '', '', '', '', '', ''
    ) ON CONFLICT (id) DO UPDATE SET
      encrypted_password = crypt('Starciti2026!Driver', gen_salt('bf')),
      email_confirmed_at = NOW(),
      raw_user_meta_data = '{"name": "Hemanth Kumar", "role": "driver", "email_verified": true}',
      updated_at = NOW();

    -- Customer Viewer
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'c0000000-0000-0000-0000-000000000004',
      'authenticated', 'authenticated', 'admin@vindhyatelelinks.com',
      crypt('Starciti2026!Client', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "VTL Billing Coordinator", "role": "customer_viewer", "email_verified": true}',
      NOW(), NOW(), false, false,
      '', '', '', '', '', '', '', ''
    ) ON CONFLICT (id) DO UPDATE SET
      encrypted_password = crypt('Starciti2026!Client', gen_salt('bf')),
      email_confirmed_at = NOW(),
      raw_user_meta_data = '{"name": "VTL Billing Coordinator", "role": "customer_viewer", "email_verified": true}',
      updated_at = NOW();

    -- Identities (only if auth.identities exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
      INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
      VALUES 
        ('b9c5a82e-b082-46af-bce2-4d655b64e31d', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', json_build_object('sub', 'c0000000-0000-0000-0000-000000000001', 'email', 'ratnaraaj@yahoo.com', 'email_verified', true)::jsonb, 'email', NOW(), NOW()),
        ('b9c5a82e-b082-46af-bce2-4d655b64e32e', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', json_build_object('sub', 'c0000000-0000-0000-0000-000000000002', 'email', 'operations@starciti.com', 'email_verified', true)::jsonb, 'email', NOW(), NOW()),
        ('b9c5a82e-b082-46af-bce2-4d655b64e33f', 'c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', json_build_object('sub', 'c0000000-0000-0000-0000-000000000003', 'email', 'hemanth@starciti.com', 'email_verified', true)::jsonb, 'email', NOW(), NOW()),
        ('b9c5a82e-b082-46af-bce2-4d655b64e34a', 'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', json_build_object('sub', 'c0000000-0000-0000-0000-000000000004', 'email', 'admin@vindhyatelelinks.com', 'email_verified', true)::jsonb, 'email', NOW(), NOW())
      ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;

  END IF;
END $$;

-- Grants
GRANT USAGE ON SCHEMA public TO starciti_app, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO starciti_app, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO starciti_app, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO starciti_app, authenticated, service_role;
`;

const fullSql = HEADER + schemaSql + SEEDS;
fs.writeFileSync(OUTPUT_FILE, fullSql, 'utf-8');
console.log('[PASS] Generated ' + OUTPUT_FILE + ' (' + fullSql.length + ' bytes)');
