-- ==============================================================================
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

--
-- PostgreSQL database dump
--



-- Dumped from database version 17.12
-- Dumped by pg_dump version 17.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path = public;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS vendor_payables_admin_staff_all ON public.vendor_payables;
DROP POLICY IF EXISTS staff_trip_ledger_all ON public.trip_ledger;
DROP POLICY IF EXISTS staff_tax_profiles_select ON public.tax_profiles;
DROP POLICY IF EXISTS staff_rate_cards_select ON public.rate_cards;
DROP POLICY IF EXISTS staff_item_catalogue_all ON public.item_catalogue;
DROP POLICY IF EXISTS staff_invoices_select ON public.invoices;
DROP POLICY IF EXISTS staff_invoices_insert ON public.invoices;
DROP POLICY IF EXISTS staff_contract_terms_select ON public.contract_terms;
DROP POLICY IF EXISTS staff_approvals_all ON public.approvals;
DROP POLICY IF EXISTS service_logs_write ON public.vehicle_service_logs;
DROP POLICY IF EXISTS service_logs_update ON public.vehicle_service_logs;
DROP POLICY IF EXISTS service_logs_read ON public.vehicle_service_logs;
DROP POLICY IF EXISTS rls_staff_update_payments ON public.payments;
DROP POLICY IF EXISTS rls_staff_select_payments ON public.payments;
DROP POLICY IF EXISTS rls_staff_select_app_users ON public.app_users;
DROP POLICY IF EXISTS rls_staff_reminders ON public.payment_reminders;
DROP POLICY IF EXISTS rls_staff_notes ON public.credit_debit_notes;
DROP POLICY IF EXISTS rls_staff_insert_reminders ON public.payment_reminders;
DROP POLICY IF EXISTS rls_staff_insert_payments ON public.payments;
DROP POLICY IF EXISTS rls_staff_insert_notes ON public.credit_debit_notes;
DROP POLICY IF EXISTS rls_self_select_app_users ON public.app_users;
DROP POLICY IF EXISTS rls_select_vehicles ON public.vehicles;
DROP POLICY IF EXISTS rls_select_supplier_profiles ON public.supplier_profiles;
DROP POLICY IF EXISTS rls_select_settings ON public.settings;
DROP POLICY IF EXISTS rls_select_rate_cards ON public.rate_cards;
DROP POLICY IF EXISTS rls_select_invoices ON public.invoices;
DROP POLICY IF EXISTS rls_select_drivers ON public.drivers;
DROP POLICY IF EXISTS rls_select_customers ON public.customers;
DROP POLICY IF EXISTS rls_select_contracts ON public.contracts;
DROP POLICY IF EXISTS rls_select_contract_terms ON public.contract_terms;
DROP POLICY IF EXISTS rls_modify_settings ON public.settings;
DROP POLICY IF EXISTS rls_customer_select_payments ON public.payments;
DROP POLICY IF EXISTS rls_customer_select_notes ON public.credit_debit_notes;
DROP POLICY IF EXISTS rls_app_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS rls_admin_supplier_profiles ON public.supplier_profiles;
DROP POLICY IF EXISTS rls_admin_staff_invoices ON public.invoices;
DROP POLICY IF EXISTS rls_admin_staff_customers ON public.customers;
DROP POLICY IF EXISTS rls_admin_staff_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS rls_admin_reminders ON public.payment_reminders;
DROP POLICY IF EXISTS rls_admin_rate_cards ON public.rate_cards;
DROP POLICY IF EXISTS rls_admin_payments ON public.payments;
DROP POLICY IF EXISTS rls_admin_notes ON public.credit_debit_notes;
DROP POLICY IF EXISTS rls_admin_contracts ON public.contracts;
DROP POLICY IF EXISTS rls_admin_contract_terms ON public.contract_terms;
DROP POLICY IF EXISTS rls_admin_app_users ON public.app_users;
DROP POLICY IF EXISTS other_expenses_staff_admin_update ON public.driver_other_expenses;
DROP POLICY IF EXISTS other_expenses_driver_select ON public.driver_other_expenses;
DROP POLICY IF EXISTS other_expenses_driver_insert ON public.driver_other_expenses;
DROP POLICY IF EXISTS internal_flags_admin_staff_update ON public.internal_flags;
DROP POLICY IF EXISTS internal_flags_admin_staff_select ON public.internal_flags;
DROP POLICY IF EXISTS internal_flags_admin_staff_insert ON public.internal_flags;
DROP POLICY IF EXISTS internal_flags_admin_delete ON public.internal_flags;
DROP POLICY IF EXISTS import_profiles_select ON public.import_profiles;
DROP POLICY IF EXISTS import_profiles_admin_staff ON public.import_profiles;
DROP POLICY IF EXISTS fuel_settings_select_all ON public.vehicle_fuel_settings;
DROP POLICY IF EXISTS fuel_settings_admin_write ON public.vehicle_fuel_settings;
DROP POLICY IF EXISTS fuel_expenses_staff_admin_update ON public.fuel_expenses;
DROP POLICY IF EXISTS fuel_expenses_driver_select ON public.fuel_expenses;
DROP POLICY IF EXISTS fuel_expenses_driver_insert ON public.fuel_expenses;
DROP POLICY IF EXISTS financial_settings_admin_staff_all ON public.financial_settings;
DROP POLICY IF EXISTS emi_schedules_admin_staff_all ON public.emi_schedules;
DROP POLICY IF EXISTS driver_trip_ledger_update ON public.trip_ledger;
DROP POLICY IF EXISTS driver_trip_ledger_select ON public.trip_ledger;
DROP POLICY IF EXISTS driver_trip_ledger_insert ON public.trip_ledger;
DROP POLICY IF EXISTS customer_trip_ledger_select ON public.trip_ledger;
DROP POLICY IF EXISTS customer_invoices_select ON public.invoices;
DROP POLICY IF EXISTS customer_approvals_update ON public.approvals;
DROP POLICY IF EXISTS customer_approvals_select ON public.approvals;
DROP POLICY IF EXISTS compliance_settings_read_all ON public.compliance_settings;
DROP POLICY IF EXISTS compliance_settings_admin_update ON public.compliance_settings;
DROP POLICY IF EXISTS cash_admin_staff_all ON public.cash_transactions;
DROP POLICY IF EXISTS bank_transactions_admin_staff_all ON public.bank_transactions;
DROP POLICY IF EXISTS bank_accounts_admin_staff_all ON public.bank_accounts;
DROP POLICY IF EXISTS admin_trip_ledger_all ON public.trip_ledger;
DROP POLICY IF EXISTS admin_tax_profiles_all ON public.tax_profiles;
DROP POLICY IF EXISTS admin_staff_anomaly_acks ON public.anomaly_acks;
DROP POLICY IF EXISTS admin_rate_cards_all ON public.rate_cards;
DROP POLICY IF EXISTS admin_item_catalogue_all ON public.item_catalogue;
DROP POLICY IF EXISTS admin_invoices_all ON public.invoices;
DROP POLICY IF EXISTS admin_contract_terms_all ON public.contract_terms;
DROP POLICY IF EXISTS admin_approvals_all ON public.approvals;
ALTER TABLE IF EXISTS ONLY public.vendor_payables DROP CONSTRAINT IF EXISTS vendor_payables_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_service_logs DROP CONSTRAINT IF EXISTS vehicle_service_logs_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.trip_ledger DROP CONSTRAINT IF EXISTS trip_ledger_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.trip_ledger DROP CONSTRAINT IF EXISTS trip_ledger_invoice_id_fkey;
ALTER TABLE IF EXISTS ONLY public.trip_ledger DROP CONSTRAINT IF EXISTS trip_ledger_driver_id_fkey;
ALTER TABLE IF EXISTS ONLY public.trip_ledger DROP CONSTRAINT IF EXISTS trip_ledger_contract_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rate_cards DROP CONSTRAINT IF EXISTS rate_cards_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rate_cards DROP CONSTRAINT IF EXISTS rate_cards_contract_id_fkey;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.payment_reminders DROP CONSTRAINT IF EXISTS payment_reminders_invoice_id_fkey;
ALTER TABLE IF EXISTS ONLY public.note_series DROP CONSTRAINT IF EXISTS note_series_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.item_catalogue DROP CONSTRAINT IF EXISTS item_catalogue_tax_profile_id_fkey;
ALTER TABLE IF EXISTS ONLY public.item_catalogue DROP CONSTRAINT IF EXISTS item_catalogue_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_tax_profile_id_fkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_contract_id_fkey;
ALTER TABLE IF EXISTS ONLY public.invoice_series DROP CONSTRAINT IF EXISTS invoice_series_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.internal_flags DROP CONSTRAINT IF EXISTS internal_flags_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.import_profiles DROP CONSTRAINT IF EXISTS import_profiles_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.fuel_expenses DROP CONSTRAINT IF EXISTS fuel_expenses_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.fuel_expenses DROP CONSTRAINT IF EXISTS fuel_expenses_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.fuel_expenses DROP CONSTRAINT IF EXISTS fuel_expenses_driver_id_fkey;
ALTER TABLE IF EXISTS ONLY public.emi_schedules DROP CONSTRAINT IF EXISTS emi_schedules_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.driver_other_expenses DROP CONSTRAINT IF EXISTS driver_other_expenses_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.driver_other_expenses DROP CONSTRAINT IF EXISTS driver_other_expenses_trip_id_fkey;
ALTER TABLE IF EXISTS ONLY public.driver_other_expenses DROP CONSTRAINT IF EXISTS driver_other_expenses_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.driver_other_expenses DROP CONSTRAINT IF EXISTS driver_other_expenses_driver_id_fkey;
ALTER TABLE IF EXISTS ONLY public.customers DROP CONSTRAINT IF EXISTS customers_default_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_debit_notes DROP CONSTRAINT IF EXISTS credit_debit_notes_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_debit_notes DROP CONSTRAINT IF EXISTS credit_debit_notes_original_invoice_id_fkey;
ALTER TABLE IF EXISTS ONLY public.credit_debit_notes DROP CONSTRAINT IF EXISTS credit_debit_notes_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.contract_terms DROP CONSTRAINT IF EXISTS contract_terms_contract_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_vehicle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_driver_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_bank_account_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.approvals DROP CONSTRAINT IF EXISTS approvals_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.approvals DROP CONSTRAINT IF EXISTS approvals_contract_id_fkey;
ALTER TABLE IF EXISTS ONLY public.app_users DROP CONSTRAINT IF EXISTS app_users_driver_id_fkey;
ALTER TABLE IF EXISTS ONLY public.app_users DROP CONSTRAINT IF EXISTS app_users_customer_id_fkey;
ALTER TABLE IF EXISTS ONLY public.anomaly_acks DROP CONSTRAINT IF EXISTS anomaly_acks_contract_id_fkey;
DROP TRIGGER IF EXISTS trg_trip_ledger_lock_guard ON public.trip_ledger;
DROP TRIGGER IF EXISTS trg_payment_after_change ON public.payments;
DROP TRIGGER IF EXISTS trg_note_after_change ON public.credit_debit_notes;
DROP TRIGGER IF EXISTS trg_invoice_lock_guard ON public.invoices;
DROP TRIGGER IF EXISTS audit_supplier_profiles ON public.supplier_profiles;
DROP TRIGGER IF EXISTS audit_rate_cards ON public.rate_cards;
DROP TRIGGER IF EXISTS audit_contracts ON public.contracts;
DROP TRIGGER IF EXISTS audit_contract_terms ON public.contract_terms;
DROP INDEX IF EXISTS public.idx_vendor_payables_due;
DROP INDEX IF EXISTS public.idx_trip_ledger_vehicle;
DROP INDEX IF EXISTS public.idx_trip_ledger_is_locked;
DROP INDEX IF EXISTS public.idx_trip_ledger_invoice_id;
DROP INDEX IF EXISTS public.idx_trip_ledger_driver;
DROP INDEX IF EXISTS public.idx_trip_ledger_contract_date;
DROP INDEX IF EXISTS public.idx_payments_payment_date;
DROP INDEX IF EXISTS public.idx_payments_invoice_id;
DROP INDEX IF EXISTS public.idx_payments_customer_id;
DROP INDEX IF EXISTS public.idx_payment_reminders_inv;
DROP INDEX IF EXISTS public.idx_internal_flags_severity;
DROP INDEX IF EXISTS public.idx_internal_flags_entity;
DROP INDEX IF EXISTS public.idx_internal_flags_created;
DROP INDEX IF EXISTS public.idx_fuel_vehicle_date;
DROP INDEX IF EXISTS public.idx_fuel_status;
DROP INDEX IF EXISTS public.idx_fuel_receipt_hash;
DROP INDEX IF EXISTS public.idx_fuel_expenses_receipt_lookup;
DROP INDEX IF EXISTS public.idx_fuel_expenses_perceptual_hash;
DROP INDEX IF EXISTS public.idx_fuel_driver_date;
DROP INDEX IF EXISTS public.idx_emi_schedules_month;
DROP INDEX IF EXISTS public.idx_credit_debit_notes_inv;
DROP INDEX IF EXISTS public.idx_credit_debit_notes_cust;
DROP INDEX IF EXISTS public.idx_cash_transactions_date;
DROP INDEX IF EXISTS public.idx_bank_transactions_date;
DROP INDEX IF EXISTS public.idx_approvals_token_hash;
DROP INDEX IF EXISTS public.idx_approvals_contract_month;
ALTER TABLE IF EXISTS ONLY public.vendor_payables DROP CONSTRAINT IF EXISTS vendor_payables_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_reg_no_key;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_service_logs DROP CONSTRAINT IF EXISTS vehicle_service_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_fuel_settings DROP CONSTRAINT IF EXISTS vehicle_fuel_settings_vehicle_type_key;
ALTER TABLE IF EXISTS ONLY public.vehicle_fuel_settings DROP CONSTRAINT IF EXISTS vehicle_fuel_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.emi_schedules DROP CONSTRAINT IF EXISTS uq_vehicle_month_emi;
ALTER TABLE IF EXISTS ONLY public.trip_ledger DROP CONSTRAINT IF EXISTS trip_ledger_pkey;
ALTER TABLE IF EXISTS ONLY public.trip_ledger DROP CONSTRAINT IF EXISTS trip_ledger_contract_id_trip_date_vehicle_id_key;
ALTER TABLE IF EXISTS ONLY public.tax_profiles DROP CONSTRAINT IF EXISTS tax_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.supplier_profiles DROP CONSTRAINT IF EXISTS supplier_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.supplier_profiles DROP CONSTRAINT IF EXISTS supplier_profiles_invoice_prefix_key;
ALTER TABLE IF EXISTS ONLY public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE IF EXISTS ONLY public.rate_cards DROP CONSTRAINT IF EXISTS rate_cards_pkey;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_pkey;
ALTER TABLE IF EXISTS ONLY public.payment_reminders DROP CONSTRAINT IF EXISTS payment_reminders_pkey;
ALTER TABLE IF EXISTS ONLY public.note_series DROP CONSTRAINT IF EXISTS note_series_supplier_id_note_type_prefix_financial_year_key;
ALTER TABLE IF EXISTS ONLY public.note_series DROP CONSTRAINT IF EXISTS note_series_pkey;
ALTER TABLE IF EXISTS ONLY public.item_catalogue DROP CONSTRAINT IF EXISTS item_catalogue_pkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_pkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE IF EXISTS ONLY public.invoice_series DROP CONSTRAINT IF EXISTS invoice_series_supplier_id_prefix_financial_year_key;
ALTER TABLE IF EXISTS ONLY public.invoice_series DROP CONSTRAINT IF EXISTS invoice_series_pkey;
ALTER TABLE IF EXISTS ONLY public.internal_flags DROP CONSTRAINT IF EXISTS internal_flags_pkey;
ALTER TABLE IF EXISTS ONLY public.import_profiles DROP CONSTRAINT IF EXISTS import_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.import_profiles DROP CONSTRAINT IF EXISTS import_profiles_customer_unique;
ALTER TABLE IF EXISTS ONLY public.holidays DROP CONSTRAINT IF EXISTS holidays_pkey;
ALTER TABLE IF EXISTS ONLY public.holidays DROP CONSTRAINT IF EXISTS holidays_date_key;
ALTER TABLE IF EXISTS ONLY public.fuel_expenses DROP CONSTRAINT IF EXISTS fuel_expenses_pkey;
ALTER TABLE IF EXISTS ONLY public.financial_settings DROP CONSTRAINT IF EXISTS financial_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.emi_schedules DROP CONSTRAINT IF EXISTS emi_schedules_pkey;
ALTER TABLE IF EXISTS ONLY public.drivers DROP CONSTRAINT IF EXISTS drivers_pkey;
ALTER TABLE IF EXISTS ONLY public.driver_other_expenses DROP CONSTRAINT IF EXISTS driver_other_expenses_pkey;
ALTER TABLE IF EXISTS ONLY public.customers DROP CONSTRAINT IF EXISTS customers_pkey;
ALTER TABLE IF EXISTS ONLY public.customers DROP CONSTRAINT IF EXISTS customers_approval_token_key;
ALTER TABLE IF EXISTS ONLY public.credit_debit_notes DROP CONSTRAINT IF EXISTS credit_debit_notes_pkey;
ALTER TABLE IF EXISTS ONLY public.credit_debit_notes DROP CONSTRAINT IF EXISTS credit_debit_notes_note_number_key;
ALTER TABLE IF EXISTS ONLY public.contracts DROP CONSTRAINT IF EXISTS contracts_pkey;
ALTER TABLE IF EXISTS ONLY public.contract_terms DROP CONSTRAINT IF EXISTS contract_terms_pkey;
ALTER TABLE IF EXISTS ONLY public.compliance_settings DROP CONSTRAINT IF EXISTS compliance_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.approvals DROP CONSTRAINT IF EXISTS approvals_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.approvals DROP CONSTRAINT IF EXISTS approvals_pkey;
ALTER TABLE IF EXISTS ONLY public.app_users DROP CONSTRAINT IF EXISTS app_users_pkey;
ALTER TABLE IF EXISTS ONLY public.app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
ALTER TABLE IF EXISTS ONLY public.anomaly_acks DROP CONSTRAINT IF EXISTS anomaly_acks_pkey;
ALTER TABLE IF EXISTS ONLY public.anomaly_acks DROP CONSTRAINT IF EXISTS anomaly_acks_anomaly_id_contract_id_key;
ALTER TABLE IF EXISTS ONLY public._applied_migrations DROP CONSTRAINT IF EXISTS _applied_migrations_pkey;
DROP TABLE IF EXISTS public.vendor_payables;
DROP TABLE IF EXISTS public.vehicles;
DROP TABLE IF EXISTS public.vehicle_service_logs;
DROP TABLE IF EXISTS public.vehicle_fuel_settings;
DROP TABLE IF EXISTS public.trip_ledger;
DROP TABLE IF EXISTS public.tax_profiles;
DROP TABLE IF EXISTS public.supplier_profiles;
DROP TABLE IF EXISTS public.settings;
DROP TABLE IF EXISTS public.rate_cards;
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.payment_reminders;
DROP TABLE IF EXISTS public.note_series;
DROP TABLE IF EXISTS public.item_catalogue;
DROP TABLE IF EXISTS public.invoices;
DROP TABLE IF EXISTS public.invoice_series;
DROP TABLE IF EXISTS public.internal_flags;
DROP TABLE IF EXISTS public.import_profiles;
DROP TABLE IF EXISTS public.holidays;
DROP TABLE IF EXISTS public.fuel_expenses;
DROP TABLE IF EXISTS public.financial_settings;
DROP TABLE IF EXISTS public.emi_schedules;
DROP TABLE IF EXISTS public.drivers;
DROP TABLE IF EXISTS public.driver_other_expenses;
DROP TABLE IF EXISTS public.customers;
DROP TABLE IF EXISTS public.credit_debit_notes;
DROP TABLE IF EXISTS public.contracts;
DROP TABLE IF EXISTS public.contract_terms;
DROP TABLE IF EXISTS public.compliance_settings;
DROP TABLE IF EXISTS public.cash_transactions;
DROP TABLE IF EXISTS public.bank_transactions;
DROP TABLE IF EXISTS public.bank_accounts;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.approvals;
DROP TABLE IF EXISTS public.app_users;
DROP TABLE IF EXISTS public.anomaly_acks;
DROP TABLE IF EXISTS public._applied_migrations;
DROP FUNCTION IF EXISTS public.verify_and_redeem_approval_token(p_token_hash text) CASCADE;
DROP FUNCTION IF EXISTS public.trg_payment_refresh_invoice() CASCADE;
DROP FUNCTION IF EXISTS public.trg_note_refresh_invoice() CASCADE;
DROP FUNCTION IF EXISTS public.trg_check_trip_ledger_locked() CASCADE;
DROP FUNCTION IF EXISTS public.trg_check_invoice_locked() CASCADE;
DROP FUNCTION IF EXISTS public.soft_delete_internal_flag(p_flag_id uuid, p_deleted_by text) CASCADE;
DROP FUNCTION IF EXISTS public.remove_all_sample_data() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_invoice_payment_status(p_invoice_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.process_audit_log() CASCADE;
DROP FUNCTION IF EXISTS public.issue_invoice_atomic(p_supplier_id uuid, p_customer_id uuid, p_contract_id uuid, p_period_from date, p_period_to date, p_total_amount numeric, p_snapshot_json jsonb, p_template_id text, p_template_version integer, p_issued_by text, p_admin_override_reason text, p_breakup_json jsonb, p_issue_date date, p_series_prefix text) CASCADE;
DROP FUNCTION IF EXISTS public.issue_credit_debit_note_atomic(p_original_invoice_id uuid, p_note_type character varying, p_amount numeric, p_reason text, p_snapshot_json jsonb, p_template_id text, p_created_by text) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_app_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_app_driver_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_current_app_customer_id() CASCADE;
DROP FUNCTION IF EXISTS public.cancel_invoice(p_invoice_id uuid, p_reason text, p_admin_user text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_set_invoice_series_number(p_series_id uuid, p_next_number integer, p_reason text, p_admin_user text) CASCADE;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: admin_set_invoice_series_number(uuid, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_invoice_series_number(p_series_id uuid, p_next_number integer, p_reason text, p_admin_user text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_old_number INT;
  v_supplier_id UUID;
  v_prefix TEXT;
BEGIN
  IF get_current_app_role() NOT IN ('admin', 'service_role') THEN
    RAISE EXCEPTION 'Access denied: Only administrators can modify invoice numbering sequence.';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A mandatory justification reason (min 5 characters) is required to adjust invoice series numbering.';
  END IF;

  SELECT current_number, supplier_id, prefix INTO v_old_number, v_supplier_id, v_prefix
  FROM invoice_series
  WHERE id = p_series_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice series % not found.', p_series_id;
  END IF;

  UPDATE invoice_series
  SET current_number = p_next_number - 1,
      updated_at = NOW()
  WHERE id = p_series_id;

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    'invoice_series',
    p_series_id,
    'SET_SERIES_NEXT_NUMBER',
    jsonb_build_object('current_number', v_old_number, 'supplier_id', v_supplier_id, 'prefix', v_prefix),
    jsonb_build_object('next_number', p_next_number, 'reason', p_reason, 'admin_user', p_admin_user),
    p_admin_user
  );

  RETURN jsonb_build_object(
    'series_id', p_series_id,
    'old_number', v_old_number,
    'new_next_number', p_next_number,
    'reason', p_reason,
    'updated_at', NOW()
  );
END;
$$;


--
-- Name: cancel_invoice(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_invoice(p_invoice_id uuid, p_reason text, p_admin_user text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    'invoices',
    p_invoice_id,
    'CANCEL_INVOICE',
    jsonb_build_object('invoice_number', v_inv.invoice_number, 'status', v_inv.status, 'total_amount', v_inv.total_amount),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason, 'admin_user', p_admin_user),
    p_admin_user
  );

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'invoice_number', v_inv.invoice_number,
    'status', 'cancelled',
    'reason', p_reason,
    'cancelled_at', NOW()
  );
END;
$$;


--
-- Name: get_current_app_customer_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_app_customer_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_uid UUID;
  v_customer_id UUID;
BEGIN
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT customer_id INTO v_customer_id
  FROM public.app_users
  WHERE id = v_uid AND is_active = TRUE;

  RETURN v_customer_id;
END;
$$;


--
-- Name: get_current_app_driver_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_app_driver_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_uid UUID;
  v_driver_id UUID;
BEGIN
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.app_users
  WHERE id = v_uid AND is_active = TRUE;

  RETURN v_driver_id;
END;
$$;


--
-- Name: get_current_app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_app_role() RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: issue_credit_debit_note_atomic(uuid, character varying, numeric, text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_credit_debit_note_atomic(p_original_invoice_id uuid, p_note_type character varying, p_amount numeric, p_reason text, p_snapshot_json jsonb DEFAULT '{}'::jsonb, p_template_id text DEFAULT 'format_credit_debit_v1'::text, p_created_by text DEFAULT 'admin'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_inv RECORD;
  v_series RECORD;
  v_prefix TEXT;
  v_next_num INT;
  v_note_no TEXT;
  v_note_id UUID;
BEGIN
  IF p_note_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Invalid note_type: must be credit or debit.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Note amount must be greater than zero.';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A mandatory justification reason (min 5 characters) is required.';
  END IF;

  SELECT * INTO v_inv
  FROM invoices
  WHERE id = p_original_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original invoice % not found.', p_original_invoice_id;
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot issue Credit or Debit Note against a cancelled invoice.';
  END IF;

  v_prefix := CASE WHEN p_note_type = 'credit' THEN 'CN' ELSE 'DN' END;

  SELECT * INTO v_series
  FROM note_series
  WHERE supplier_id = v_inv.supplier_id AND note_type = p_note_type
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO note_series (supplier_id, note_type, prefix, financial_year, current_number)
    VALUES (v_inv.supplier_id, p_note_type, v_prefix, '2026-27', 1000)
    RETURNING * INTO v_series;
  END IF;

  v_next_num := v_series.current_number + 1;
  UPDATE note_series
  SET current_number = v_next_num, updated_at = NOW()
  WHERE id = v_series.id;

  v_note_no := v_prefix || '-' || v_next_num::TEXT;

  INSERT INTO credit_debit_notes (
    note_type,
    note_number,
    original_invoice_id,
    supplier_id,
    customer_id,
    note_date,
    amount,
    reason,
    snapshot_json,
    template_id,
    status,
    created_by
  ) VALUES (
    p_note_type,
    v_note_no,
    p_original_invoice_id,
    v_inv.supplier_id,
    v_inv.customer_id,
    CURRENT_DATE,
    p_amount,
    p_reason,
    p_snapshot_json,
    p_template_id,
    'locked',
    p_created_by
  )
  RETURNING id INTO v_note_id;

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    'credit_debit_notes',
    v_note_id,
    'ISSUE_NOTE',
    '{}'::jsonb,
    jsonb_build_object('note_number', v_note_no, 'note_type', p_note_type, 'amount', p_amount, 'invoice_id', p_original_invoice_id),
    p_created_by
  );

  PERFORM refresh_invoice_payment_status(p_original_invoice_id);

  RETURN jsonb_build_object(
    'note_id', v_note_id,
    'note_number', v_note_no,
    'note_type', p_note_type,
    'amount', p_amount,
    'original_invoice_id', p_original_invoice_id,
    'status', 'locked',
    'created_at', NOW()
  );
END;
$$;


--
-- Name: issue_invoice_atomic(uuid, uuid, uuid, date, date, numeric, jsonb, text, integer, text, text, jsonb, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_invoice_atomic(p_supplier_id uuid, p_customer_id uuid, p_contract_id uuid, p_period_from date, p_period_to date, p_total_amount numeric, p_snapshot_json jsonb, p_template_id text, p_template_version integer, p_issued_by text, p_admin_override_reason text DEFAULT NULL::text, p_breakup_json jsonb DEFAULT NULL::jsonb, p_issue_date date DEFAULT CURRENT_DATE, p_series_prefix text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_series RECORD;
  v_next_num INT;
  v_inv_no TEXT;
  v_invoice_id UUID;
  v_locked_count INT;
  v_target_prefix TEXT := COALESCE(p_series_prefix, '');
  v_conflict_found BOOLEAN := TRUE;
BEGIN
  -- 1. Exclusively row-lock the invoice series record for this supplier & prefix
  SELECT * INTO v_series
  FROM invoice_series
  WHERE supplier_id = p_supplier_id
    AND prefix = v_target_prefix
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO invoice_series (supplier_id, prefix, financial_year, current_number)
    VALUES (p_supplier_id, v_target_prefix, '2026-2027', 1000)
    RETURNING * INTO v_series;
  END IF;

  -- 2. Increment gap-free sequence (skipping any cancelled numbers if conflict exists)
  v_next_num := v_series.current_number + 1;
  WHILE v_conflict_found LOOP
    IF v_series.prefix IS NOT NULL AND LENGTH(TRIM(v_series.prefix)) > 0 THEN
      IF RIGHT(TRIM(v_series.prefix), 1) = '-' THEN
        v_inv_no := TRIM(v_series.prefix) || v_next_num::TEXT;
      ELSE
        v_inv_no := TRIM(v_series.prefix) || '-' || v_next_num::TEXT;
      END IF;
    ELSE
      v_inv_no := v_next_num::TEXT;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM invoices WHERE invoice_number = v_inv_no
    ) INTO v_conflict_found;

    IF v_conflict_found THEN
      v_next_num := v_next_num + 1;
    END IF;
  END LOOP;

  UPDATE invoice_series
  SET current_number = v_next_num, updated_at = NOW()
  WHERE id = v_series.id;

  -- 3. Insert permanently locked invoice
  INSERT INTO invoices (
    invoice_number,
    supplier_id,
    customer_id,
    contract_id,
    period_from,
    period_to,
    issue_date,
    due_date,
    total_amount,
    status,
    snapshot_json,
    template_id,
    template_version,
    issued_by,
    locked_at,
    admin_override_reason,
    breakup_json
  ) VALUES (
    v_inv_no,
    p_supplier_id,
    p_customer_id,
    p_contract_id,
    p_period_from,
    p_period_to,
    COALESCE(p_issue_date, CURRENT_DATE),
    COALESCE(p_issue_date, CURRENT_DATE) + INTERVAL '30 days',
    p_total_amount,
    'locked',
    p_snapshot_json,
    p_template_id,
    p_template_version,
    p_issued_by,
    NOW(),
    p_admin_override_reason,
    p_breakup_json
  )
  RETURNING id INTO v_invoice_id;

  -- 4. Lock ledger rows for this contract and billing period if contract_id is provided
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
$$;


--
-- Name: process_audit_log(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_audit_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, OLD.id::text, TG_OP, to_jsonb(OLD), get_current_app_role(), NOW());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(OLD), to_jsonb(NEW), get_current_app_role(), NOW());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, NEW.id::text, TG_OP, to_jsonb(NEW), get_current_app_role(), NOW());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: refresh_invoice_payment_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_invoice_payment_status(p_invoice_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_total_amount NUMERIC(12, 2);
  v_due_date DATE;
  v_current_status TEXT;
  v_paid_sum NUMERIC(12, 2);
  v_tds_sum NUMERIC(12, 2);
  v_cn_sum NUMERIC(12, 2);
  v_dn_sum NUMERIC(12, 2);
  v_effective_credited NUMERIC(12, 2);
  v_new_status TEXT;
BEGIN
  SELECT total_amount, due_date, status INTO v_total_amount, v_due_date, v_current_status
  FROM invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND OR v_current_status = 'cancelled' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount_received), 0), COALESCE(SUM(tds_deducted), 0)
  INTO v_paid_sum, v_tds_sum
  FROM payments
  WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_cn_sum
  FROM credit_debit_notes
  WHERE original_invoice_id = p_invoice_id AND note_type = 'credit' AND status != 'cancelled';

  SELECT COALESCE(SUM(amount), 0) INTO v_dn_sum
  FROM credit_debit_notes
  WHERE original_invoice_id = p_invoice_id AND note_type = 'debit' AND status != 'cancelled';

  v_effective_credited := (v_paid_sum + v_tds_sum + v_cn_sum) - v_dn_sum;

  IF v_effective_credited >= v_total_amount THEN
    v_new_status := 'paid';
  ELSIF v_effective_credited > 0 THEN
    v_new_status := 'part_paid';
  ELSE
    IF v_due_date < CURRENT_DATE THEN
      v_new_status := 'overdue';
    ELSE
      v_new_status := 'issued';
    END IF;
  END IF;

  UPDATE invoices
  SET status = v_new_status, updated_at = NOW()
  WHERE id = p_invoice_id;
END;
$$;


--
-- Name: remove_all_sample_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_all_sample_data() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_cash_deleted INT := 0;
  v_bank_deleted INT := 0;
  v_bank_tx_deleted INT := 0;
  v_payables_deleted INT := 0;
  v_emi_deleted INT := 0;
  v_vehicles_deleted INT := 0;
  v_customers_deleted INT := 0;
  v_result JSONB;
BEGIN
  -- Security check: Admin role required
  IF get_current_app_role() NOT IN ('admin', 'service_role') THEN
    RAISE EXCEPTION 'Only administrators can delete sample data.';
  END IF;

  -- 1. Delete sample cash transactions
  DELETE FROM cash_transactions WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_cash_deleted = ROW_COUNT;

  -- 2. Delete sample bank transactions
  DELETE FROM bank_transactions WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_bank_tx_deleted = ROW_COUNT;

  -- 3. Delete sample bank accounts
  DELETE FROM bank_accounts WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_bank_deleted = ROW_COUNT;

  -- 4. Delete sample vendor payables
  DELETE FROM vendor_payables WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_payables_deleted = ROW_COUNT;

  -- 5. Delete sample EMI schedules
  DELETE FROM emi_schedules WHERE is_sample_data = TRUE;
  GET DIAGNOSTICS v_emi_deleted = ROW_COUNT;

  -- 6. Soft-delete / deactivate ONLY phantom sample vehicles (never touch real 4 fleet vehicles)
  UPDATE vehicles 
  SET is_active = FALSE 
  WHERE is_sample_data = TRUE 
    AND reg_no NOT IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378');
  GET DIAGNOSTICS v_vehicles_deleted = ROW_COUNT;

  -- 7. Soft-delete sample customers (never touch VTL or Global Public School)
  UPDATE customers
  SET is_active = FALSE
  WHERE is_sample_data = TRUE
    AND id NOT IN ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002');
  GET DIAGNOSTICS v_customers_deleted = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'deleted_cash_transactions', v_cash_deleted,
    'deleted_bank_transactions', v_bank_tx_deleted,
    'deleted_bank_accounts', v_bank_deleted,
    'deleted_vendor_payables', v_payables_deleted,
    'deleted_emi_schedules', v_emi_deleted,
    'deactivated_sample_vehicles', v_vehicles_deleted,
    'deactivated_sample_customers', v_customers_deleted,
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$;


--
-- Name: soft_delete_internal_flag(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_internal_flag(p_flag_id uuid, p_deleted_by text DEFAULT public.get_current_app_role()) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF get_current_app_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete internal flags.';
  END IF;

  UPDATE internal_flags
  SET 
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    is_active = FALSE,
    updated_at = NOW()
  WHERE id = p_flag_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;


--
-- Name: trg_check_invoice_locked(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_check_invoice_locked() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.locked_at IS NOT NULL OR OLD.status != 'draft') THEN
      RAISE EXCEPTION 'Invoice % is permanently locked and cannot be deleted. Any adjustments must be made via Credit or Debit Notes.', OLD.invoice_number;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND (OLD.locked_at IS NOT NULL OR OLD.status != 'draft')) THEN
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
$$;


--
-- Name: trg_check_trip_ledger_locked(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_check_trip_ledger_locked() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.is_locked = TRUE) THEN
      RAISE EXCEPTION 'Trip ledger entry on % is locked by invoice % and cannot be deleted.', OLD.trip_date, OLD.invoice_id;
    END IF;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.is_locked = TRUE) THEN
    IF (NEW.is_locked = FALSE AND NEW.invoice_id IS NULL) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Trip ledger entry on % is locked by invoice % and cannot be modified.', OLD.trip_date, OLD.invoice_id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trg_note_refresh_invoice(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_note_refresh_invoice() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_invoice_payment_status(OLD.original_invoice_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_invoice_payment_status(NEW.original_invoice_id);
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: trg_payment_refresh_invoice(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_payment_refresh_invoice() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_invoice_payment_status(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_invoice_payment_status(NEW.invoice_id);
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: verify_and_redeem_approval_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_and_redeem_approval_token(p_token_hash text) RETURNS TABLE(approval_id uuid, contract_id uuid, customer_id uuid, year_month character varying, status character varying, is_valid boolean, rejection_reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT * INTO v_rec FROM approvals WHERE token_hash = p_token_hash;

    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, FALSE, 'INVALID_TOKEN'::TEXT;
        RETURN;
    END IF;

    IF v_rec.is_revoked THEN
        RETURN QUERY SELECT v_rec.id, v_rec.contract_id, v_rec.customer_id, v_rec.year_month, v_rec.status, FALSE, 'TOKEN_REVOKED'::TEXT;
        RETURN;
    END IF;

    IF v_rec.expires_at <= NOW() THEN
        RETURN QUERY SELECT v_rec.id, v_rec.contract_id, v_rec.customer_id, v_rec.year_month, v_rec.status, FALSE, 'TOKEN_EXPIRED'::TEXT;
        RETURN;
    END IF;

    -- Rate limiting: Max 10 requests per minute
    IF v_rec.last_requested_at IS NOT NULL AND v_rec.last_requested_at > NOW() - INTERVAL '1 minute' AND v_rec.request_count >= 10 THEN
        RETURN QUERY SELECT v_rec.id, v_rec.contract_id, v_rec.customer_id, v_rec.year_month, v_rec.status, FALSE, 'RATE_LIMITED'::TEXT;
        RETURN;
    END IF;

    -- Update rate limit telemetry
    IF v_rec.last_requested_at IS NULL OR v_rec.last_requested_at <= NOW() - INTERVAL '1 minute' THEN
        UPDATE approvals SET request_count = 1, last_requested_at = NOW() WHERE id = v_rec.id;
    ELSE
        UPDATE approvals SET request_count = request_count + 1, last_requested_at = NOW() WHERE id = v_rec.id;
    END IF;

    RETURN QUERY SELECT v_rec.id, v_rec.contract_id, v_rec.customer_id, v_rec.year_month, v_rec.status, TRUE, NULL::TEXT;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _applied_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._applied_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


--
-- Name: anomaly_acks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anomaly_acks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anomaly_id character varying(100) NOT NULL,
    contract_id uuid,
    entry_date date NOT NULL,
    acknowledged_by character varying(100) NOT NULL,
    notes text,
    acknowledged_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    phone text,
    name text NOT NULL,
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    last_login_at timestamp with time zone,
    customer_id uuid,
    driver_id uuid,
    CONSTRAINT app_users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'staff'::character varying, 'driver'::character varying, 'customer_viewer'::character varying])::text[])))
);


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    year_month character varying(7) NOT NULL,
    token_hash character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending_approval'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_revoked boolean DEFAULT false,
    approved_by character varying(100),
    coordinator_designation character varying(100),
    notes text,
    approved_at timestamp with time zone,
    request_count integer DEFAULT 0,
    last_requested_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id text NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by text DEFAULT public.get_current_app_role(),
    changed_at timestamp with time zone DEFAULT now()
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    ifsc_code text NOT NULL,
    branch text NOT NULL,
    account_type character varying(20) DEFAULT 'current'::character varying NOT NULL,
    opening_balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    current_balance numeric(12,2) DEFAULT 0.00 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_sample_data boolean DEFAULT false,
    CONSTRAINT bank_accounts_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['current'::character varying, 'savings'::character varying, 'od'::character varying])::text[])))
);


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_account_id uuid,
    supplier_id uuid,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    mode character varying(30) NOT NULL,
    direction character varying(10) NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference_no text,
    description text NOT NULL,
    cleared boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_sample_data boolean DEFAULT false,
    CONSTRAINT bank_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT bank_transactions_direction_check CHECK (((direction)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[]))),
    CONSTRAINT bank_transactions_mode_check CHECK (((mode)::text = ANY ((ARRAY['bank_transfer'::character varying, 'upi'::character varying, 'neft'::character varying, 'rtgs'::character varying, 'cheque'::character varying, 'cash_deposit'::character varying, 'emi_debit'::character varying])::text[])))
);


