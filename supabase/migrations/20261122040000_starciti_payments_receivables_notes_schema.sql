-- Migration: Payments, Receivables, TDS, Credit/Debit Notes, Series Administration & User Management
-- Schema version: 20261122040000

-- 1. APP USERS TABLE
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  name TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'driver', 'customer_viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Seed Initial App Users from Reference Personas
INSERT INTO app_users (id, email, phone, name, role, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'ratnaraaj@yahoo.com', '+91 6238603200', 'M. Ratnaraj', 'admin', TRUE),
  ('c0000000-0000-0000-0000-000000000002', 'operations@starciti.com', '+91 8136910938', 'Office Operations Staff', 'staff', TRUE),
  ('c0000000-0000-0000-0000-000000000003', 'hemanth@starciti.com', '+91 9447123456', 'Hemanth Kumar', 'driver', TRUE),
  ('c0000000-0000-0000-0000-000000000004', 'admin@vindhyatelelinks.com', '+91 9846012345', 'VTL Billing Coordinator', 'customer_viewer', TRUE)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- 2. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_received NUMERIC(12, 2) NOT NULL CHECK (amount_received >= 0),
  tds_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tds_deducted >= 0),
  tds_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('cash', 'upi', 'bank_transfer', 'cheque')),
  reference_no TEXT,
  notes TEXT,
  excess_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- 3. NOTE SERIES TABLE (Credit & Debit Notes)
CREATE TABLE IF NOT EXISTS note_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  note_type VARCHAR(10) NOT NULL CHECK (note_type IN ('credit', 'debit')),
  prefix VARCHAR(10) NOT NULL,
  financial_year VARCHAR(10) NOT NULL DEFAULT '2026-27',
  current_number INT NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (supplier_id, note_type, prefix, financial_year)
);

-- Seed note series
INSERT INTO note_series (supplier_id, note_type, prefix, financial_year, current_number)
VALUES
  ('a0000000-0000-0000-0000-000000000002', 'credit', 'CN', '2026-27', 1000),
  ('a0000000-0000-0000-0000-000000000002', 'debit', 'DN', '2026-27', 1000),
  ('a0000000-0000-0000-0000-000000000001', 'credit', 'CN', '2026-27', 1000),
  ('a0000000-0000-0000-0000-000000000001', 'debit', 'DN', '2026-27', 1000)
ON CONFLICT (supplier_id, note_type, prefix, financial_year) DO NOTHING;

-- 4. CREDIT & DEBIT NOTES TABLE
CREATE TABLE IF NOT EXISTS credit_debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_type VARCHAR(10) NOT NULL CHECK (note_type IN ('credit', 'debit')),
  note_number TEXT UNIQUE NOT NULL,
  original_invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id TEXT NOT NULL DEFAULT 'format_credit_debit_v1',
  status VARCHAR(20) NOT NULL DEFAULT 'locked',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_inv ON credit_debit_notes(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_cust ON credit_debit_notes(customer_id);

-- 5. PAYMENT REMINDERS TABLE
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reminder_type VARCHAR(30) NOT NULL CHECK (reminder_type IN ('due_minus_3', 'due_date', 'overdue_7', 'overdue_14', 'custom')),
  recipient_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_inv ON payment_reminders(invoice_id);

-- 6. REFINED IMMUTABILITY TRIGGER ON INVOICES & TRIP LEDGER
-- Allows status transitions (issued -> sent -> part_paid -> paid -> overdue / cancelled) and admin notes,
-- while strictly preserving financial amounts, invoice numbers, customer, supplier, and dates.
CREATE OR REPLACE FUNCTION trg_check_invoice_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.locked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Invoice % is permanently locked and cannot be deleted. Any adjustments must be made via Credit or Debit Notes.', OLD.invoice_number;
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.locked_at IS NOT NULL) THEN
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

-- Refined Trip Ledger Lock Guard: Allows unlock transition (is_locked -> FALSE, invoice_id -> NULL)
-- but strictly prevents editing or deletion while locked.
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