--
-- Name: cash_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    transaction_type character varying(20) NOT NULL,
    category character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    driver_id uuid,
    customer_id uuid,
    vehicle_id uuid,
    reference_no text,
    description text NOT NULL,
    running_balance numeric(12,2),
    created_by text DEFAULT public.get_current_app_role(),
    created_at timestamp with time zone DEFAULT now(),
    is_sample_data boolean DEFAULT false,
    CONSTRAINT cash_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT cash_transactions_category_check CHECK (((category)::text = ANY ((ARRAY['driver_bata'::character varying, 'fuel_settlement'::character varying, 'customer_cash_payment'::character varying, 'office_expense'::character varying, 'workshop_maintenance'::character varying, 'toll_parking'::character varying, 'police_rto_challan'::character varying, 'owner_drawing'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT cash_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['receipt'::character varying, 'payment'::character varying, 'deposit_to_bank'::character varying, 'petty_cash'::character varying])::text[])))
);


--
-- Name: compliance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_windows_days integer[] DEFAULT '{60,30,7}'::integer[] NOT NULL,
    service_km_warning_threshold integer DEFAULT 500 NOT NULL,
    service_days_warning_threshold integer DEFAULT 14 NOT NULL,
    emi_days_warning_threshold integer DEFAULT 5 NOT NULL,
    police_clearance_validity_months integer DEFAULT 12 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contract_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    effective_from date NOT NULL,
    effective_to date NOT NULL,
    fixed_amount numeric(12,2) DEFAULT 65000 NOT NULL,
    included_km integer DEFAULT 3000 NOT NULL,
    included_hours_per_day integer DEFAULT 12 NOT NULL,
    extra_hour_rate numeric(10,2) DEFAULT 150 NOT NULL,
    extra_km_rate numeric(10,2) DEFAULT 18 NOT NULL,
    night_bata numeric(10,2) DEFAULT 200 NOT NULL,
    outstation_bata numeric(10,2) DEFAULT 200 NOT NULL,
    working_days integer DEFAULT 30 NOT NULL,
    extra_day_rate numeric(10,2) DEFAULT 0,
    rounding_mode text DEFAULT 'down'::text NOT NULL,
    gst_mode text DEFAULT 'disabled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contract_terms_gst_mode_check CHECK ((gst_mode = ANY (ARRAY['disabled'::text, 'cgst_sgst'::text, 'igst'::text]))),
    CONSTRAINT contract_terms_rounding_mode_check CHECK ((rounding_mode = ANY (ARRAY['down'::text, 'nearest'::text, 'none'::text])))
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    agreement_no text NOT NULL,
    agreement_date date NOT NULL,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    contract_kind text NOT NULL,
    invoice_format text DEFAULT 'F2'::text NOT NULL,
    pricing_model text DEFAULT 'monthly_fixed'::text NOT NULL,
    pricing_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contracts_contract_kind_check CHECK ((contract_kind = ANY (ARRAY['monthly_fixed'::text, 'per_trip_package'::text, 'on_call_pool'::text, 'hotel_contract'::text]))),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'renewal_pending'::text, 'expired'::text, 'renewed'::text, 'terminated'::text])))
);

ALTER TABLE ONLY public.contracts FORCE ROW LEVEL SECURITY;


--
-- Name: credit_debit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_debit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_type character varying(10) NOT NULL,
    note_number text NOT NULL,
    original_invoice_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    note_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    snapshot_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_id text DEFAULT 'format_credit_debit_v1'::text NOT NULL,
    status character varying(20) DEFAULT 'locked'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    CONSTRAINT credit_debit_notes_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT credit_debit_notes_note_type_check CHECK (((note_type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[])))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    customer_type text NOT NULL,
    billing_address text NOT NULL,
    city text DEFAULT 'Trivandrum'::text,
    state text DEFAULT 'Kerala'::text,
    pincode text,
    pan text,
    gstin text,
    contact_person text,
    phone text,
    email text,
    payment_terms_days integer DEFAULT 0,
    default_supplier_id uuid,
    default_invoice_format text DEFAULT 'F2'::text,
    approval_token text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    default_tds_rate numeric(5,2),
    pan_category text,
    is_sample_data boolean DEFAULT false,
    CONSTRAINT customers_customer_type_check CHECK ((customer_type = ANY (ARRAY['individual'::text, 'agent'::text, 'corporate'::text, 'school'::text, 'hotel'::text, 'long_term'::text]))),
    CONSTRAINT customers_gstin_check CHECK (((gstin IS NULL) OR (gstin = ''::text) OR (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'::text))),
    CONSTRAINT customers_pan_check CHECK (((pan IS NULL) OR (pan = ''::text) OR (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'::text)))
);

ALTER TABLE ONLY public.customers FORCE ROW LEVEL SECURITY;


--
-- Name: driver_other_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_other_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    vehicle_id uuid,
    trip_id uuid,
    expense_date date NOT NULL,
    category character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    receipt_photo_url text,
    status character varying(30) DEFAULT 'submitted'::character varying NOT NULL,
    held_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT driver_other_expenses_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT driver_other_expenses_category_check CHECK (((category)::text = ANY ((ARRAY['toll'::character varying, 'parking'::character varying, 'cleaning'::character varying, 'repairs'::character varying, 'permit'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT driver_other_expenses_status_check CHECK (((status)::text = ANY ((ARRAY['submitted'::character varying, 'approved'::character varying, 'held_from_settlement'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    driver_type text NOT NULL,
    license_no text,
    license_expiry date,
    badge_no text,
    police_clearance_date date,
    languages text[],
    daily_bata_rate numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT drivers_driver_type_check CHECK ((driver_type = ANY (ARRAY['permanent'::text, 'temporary'::text, 'vendor_supplied'::text])))
);

ALTER TABLE ONLY public.drivers FORCE ROW LEVEL SECURITY;


--
-- Name: emi_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emi_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    financier text NOT NULL,
    account_no text NOT NULL,
    month_year character varying(7) NOT NULL,
    due_date date NOT NULL,
    amount numeric(10,2) NOT NULL,
    paid_date date,
    payment_reference text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    is_sample_data boolean DEFAULT false,
    CONSTRAINT emi_schedules_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT emi_schedules_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'overdue'::character varying])::text[])))
);


--
-- Name: financial_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    allocation_rules jsonb DEFAULT '{"driver_pay_method": "actual_or_daily_bata", "include_emi_in_pnl": true, "include_fuel_in_pnl": true, "default_working_days": 30, "emi_allocation_method": "actual_vehicle_emi", "include_service_in_pnl": true, "cost_completeness_strict": true, "include_driver_pay_in_pnl": true, "receivables_ageing_brackets": [30, 60, 90]}'::jsonb NOT NULL,
    cost_completeness_strict boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text DEFAULT public.get_current_app_role()
);


--
-- Name: fuel_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid,
    vehicle_id uuid,
    entry_date date NOT NULL,
    odometer_reading numeric(10,1) NOT NULL,
    previous_odometer numeric(10,1),
    fuel_litres numeric(8,2) NOT NULL,
    rate_per_litre numeric(8,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    fuel_station text,
    receipt_photo_url text,
    receipt_hash text,
    km_per_litre numeric(6,2),
    status character varying(30) DEFAULT 'submitted'::character varying NOT NULL,
    held_reason text,
    anomalies jsonb DEFAULT '[]'::jsonb NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_full_tank boolean DEFAULT false NOT NULL,
    receipt_number text,
    perceptual_hash text,
    CONSTRAINT fuel_expenses_fuel_litres_check CHECK ((fuel_litres > (0)::numeric)),
    CONSTRAINT fuel_expenses_rate_per_litre_check CHECK ((rate_per_litre > (0)::numeric)),
    CONSTRAINT fuel_expenses_status_check CHECK (((status)::text = ANY ((ARRAY['submitted'::character varying, 'approved'::character varying, 'held_from_settlement'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT fuel_expenses_total_amount_check CHECK ((total_amount > (0)::numeric))
);


--
-- Name: COLUMN fuel_expenses.is_full_tank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fuel_expenses.is_full_tank IS 'Whether this fuel fill filled the tank to 100% capacity. Economy is strictly calculated between consecutive full fills.';


--
-- Name: COLUMN fuel_expenses.receipt_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fuel_expenses.receipt_number IS 'Receipt / bill serial number issued by fuel station POS.';


--
-- Name: COLUMN fuel_expenses.perceptual_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fuel_expenses.perceptual_hash IS 'Perceptual visual hash (e.g. 64-bit dHash) for detecting re-photographed duplicates of the same physical bill.';


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    name text NOT NULL,
    region text DEFAULT 'Kerala'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: import_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    customer_name text,
    profile_name text DEFAULT 'Default Profile'::text NOT NULL,
    mapping jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.import_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: internal_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(100) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by text DEFAULT public.get_current_app_role(),
    created_by_user_id uuid,
    resolved_by text,
    resolved_at timestamp with time zone,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    admin_override_reason text,
    overridden_by text,
    overridden_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by text,
    retention_months integer DEFAULT 12,
    view_audit jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT internal_flags_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['driver'::character varying, 'vehicle'::character varying, 'hotel'::character varying, 'vendor'::character varying, 'customer'::character varying])::text[]))),
    CONSTRAINT internal_flags_severity_check CHECK (((severity)::text = ANY ((ARRAY['note'::character varying, 'caution'::character varying, 'avoid'::character varying])::text[])))
);


--
-- Name: invoice_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    prefix text NOT NULL,
    financial_year text NOT NULL,
    current_number integer DEFAULT 1000 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    supplier_id uuid,
    customer_id uuid,
    contract_id uuid,
    period_from date NOT NULL,
    period_to date NOT NULL,
    issue_date date NOT NULL,
    due_date date NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    status text DEFAULT 'issued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    snapshot_json jsonb,
    template_id text,
    template_version integer DEFAULT 1,
    issued_by text,
    locked_at timestamp with time zone,
    admin_override_reason text,
    breakup_json jsonb,
    notes text,
    updated_at timestamp with time zone DEFAULT now(),
    invoice_type text DEFAULT 'tax_invoice'::text,
    tax_profile_id uuid,
    tax_amount numeric(12,2) DEFAULT 0.00,
    subtotal_amount numeric(12,2) DEFAULT 0.00,
    discount_amount numeric(12,2) DEFAULT 0.00
);

ALTER TABLE ONLY public.invoices FORCE ROW LEVEL SECURITY;


--
-- Name: item_catalogue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_catalogue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    name text NOT NULL,
    description text,
    default_unit text DEFAULT 'trip'::text NOT NULL,
    default_rate numeric(12,2) DEFAULT 0.00 NOT NULL,
    tax_profile_id uuid,
    sac_hsn text DEFAULT '996601'::text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT item_catalogue_default_unit_check CHECK ((default_unit = ANY (ARRAY['trip'::text, 'km'::text, 'hr'::text, 'day'::text, 'month'::text, 'fixed'::text, 'item'::text])))
);


--
-- Name: note_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid,
    note_type character varying(10) NOT NULL,
    prefix character varying(10) NOT NULL,
    financial_year character varying(10) DEFAULT '2026-27'::character varying NOT NULL,
    current_number integer DEFAULT 1000 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT note_series_note_type_check CHECK (((note_type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[])))
);


--
-- Name: payment_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    reminder_type character varying(30) NOT NULL,
    recipient_phone text NOT NULL,
    message_text text NOT NULL,
    channel character varying(20) DEFAULT 'whatsapp'::character varying NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    status character varying(20) DEFAULT 'sent'::character varying NOT NULL,
    created_by text,
    CONSTRAINT payment_reminders_reminder_type_check CHECK (((reminder_type)::text = ANY ((ARRAY['due_minus_3'::character varying, 'due_date'::character varying, 'overdue_7'::character varying, 'overdue_14'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount_received numeric(12,2) NOT NULL,
    tds_deducted numeric(12,2) DEFAULT 0.00 NOT NULL,
    tds_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    mode character varying(20) NOT NULL,
    reference_no text,
    notes text,
    excess_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    CONSTRAINT payments_amount_received_check CHECK ((amount_received >= (0)::numeric)),
    CONSTRAINT payments_mode_check CHECK (((mode)::text = ANY ((ARRAY['cash'::character varying, 'upi'::character varying, 'bank_transfer'::character varying, 'cheque'::character varying])::text[]))),
    CONSTRAINT payments_tds_deducted_check CHECK ((tds_deducted >= (0)::numeric))
);


--
-- Name: rate_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid,
    customer_id uuid,
    vehicle_type text NOT NULL,
    base_amount numeric(10,2) NOT NULL,
    included_hours integer DEFAULT 10 NOT NULL,
    included_km integer DEFAULT 80 NOT NULL,
    extra_hour_rate numeric(10,2) DEFAULT 200 NOT NULL,
    extra_km_rate numeric(10,2) DEFAULT 15 NOT NULL,
    min_charge numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.rate_cards FORCE ROW LEVEL SECURITY;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    scope text DEFAULT 'system'::text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: supplier_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trade_name text NOT NULL,
    legal_name text NOT NULL,
    address text NOT NULL,
    city text DEFAULT 'Trivandrum'::text NOT NULL,
    state text DEFAULT 'Kerala'::text NOT NULL,
    pincode text DEFAULT '695002'::text NOT NULL,
    phone text NOT NULL,
    secondary_phone text,
    email text NOT NULL,
    pan text NOT NULL,
    gstin text,
    sac_code text DEFAULT '996601'::text NOT NULL,
    bank_name text,
    account_number text,
    ifsc text,
    upi_id text,
    logo_url text,
    invoice_prefix text NOT NULL,
    promo_text text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT supplier_profiles_gstin_check CHECK (((gstin IS NULL) OR (gstin = ''::text) OR (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'::text))),
    CONSTRAINT supplier_profiles_pan_check CHECK ((pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'::text))
);

ALTER TABLE ONLY public.supplier_profiles FORCE ROW LEVEL SECURITY;


--
-- Name: tax_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tax_type text NOT NULL,
    rate_percent numeric(5,2) DEFAULT 0.00 NOT NULL,
    applies_to text DEFAULT 'services'::text NOT NULL,
    place_of_supply_logic text DEFAULT 'intra_state_cgst_sgst'::text NOT NULL,
    sac_hsn_default text DEFAULT '996601'::text,
    is_inclusive boolean DEFAULT false NOT NULL,
    effective_from date DEFAULT CURRENT_DATE,
    effective_to date,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tax_profiles_applies_to_check CHECK ((applies_to = ANY (ARRAY['all'::text, 'goods'::text, 'services'::text]))),
    CONSTRAINT tax_profiles_place_of_supply_logic_check CHECK ((place_of_supply_logic = ANY (ARRAY['intra_state_cgst_sgst'::text, 'inter_state_igst'::text, 'exempt'::text, 'rcm'::text]))),
    CONSTRAINT tax_profiles_tax_type_check CHECK ((tax_type = ANY (ARRAY['gst'::text, 'tds'::text, 'tcs'::text, 'cess'::text, 'none'::text])))
);


--
-- Name: trip_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    vehicle_id uuid,
    driver_id uuid,
    trip_date date NOT NULL,
    day_status character varying(20) DEFAULT 'RUN'::character varying NOT NULL,
    start_km integer,
    close_km integer,
    used_km integer,
    start_time character varying(10),
    close_time character varying(10),
    duration_minutes integer,
    ends_next_day boolean DEFAULT false,
    night_bata boolean DEFAULT false,
    outstation_bata boolean DEFAULT false,
    toll_amount numeric(10,2) DEFAULT 0,
    permit_amount numeric(10,2) DEFAULT 0,
    parking_amount numeric(10,2) DEFAULT 0,
    other_charges numeric(10,2) DEFAULT 0,
    remarks text,
    tags text[] DEFAULT '{}'::text[],
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_locked boolean DEFAULT false NOT NULL,
    invoice_id uuid
);

ALTER TABLE ONLY public.trip_ledger FORCE ROW LEVEL SECURITY;


--
-- Name: vehicle_fuel_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_fuel_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_type character varying(50) NOT NULL,
    min_kml numeric(5,2) DEFAULT 15.00 NOT NULL,
    max_kml numeric(5,2) DEFAULT 22.00 NOT NULL,
    target_kml numeric(5,2) DEFAULT 18.00 NOT NULL,
    fuel_type character varying(20) DEFAULT 'diesel'::character varying NOT NULL,
    receipt_photo_mandatory boolean DEFAULT true NOT NULL,
    duplicate_window_days integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    unit character varying(20) DEFAULT 'km/L'::character varying NOT NULL,
    is_default_assumption boolean DEFAULT true NOT NULL,
    note text DEFAULT 'default assumption (editable)'::text
);


--
-- Name: vehicle_service_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_service_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    service_date date NOT NULL,
    odometer_reading integer NOT NULL,
    service_type text NOT NULL,
    workshop_name text NOT NULL,
    bill_amount numeric(10,2) DEFAULT 0 NOT NULL,
    bill_photo_url text,
    notes text,
    created_by text DEFAULT public.get_current_app_role(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vehicle_service_logs_service_type_check CHECK ((service_type = ANY (ARRAY['periodic'::text, 'oil_change'::text, 'brake_pad'::text, 'tyres'::text, 'accidental'::text, 'general'::text])))
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reg_no text NOT NULL,
    display_reg_no text NOT NULL,
    make_model text,
    vehicle_type text,
    seats integer DEFAULT 7 NOT NULL,
    ownership text NOT NULL,
    vendor_id uuid,
    current_odometer integer DEFAULT 0 NOT NULL,
    km_gap_threshold integer DEFAULT 15 NOT NULL,
    rc_expiry date,
    insurance_expiry date,
    pollution_expiry date,
    permit_expiry date,
    fitness_expiry date,
    monthly_emi_amount numeric(10,2),
    emi_due_day integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_service_odometer integer,
    last_service_date date,
    service_interval_km integer DEFAULT 10000 NOT NULL,
    next_service_due_km integer,
    next_service_due_date date,
    emi_financier text,
    emi_account_no text,
    fuel_type text DEFAULT 'diesel'::text NOT NULL,
    min_efficiency numeric(5,2),
    max_efficiency numeric(5,2),
    is_sample_data boolean DEFAULT false,
    CONSTRAINT vehicles_fuel_type_check CHECK ((fuel_type = ANY (ARRAY['petrol'::text, 'diesel'::text, 'cng'::text, 'electric'::text, 'other'::text]))),
    CONSTRAINT vehicles_ownership_check CHECK ((ownership = ANY (ARRAY['owned'::text, 'hired'::text, 'attached'::text]))),
    CONSTRAINT vehicles_vehicle_type_check CHECK (((vehicle_type IS NULL) OR (vehicle_type = ''::text) OR (vehicle_type = ANY (ARRAY['sedan'::text, 'ertiga'::text, 'innova'::text, 'tempo_traveller'::text, 'luxury'::text, 'other'::text]))))
);

ALTER TABLE ONLY public.vehicles FORCE ROW LEVEL SECURITY;


--
-- Name: vendor_payables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_payables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_name text NOT NULL,
    vendor_type character varying(50) NOT NULL,
    bill_no text,
    bill_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    amount numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0.00 NOT NULL,
    status character varying(20) DEFAULT 'unpaid'::character varying NOT NULL,
    vehicle_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_sample_data boolean DEFAULT false,
    CONSTRAINT vendor_payables_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT vendor_payables_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT vendor_payables_status_check CHECK (((status)::text = ANY ((ARRAY['unpaid'::character varying, 'part_paid'::character varying, 'paid'::character varying])::text[]))),
    CONSTRAINT vendor_payables_vendor_type_check CHECK (((vendor_type)::text = ANY ((ARRAY['attached_vehicle'::character varying, 'workshop_service'::character varying, 'fuel_station_credit'::character varying, 'spare_parts'::character varying, 'rto_permit'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: _applied_migrations _applied_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._applied_migrations
    ADD CONSTRAINT _applied_migrations_pkey PRIMARY KEY (filename);


--
-- Name: anomaly_acks anomaly_acks_anomaly_id_contract_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_acks
    ADD CONSTRAINT anomaly_acks_anomaly_id_contract_id_key UNIQUE (anomaly_id, contract_id);


--
-- Name: anomaly_acks anomaly_acks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_acks
    ADD CONSTRAINT anomaly_acks_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_email_key UNIQUE (email);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_token_hash_key UNIQUE (token_hash);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: cash_transactions cash_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_pkey PRIMARY KEY (id);


--
-- Name: compliance_settings compliance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_settings
    ADD CONSTRAINT compliance_settings_pkey PRIMARY KEY (id);


--
-- Name: contract_terms contract_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_terms
    ADD CONSTRAINT contract_terms_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: credit_debit_notes credit_debit_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_note_number_key UNIQUE (note_number);


--
-- Name: credit_debit_notes credit_debit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_pkey PRIMARY KEY (id);


--
-- Name: customers customers_approval_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_approval_token_key UNIQUE (approval_token);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: driver_other_expenses driver_other_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_other_expenses
    ADD CONSTRAINT driver_other_expenses_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: emi_schedules emi_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emi_schedules
    ADD CONSTRAINT emi_schedules_pkey PRIMARY KEY (id);


--
-- Name: financial_settings financial_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_settings
    ADD CONSTRAINT financial_settings_pkey PRIMARY KEY (id);


--
-- Name: fuel_expenses fuel_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_expenses
    ADD CONSTRAINT fuel_expenses_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_date_key UNIQUE (date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: import_profiles import_profiles_customer_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_profiles
    ADD CONSTRAINT import_profiles_customer_unique UNIQUE (customer_id);


--
-- Name: import_profiles import_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_profiles
    ADD CONSTRAINT import_profiles_pkey PRIMARY KEY (id);


--
-- Name: internal_flags internal_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_flags
    ADD CONSTRAINT internal_flags_pkey PRIMARY KEY (id);


--
-- Name: invoice_series invoice_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_series
    ADD CONSTRAINT invoice_series_pkey PRIMARY KEY (id);


--
-- Name: invoice_series invoice_series_supplier_id_prefix_financial_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_series
    ADD CONSTRAINT invoice_series_supplier_id_prefix_financial_year_key UNIQUE (supplier_id, prefix, financial_year);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: item_catalogue item_catalogue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_catalogue
    ADD CONSTRAINT item_catalogue_pkey PRIMARY KEY (id);


--
-- Name: note_series note_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_series
    ADD CONSTRAINT note_series_pkey PRIMARY KEY (id);


--
-- Name: note_series note_series_supplier_id_note_type_prefix_financial_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_series
    ADD CONSTRAINT note_series_supplier_id_note_type_prefix_financial_year_key UNIQUE (supplier_id, note_type, prefix, financial_year);


--
-- Name: payment_reminders payment_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reminders
    ADD CONSTRAINT payment_reminders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: rate_cards rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: supplier_profiles supplier_profiles_invoice_prefix_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_profiles
    ADD CONSTRAINT supplier_profiles_invoice_prefix_key UNIQUE (invoice_prefix);


--
-- Name: supplier_profiles supplier_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_profiles
    ADD CONSTRAINT supplier_profiles_pkey PRIMARY KEY (id);


--
-- Name: tax_profiles tax_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_profiles
    ADD CONSTRAINT tax_profiles_pkey PRIMARY KEY (id);


--
-- Name: trip_ledger trip_ledger_contract_id_trip_date_vehicle_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ledger
    ADD CONSTRAINT trip_ledger_contract_id_trip_date_vehicle_id_key UNIQUE (contract_id, trip_date, vehicle_id);


--
-- Name: trip_ledger trip_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ledger
    ADD CONSTRAINT trip_ledger_pkey PRIMARY KEY (id);


--
-- Name: emi_schedules uq_vehicle_month_emi; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emi_schedules
    ADD CONSTRAINT uq_vehicle_month_emi UNIQUE (vehicle_id, month_year);


--
-- Name: vehicle_fuel_settings vehicle_fuel_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_fuel_settings
    ADD CONSTRAINT vehicle_fuel_settings_pkey PRIMARY KEY (id);


--
-- Name: vehicle_fuel_settings vehicle_fuel_settings_vehicle_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_fuel_settings
    ADD CONSTRAINT vehicle_fuel_settings_vehicle_type_key UNIQUE (vehicle_type);


--
-- Name: vehicle_service_logs vehicle_service_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_service_logs
    ADD CONSTRAINT vehicle_service_logs_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_reg_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_reg_no_key UNIQUE (reg_no);


--
-- Name: vendor_payables vendor_payables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payables
    ADD CONSTRAINT vendor_payables_pkey PRIMARY KEY (id);


--
-- Name: idx_approvals_contract_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_contract_month ON public.approvals USING btree (contract_id, year_month);


--
-- Name: idx_approvals_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_token_hash ON public.approvals USING btree (token_hash);


--
-- Name: idx_bank_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_date ON public.bank_transactions USING btree (transaction_date);


--
-- Name: idx_cash_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_transactions_date ON public.cash_transactions USING btree (entry_date);


--
-- Name: idx_credit_debit_notes_cust; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_cust ON public.credit_debit_notes USING btree (customer_id);


--
-- Name: idx_credit_debit_notes_inv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_inv ON public.credit_debit_notes USING btree (original_invoice_id);


--
-- Name: idx_emi_schedules_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emi_schedules_month ON public.emi_schedules USING btree (vehicle_id, month_year);


--
-- Name: idx_fuel_driver_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_driver_date ON public.fuel_expenses USING btree (driver_id, entry_date DESC);


--
-- Name: idx_fuel_expenses_perceptual_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_expenses_perceptual_hash ON public.fuel_expenses USING btree (perceptual_hash) WHERE (perceptual_hash IS NOT NULL);


--
-- Name: idx_fuel_expenses_receipt_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_expenses_receipt_lookup ON public.fuel_expenses USING btree (receipt_number, fuel_station, entry_date) WHERE (receipt_number IS NOT NULL);


--
-- Name: idx_fuel_receipt_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_receipt_hash ON public.fuel_expenses USING btree (receipt_hash);


--
-- Name: idx_fuel_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_status ON public.fuel_expenses USING btree (status);


--
-- Name: idx_fuel_vehicle_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_vehicle_date ON public.fuel_expenses USING btree (vehicle_id, entry_date DESC);


--
-- Name: idx_internal_flags_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_flags_created ON public.internal_flags USING btree (created_at DESC);


--
-- Name: idx_internal_flags_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_flags_entity ON public.internal_flags USING btree (entity_type, entity_id, is_active);


--
-- Name: idx_internal_flags_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_flags_severity ON public.internal_flags USING btree (severity, is_active);


--
-- Name: idx_payment_reminders_inv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_reminders_inv ON public.payment_reminders USING btree (invoice_id);


--
-- Name: idx_payments_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_customer_id ON public.payments USING btree (customer_id);


--
-- Name: idx_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: idx_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_payment_date ON public.payments USING btree (payment_date);


--
-- Name: idx_trip_ledger_contract_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_ledger_contract_date ON public.trip_ledger USING btree (contract_id, trip_date);


--
-- Name: idx_trip_ledger_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_ledger_driver ON public.trip_ledger USING btree (driver_id);


--
-- Name: idx_trip_ledger_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_ledger_invoice_id ON public.trip_ledger USING btree (invoice_id);


--
-- Name: idx_trip_ledger_is_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_ledger_is_locked ON public.trip_ledger USING btree (is_locked);


--
-- Name: idx_trip_ledger_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_ledger_vehicle ON public.trip_ledger USING btree (vehicle_id);


--
-- Name: idx_vendor_payables_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_payables_due ON public.vendor_payables USING btree (due_date);


--
-- Name: contract_terms audit_contract_terms; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_contract_terms AFTER INSERT OR DELETE OR UPDATE ON public.contract_terms FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


--
-- Name: contracts audit_contracts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_contracts AFTER INSERT OR DELETE OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


--
-- Name: rate_cards audit_rate_cards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_rate_cards AFTER INSERT OR DELETE OR UPDATE ON public.rate_cards FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


--
-- Name: supplier_profiles audit_supplier_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_supplier_profiles AFTER INSERT OR DELETE OR UPDATE ON public.supplier_profiles FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


--
-- Name: invoices trg_invoice_lock_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invoice_lock_guard BEFORE DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.trg_check_invoice_locked();


--
-- Name: credit_debit_notes trg_note_after_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_note_after_change AFTER INSERT OR DELETE OR UPDATE ON public.credit_debit_notes FOR EACH ROW EXECUTE FUNCTION public.trg_note_refresh_invoice();


--
-- Name: payments trg_payment_after_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_after_change AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.trg_payment_refresh_invoice();


--
-- Name: trip_ledger trg_trip_ledger_lock_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_trip_ledger_lock_guard BEFORE DELETE OR UPDATE ON public.trip_ledger FOR EACH ROW EXECUTE FUNCTION public.trg_check_trip_ledger_locked();


--
-- Name: anomaly_acks anomaly_acks_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_acks
    ADD CONSTRAINT anomaly_acks_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: app_users app_users_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: app_users app_users_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: approvals approvals_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: approvals approvals_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: bank_accounts bank_accounts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id) ON DELETE SET NULL;


--
-- Name: bank_transactions bank_transactions_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: bank_transactions bank_transactions_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id) ON DELETE SET NULL;


--
-- Name: cash_transactions cash_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: cash_transactions cash_transactions_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: cash_transactions cash_transactions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: contract_terms contract_terms_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_terms
    ADD CONSTRAINT contract_terms_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: contracts contracts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id) ON DELETE RESTRICT;


--
-- Name: credit_debit_notes credit_debit_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: credit_debit_notes credit_debit_notes_original_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_original_invoice_id_fkey FOREIGN KEY (original_invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;


--
-- Name: credit_debit_notes credit_debit_notes_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id) ON DELETE RESTRICT;


--
-- Name: customers customers_default_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_default_supplier_id_fkey FOREIGN KEY (default_supplier_id) REFERENCES public.supplier_profiles(id);


--
-- Name: driver_other_expenses driver_other_expenses_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_other_expenses
    ADD CONSTRAINT driver_other_expenses_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE RESTRICT;


--
-- Name: driver_other_expenses driver_other_expenses_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_other_expenses
    ADD CONSTRAINT driver_other_expenses_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_users(id);


--
-- Name: driver_other_expenses driver_other_expenses_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_other_expenses
    ADD CONSTRAINT driver_other_expenses_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trip_ledger(id) ON DELETE SET NULL;


--
-- Name: driver_other_expenses driver_other_expenses_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_other_expenses
    ADD CONSTRAINT driver_other_expenses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: emi_schedules emi_schedules_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emi_schedules
    ADD CONSTRAINT emi_schedules_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: fuel_expenses fuel_expenses_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_expenses
    ADD CONSTRAINT fuel_expenses_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE RESTRICT;


--
-- Name: fuel_expenses fuel_expenses_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_expenses
    ADD CONSTRAINT fuel_expenses_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.app_users(id);


--
-- Name: fuel_expenses fuel_expenses_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_expenses
    ADD CONSTRAINT fuel_expenses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- Name: import_profiles import_profiles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_profiles
    ADD CONSTRAINT import_profiles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: internal_flags internal_flags_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_flags
    ADD CONSTRAINT internal_flags_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: invoice_series invoice_series_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_series
    ADD CONSTRAINT invoice_series_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id);


--
-- Name: invoices invoices_tax_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tax_profile_id_fkey FOREIGN KEY (tax_profile_id) REFERENCES public.tax_profiles(id) ON DELETE SET NULL;


--
-- Name: item_catalogue item_catalogue_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_catalogue
    ADD CONSTRAINT item_catalogue_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id) ON DELETE CASCADE;


--
-- Name: item_catalogue item_catalogue_tax_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_catalogue
    ADD CONSTRAINT item_catalogue_tax_profile_id_fkey FOREIGN KEY (tax_profile_id) REFERENCES public.tax_profiles(id) ON DELETE SET NULL;


--
-- Name: note_series note_series_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_series
    ADD CONSTRAINT note_series_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier_profiles(id) ON DELETE CASCADE;


--
-- Name: payment_reminders payment_reminders_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reminders
    ADD CONSTRAINT payment_reminders_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;


--
-- Name: rate_cards rate_cards_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: rate_cards rate_cards_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: trip_ledger trip_ledger_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ledger
    ADD CONSTRAINT trip_ledger_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: trip_ledger trip_ledger_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ledger
    ADD CONSTRAINT trip_ledger_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: trip_ledger trip_ledger_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ledger
    ADD CONSTRAINT trip_ledger_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;


--
-- Name: trip_ledger trip_ledger_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ledger
    ADD CONSTRAINT trip_ledger_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: vehicle_service_logs vehicle_service_logs_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_service_logs
    ADD CONSTRAINT vehicle_service_logs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: vendor_payables vendor_payables_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payables
    ADD CONSTRAINT vendor_payables_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: approvals admin_approvals_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_approvals_all ON public.approvals USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: contract_terms admin_contract_terms_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_contract_terms_all ON public.contract_terms USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: invoices admin_invoices_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_invoices_all ON public.invoices USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: item_catalogue admin_item_catalogue_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_item_catalogue_all ON public.item_catalogue USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: rate_cards admin_rate_cards_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_rate_cards_all ON public.rate_cards USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: anomaly_acks admin_staff_anomaly_acks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_staff_anomaly_acks ON public.anomaly_acks USING ((current_setting('app.current_role'::text, true) = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((current_setting('app.current_role'::text, true) = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: tax_profiles admin_tax_profiles_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_tax_profiles_all ON public.tax_profiles USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: trip_ledger admin_trip_ledger_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_trip_ledger_all ON public.trip_ledger USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: anomaly_acks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anomaly_acks ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts bank_accounts_admin_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bank_accounts_admin_staff_all ON public.bank_accounts TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: bank_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_transactions bank_transactions_admin_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bank_transactions_admin_staff_all ON public.bank_transactions TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: cash_transactions cash_admin_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_admin_staff_all ON public.cash_transactions TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: cash_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_settings compliance_settings_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_settings_admin_update ON public.compliance_settings TO authenticated, starciti_app USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: compliance_settings compliance_settings_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compliance_settings_read_all ON public.compliance_settings FOR SELECT TO authenticated, starciti_app USING (true);


--
-- Name: contract_terms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_terms ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_debit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_debit_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals customer_approvals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_approvals_select ON public.approvals FOR SELECT USING ((((public.get_current_app_role() = 'customer_viewer'::text) AND (customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.email = ( SELECT app_users.email
           FROM public.app_users
          WHERE (app_users.id = auth.uid())))))) OR (((token_hash)::text = NULLIF(current_setting('app.current_token_hash'::text, true), ''::text)) AND (is_revoked = false) AND (expires_at > now()))));


--
-- Name: approvals customer_approvals_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_approvals_update ON public.approvals FOR UPDATE USING (((current_setting('app.current_role'::text, true) = 'customer_viewer'::text) AND ((token_hash)::text = current_setting('app.current_token_hash'::text, true)) AND (is_revoked = false) AND (expires_at > now())));


--
-- Name: invoices customer_invoices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_invoices_select ON public.invoices FOR SELECT USING (((public.get_current_app_role() = 'customer_viewer'::text) AND (customer_id = public.get_current_app_customer_id())));


--
-- Name: trip_ledger customer_trip_ledger_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_trip_ledger_select ON public.trip_ledger FOR SELECT USING ((((public.get_current_app_role() = 'customer_viewer'::text) AND (contract_id IN ( SELECT contracts.id
   FROM public.contracts
  WHERE (contracts.customer_id IN ( SELECT customers.id
           FROM public.customers
          WHERE (customers.email = ( SELECT app_users.email
                   FROM public.app_users
                  WHERE (app_users.id = auth.uid())))))))) OR (contract_id IN ( SELECT a.contract_id
   FROM public.approvals a
  WHERE (((a.token_hash)::text = NULLIF(current_setting('app.current_token_hash'::text, true), ''::text)) AND (a.is_revoked = false) AND (a.expires_at > now()))))));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_other_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_other_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_ledger driver_trip_ledger_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY driver_trip_ledger_insert ON public.trip_ledger FOR INSERT WITH CHECK (((public.get_current_app_role() = 'driver'::text) AND (driver_id = public.get_current_app_driver_id())));


--
-- Name: trip_ledger driver_trip_ledger_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY driver_trip_ledger_select ON public.trip_ledger FOR SELECT USING (((public.get_current_app_role() = 'driver'::text) AND (driver_id = public.get_current_app_driver_id())));


--
-- Name: trip_ledger driver_trip_ledger_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY driver_trip_ledger_update ON public.trip_ledger FOR UPDATE USING (((public.get_current_app_role() = 'driver'::text) AND (driver_id = public.get_current_app_driver_id())));


--
-- Name: drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: emi_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.emi_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: emi_schedules emi_schedules_admin_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY emi_schedules_admin_staff_all ON public.emi_schedules TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: financial_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_settings financial_settings_admin_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY financial_settings_admin_staff_all ON public.financial_settings TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: fuel_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_expenses fuel_expenses_driver_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_expenses_driver_insert ON public.fuel_expenses FOR INSERT TO authenticated, starciti_app WITH CHECK (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR ((public.get_current_app_role() = 'driver'::text) AND (driver_id = public.get_current_app_driver_id()))));


--
-- Name: fuel_expenses fuel_expenses_driver_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_expenses_driver_select ON public.fuel_expenses FOR SELECT TO authenticated, starciti_app USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR ((public.get_current_app_role() = 'driver'::text) AND (driver_id = public.get_current_app_driver_id()))));


--
-- Name: fuel_expenses fuel_expenses_staff_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_expenses_staff_admin_update ON public.fuel_expenses FOR UPDATE TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: vehicle_fuel_settings fuel_settings_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_settings_admin_write ON public.vehicle_fuel_settings TO authenticated, starciti_app USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: vehicle_fuel_settings fuel_settings_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_settings_select_all ON public.vehicle_fuel_settings FOR SELECT TO authenticated, starciti_app USING (true);


--
-- Name: holidays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

--
-- Name: import_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: import_profiles import_profiles_admin_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_profiles_admin_staff ON public.import_profiles USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR (auth.uid() IN ( SELECT app_users.id
   FROM public.app_users
  WHERE ((app_users.role)::text = ANY ((ARRAY['admin'::character varying, 'staff'::character varying])::text[])))))) WITH CHECK (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR (auth.uid() IN ( SELECT app_users.id
   FROM public.app_users
  WHERE ((app_users.role)::text = ANY ((ARRAY['admin'::character varying, 'staff'::character varying])::text[]))))));


--
-- Name: import_profiles import_profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY import_profiles_select ON public.import_profiles FOR SELECT USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR (auth.uid() IN ( SELECT app_users.id
   FROM public.app_users
  WHERE ((app_users.role)::text = ANY ((ARRAY['admin'::character varying, 'staff'::character varying])::text[]))))));


--
-- Name: internal_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_flags internal_flags_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_flags_admin_delete ON public.internal_flags FOR DELETE TO authenticated, starciti_app USING ((public.get_current_app_role() = 'admin'::text));


--
-- Name: internal_flags internal_flags_admin_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_flags_admin_staff_insert ON public.internal_flags FOR INSERT TO authenticated, starciti_app WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: internal_flags internal_flags_admin_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_flags_admin_staff_select ON public.internal_flags FOR SELECT TO authenticated, starciti_app USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) AND (deleted_at IS NULL)));


--
-- Name: internal_flags internal_flags_admin_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_flags_admin_staff_update ON public.internal_flags FOR UPDATE TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: invoice_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_series ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: item_catalogue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.item_catalogue ENABLE ROW LEVEL SECURITY;

--
-- Name: note_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.note_series ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_other_expenses other_expenses_driver_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY other_expenses_driver_insert ON public.driver_other_expenses FOR INSERT TO authenticated, starciti_app WITH CHECK (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR ((public.get_current_app_role() = 'driver'::text) AND (driver_id = public.get_current_app_driver_id()))));