-- 7. REFRESH INVOICE PAYMENT STATUS FUNCTION
CREATE OR REPLACE FUNCTION refresh_invoice_payment_status(p_invoice_id UUID)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TRIGGERS TO AUTO-REFRESH STATUS ON PAYMENT / NOTE ACTIVITY
CREATE OR REPLACE FUNCTION trg_payment_refresh_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_invoice_payment_status(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_invoice_payment_status(NEW.invoice_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_after_change ON payments;
CREATE TRIGGER trg_payment_after_change
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION trg_payment_refresh_invoice();

CREATE OR REPLACE FUNCTION trg_note_refresh_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_invoice_payment_status(OLD.original_invoice_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_invoice_payment_status(NEW.original_invoice_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_note_after_change ON credit_debit_notes;
CREATE TRIGGER trg_note_after_change
AFTER INSERT OR UPDATE OR DELETE ON credit_debit_notes
FOR EACH ROW
EXECUTE FUNCTION trg_note_refresh_invoice();

-- 9. ADMIN "SET NEXT NUMBER" PER SERIES (WITH MANDATORY AUDIT LOG)
CREATE OR REPLACE FUNCTION admin_set_invoice_series_number(
  p_series_id UUID,
  p_next_number INT,
  p_reason TEXT,
  p_admin_user TEXT
)
RETURNS JSONB AS $$
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

  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. CANCEL INVOICE FUNCTION (KEEPS NUMBER AS CANCELLED, UNLOCKS TRIP ENTRIES, NEVER REUSES)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. ENHANCED ATOMIC INVOICE ISSUANCE FUNCTION (WITH DUPLICATE ADVANCE PROTECTION)
DROP FUNCTION IF EXISTS issue_invoice_atomic(UUID, UUID, UUID, DATE, DATE, NUMERIC, JSONB, TEXT, INT, TEXT, TEXT, JSONB);
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
  p_breakup_json JSONB DEFAULT NULL,
  p_issue_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_series RECORD;
  v_next_num INT;
  v_inv_no TEXT;
  v_invoice_id UUID;
  v_locked_count INT;
BEGIN
  -- 1. Exclusively row-lock the invoice series record for this supplier
  SELECT * INTO v_series
  FROM invoice_series
  WHERE supplier_id = p_supplier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO invoice_series (supplier_id, prefix, financial_year, current_number)
    VALUES (p_supplier_id, '', '2026-27', 1000)
    RETURNING * INTO v_series;
  END IF;

  -- 2. Increment gap-free sequence and advance past any existing numbers
  v_next_num := v_series.current_number + 1;
  LOOP
    IF v_series.prefix IS NOT NULL AND LENGTH(TRIM(v_series.prefix)) > 0 THEN
      v_inv_no := TRIM(v_series.prefix) || '-' || v_next_num::TEXT;
    ELSE
      v_inv_no := v_next_num::TEXT;
    END IF;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM invoices WHERE supplier_id = p_supplier_id AND invoice_number = v_inv_no
    );
    v_next_num := v_next_num + 1;
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
    p_issue_date,
    p_issue_date + INTERVAL '30 days',
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

  -- 4. Lock ledger rows for this contract and billing period
  UPDATE trip_ledger
  SET is_locked = TRUE,
      invoice_id = v_invoice_id,
      updated_at = NOW()
  WHERE contract_id = p_contract_id
    AND trip_date >= p_period_from
    AND trip_date <= p_period_to
    AND is_locked = FALSE;

  GET DIAGNOSTICS v_locked_count = ROW_COUNT;

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

-- 12. ATOMIC CREDIT / DEBIT NOTE ISSUANCE FUNCTION
CREATE OR REPLACE FUNCTION issue_credit_debit_note_atomic(
  p_original_invoice_id UUID,
  p_note_type VARCHAR(10),
  p_amount NUMERIC(12, 2),
  p_reason TEXT,
  p_snapshot_json JSONB DEFAULT '{}'::jsonb,
  p_template_id TEXT DEFAULT 'format_credit_debit_v1',
  p_created_by TEXT DEFAULT 'admin'
)
RETURNS JSONB AS $$
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

  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- APP USERS RLS
DROP POLICY IF EXISTS "rls_admin_app_users" ON app_users;
CREATE POLICY "rls_admin_app_users" ON app_users
  FOR ALL USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

DROP POLICY IF EXISTS "rls_staff_select_app_users" ON app_users;
CREATE POLICY "rls_staff_select_app_users" ON app_users
  FOR SELECT USING (get_current_app_role() = 'staff');

DROP POLICY IF EXISTS "rls_self_select_app_users" ON app_users;
CREATE POLICY "rls_self_select_app_users" ON app_users
  FOR SELECT USING (email = current_setting('app.current_user_email', true));

-- PAYMENTS RLS: Driver CANNOT view/touch money; Staff can read/write but NOT delete
DROP POLICY IF EXISTS "rls_admin_payments" ON payments;
CREATE POLICY "rls_admin_payments" ON payments
  FOR ALL USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

DROP POLICY IF EXISTS "rls_staff_select_payments" ON payments;
CREATE POLICY "rls_staff_select_payments" ON payments
  FOR SELECT USING (get_current_app_role() = 'staff');

DROP POLICY IF EXISTS "rls_staff_insert_payments" ON payments;
CREATE POLICY "rls_staff_insert_payments" ON payments
  FOR INSERT WITH CHECK (get_current_app_role() = 'staff');

DROP POLICY IF EXISTS "rls_staff_update_payments" ON payments;
CREATE POLICY "rls_staff_update_payments" ON payments
  FOR UPDATE USING (get_current_app_role() = 'staff')
  WITH CHECK (get_current_app_role() = 'staff');

-- Drivers are strictly blocked (no policy granted for driver)
DROP POLICY IF EXISTS "rls_customer_select_payments" ON payments;
CREATE POLICY "rls_customer_select_payments" ON payments
  FOR SELECT USING (
    get_current_app_role() = 'customer_viewer'
    AND customer_id IN (
      SELECT id FROM customers WHERE approval_token = current_setting('app.customer_token', true)
    )
  );

-- CREDIT / DEBIT NOTES RLS: Driver blocked; Staff can view/create; Locked notes cannot be deleted
DROP POLICY IF EXISTS "rls_admin_notes" ON credit_debit_notes;
CREATE POLICY "rls_admin_notes" ON credit_debit_notes
  FOR ALL USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

DROP POLICY IF EXISTS "rls_staff_notes" ON credit_debit_notes;
CREATE POLICY "rls_staff_notes" ON credit_debit_notes
  FOR SELECT USING (get_current_app_role() = 'staff');

DROP POLICY IF EXISTS "rls_staff_insert_notes" ON credit_debit_notes;
CREATE POLICY "rls_staff_insert_notes" ON credit_debit_notes
  FOR INSERT WITH CHECK (get_current_app_role() = 'staff');

DROP POLICY IF EXISTS "rls_customer_select_notes" ON credit_debit_notes;
CREATE POLICY "rls_customer_select_notes" ON credit_debit_notes
  FOR SELECT USING (
    get_current_app_role() = 'customer_viewer'
    AND customer_id IN (
      SELECT id FROM customers WHERE approval_token = current_setting('app.customer_token', true)
    )
  );

-- PAYMENT REMINDERS RLS
DROP POLICY IF EXISTS "rls_admin_reminders" ON payment_reminders;
CREATE POLICY "rls_admin_reminders" ON payment_reminders
  FOR ALL USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

DROP POLICY IF EXISTS "rls_staff_reminders" ON payment_reminders;
CREATE POLICY "rls_staff_reminders" ON payment_reminders
  FOR SELECT USING (get_current_app_role() = 'staff');

DROP POLICY IF EXISTS "rls_staff_insert_reminders" ON payment_reminders;
CREATE POLICY "rls_staff_insert_reminders" ON payment_reminders
  FOR INSERT WITH CHECK (get_current_app_role() = 'staff');

-- AUDIT LOGS RLS: Allow app service and staff/admin to log audit records
DROP POLICY IF EXISTS "rls_admin_staff_audit_logs" ON audit_logs;
CREATE POLICY "rls_admin_staff_audit_logs" ON audit_logs
  FOR ALL USING (get_current_app_role() IN ('admin', 'staff', 'service_role'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff', 'service_role'));

DROP POLICY IF EXISTS "rls_app_audit_logs" ON audit_logs;
CREATE POLICY "rls_app_audit_logs" ON audit_logs
  FOR ALL TO starciti_app
  USING (true)
  WITH CHECK (true);

-- 13. APPLICATION PERMISSIONS & GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON app_users TO starciti_app;
GRANT SELECT, INSERT, UPDATE ON audit_logs TO starciti_app;
GRANT SELECT, INSERT, UPDATE ON payments TO starciti_app;
GRANT SELECT, INSERT, UPDATE ON note_series TO starciti_app;
GRANT SELECT, INSERT ON credit_debit_notes TO starciti_app;
GRANT SELECT, INSERT ON payment_reminders TO starciti_app;
GRANT EXECUTE ON FUNCTION admin_set_invoice_series_number TO starciti_app;
GRANT EXECUTE ON FUNCTION cancel_invoice TO starciti_app;
GRANT EXECUTE ON FUNCTION issue_credit_debit_note_atomic TO starciti_app;
GRANT EXECUTE ON FUNCTION refresh_invoice_payment_status TO starciti_app;