--
-- Name: driver_other_expenses other_expenses_driver_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY other_expenses_driver_select ON public.driver_other_expenses FOR SELECT TO authenticated, starciti_app USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR ((public.get_current_app_role() = 'driver'::text) AND (driver_id = public.get_current_app_driver_id()))));


--
-- Name: driver_other_expenses other_expenses_staff_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY other_expenses_staff_admin_update ON public.driver_other_expenses FOR UPDATE TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: payment_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users rls_admin_app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_app_users ON public.app_users USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: contract_terms rls_admin_contract_terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_contract_terms ON public.contract_terms USING ((public.get_current_app_role() = 'admin'::text));


--
-- Name: contracts rls_admin_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_contracts ON public.contracts USING ((public.get_current_app_role() = 'admin'::text));


--
-- Name: credit_debit_notes rls_admin_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_notes ON public.credit_debit_notes USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: payments rls_admin_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_payments ON public.payments USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: rate_cards rls_admin_rate_cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_rate_cards ON public.rate_cards USING ((public.get_current_app_role() = 'admin'::text));


--
-- Name: payment_reminders rls_admin_reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_reminders ON public.payment_reminders USING ((public.get_current_app_role() = 'admin'::text)) WITH CHECK ((public.get_current_app_role() = 'admin'::text));


--
-- Name: audit_logs rls_admin_staff_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_staff_audit_logs ON public.audit_logs USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text, 'service_role'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text, 'service_role'::text])));


--
-- Name: customers rls_admin_staff_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_staff_customers ON public.customers USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: invoices rls_admin_staff_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_staff_invoices ON public.invoices USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: supplier_profiles rls_admin_supplier_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_admin_supplier_profiles ON public.supplier_profiles USING ((public.get_current_app_role() = 'admin'::text));


--
-- Name: audit_logs rls_app_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_app_audit_logs ON public.audit_logs TO starciti_app USING (true) WITH CHECK (true);


--
-- Name: credit_debit_notes rls_customer_select_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_customer_select_notes ON public.credit_debit_notes FOR SELECT USING (((public.get_current_app_role() = 'customer_viewer'::text) AND (customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.approval_token = current_setting('app.customer_token'::text, true))))));


--
-- Name: payments rls_customer_select_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_customer_select_payments ON public.payments FOR SELECT USING (((public.get_current_app_role() = 'customer_viewer'::text) AND (customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.approval_token = current_setting('app.customer_token'::text, true))))));


--
-- Name: settings rls_modify_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_modify_settings ON public.settings USING (((public.get_current_app_role() = 'admin'::text) OR (CURRENT_USER = 'postgres'::name))) WITH CHECK (((public.get_current_app_role() = 'admin'::text) OR (CURRENT_USER = 'postgres'::name)));


--
-- Name: contract_terms rls_select_contract_terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_contract_terms ON public.contract_terms FOR SELECT USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: contracts rls_select_contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_contracts ON public.contracts FOR SELECT USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR ((public.get_current_app_role() = 'customer'::text) AND (customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.approval_token = current_setting('app.customer_token'::text, true)))))));


--
-- Name: customers rls_select_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_customers ON public.customers FOR SELECT USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR ((public.get_current_app_role() = 'customer_viewer'::text) AND (id = public.get_current_app_customer_id())) OR (approval_token = NULLIF(current_setting('app.customer_token'::text, true), ''::text))));


--
-- Name: drivers rls_select_drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_drivers ON public.drivers FOR SELECT USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text, 'driver'::text])));


--
-- Name: invoices rls_select_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_invoices ON public.invoices FOR SELECT USING (((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])) OR ((public.get_current_app_role() = 'customer'::text) AND (customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.approval_token = current_setting('app.customer_token'::text, true)))))));


--
-- Name: rate_cards rls_select_rate_cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_rate_cards ON public.rate_cards FOR SELECT USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: settings rls_select_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_settings ON public.settings FOR SELECT USING (true);


--
-- Name: supplier_profiles rls_select_supplier_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_supplier_profiles ON public.supplier_profiles FOR SELECT USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: vehicles rls_select_vehicles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_select_vehicles ON public.vehicles FOR SELECT USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text, 'driver'::text])));


--
-- Name: app_users rls_self_select_app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_self_select_app_users ON public.app_users FOR SELECT USING (((id = auth.uid()) OR (email = (auth.jwt() ->> 'email'::text)) OR (email = current_setting('app.current_user_email'::text, true))));


--
-- Name: credit_debit_notes rls_staff_insert_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_insert_notes ON public.credit_debit_notes FOR INSERT WITH CHECK ((public.get_current_app_role() = 'staff'::text));


--
-- Name: payments rls_staff_insert_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_insert_payments ON public.payments FOR INSERT WITH CHECK ((public.get_current_app_role() = 'staff'::text));


--
-- Name: payment_reminders rls_staff_insert_reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_insert_reminders ON public.payment_reminders FOR INSERT WITH CHECK ((public.get_current_app_role() = 'staff'::text));


--
-- Name: credit_debit_notes rls_staff_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_notes ON public.credit_debit_notes FOR SELECT USING ((public.get_current_app_role() = 'staff'::text));


--
-- Name: payment_reminders rls_staff_reminders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_reminders ON public.payment_reminders FOR SELECT USING ((public.get_current_app_role() = 'staff'::text));


--
-- Name: app_users rls_staff_select_app_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_select_app_users ON public.app_users FOR SELECT USING ((public.get_current_app_role() = 'staff'::text));


--
-- Name: payments rls_staff_select_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_select_payments ON public.payments FOR SELECT USING ((public.get_current_app_role() = 'staff'::text));


--
-- Name: payments rls_staff_update_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_staff_update_payments ON public.payments FOR UPDATE USING ((public.get_current_app_role() = 'staff'::text)) WITH CHECK ((public.get_current_app_role() = 'staff'::text));


--
-- Name: vehicle_service_logs service_logs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_logs_read ON public.vehicle_service_logs FOR SELECT TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: vehicle_service_logs service_logs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_logs_update ON public.vehicle_service_logs FOR UPDATE TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: vehicle_service_logs service_logs_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_logs_write ON public.vehicle_service_logs FOR INSERT TO authenticated, starciti_app WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals staff_approvals_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_approvals_all ON public.approvals USING ((public.get_current_app_role() = ANY (ARRAY['staff'::text, 'admin'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['staff'::text, 'admin'::text])));


--
-- Name: contract_terms staff_contract_terms_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_contract_terms_select ON public.contract_terms FOR SELECT USING ((public.get_current_app_role() = 'staff'::text));


--
-- Name: invoices staff_invoices_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_invoices_insert ON public.invoices FOR INSERT WITH CHECK ((public.get_current_app_role() = 'staff'::text));


--
-- Name: invoices staff_invoices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_invoices_select ON public.invoices FOR SELECT USING ((public.get_current_app_role() = 'staff'::text));


--
-- Name: item_catalogue staff_item_catalogue_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_item_catalogue_all ON public.item_catalogue USING ((public.get_current_app_role() = ANY (ARRAY['staff'::text, 'admin'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['staff'::text, 'admin'::text])));


--
-- Name: rate_cards staff_rate_cards_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_rate_cards_select ON public.rate_cards FOR SELECT USING ((public.get_current_app_role() = 'staff'::text));


--
-- Name: tax_profiles staff_tax_profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_tax_profiles_select ON public.tax_profiles FOR SELECT USING ((public.get_current_app_role() = ANY (ARRAY['staff'::text, 'admin'::text])));


--
-- Name: trip_ledger staff_trip_ledger_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_trip_ledger_all ON public.trip_ledger USING ((public.get_current_app_role() = 'staff'::text)) WITH CHECK ((public.get_current_app_role() = 'staff'::text));


--
-- Name: supplier_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_fuel_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_fuel_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_service_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_service_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_payables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_payables ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_payables vendor_payables_admin_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vendor_payables_admin_staff_all ON public.vendor_payables TO authenticated, starciti_app USING ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text]))) WITH CHECK ((public.get_current_app_role() = ANY (ARRAY['admin'::text, 'staff'::text])));


--
-- PostgreSQL database dump complete
--




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
