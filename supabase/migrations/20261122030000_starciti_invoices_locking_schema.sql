-- Migration: Invoices Locking, Snapshot Storage, and Row-Locked Gap-Free Numbering
-- Schema version: 20261122030000

-- 1. ADD LOCKING & SNAPSHOT COLUMNS TO INVOICES
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS template_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS issued_by TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS breakup_json JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. ADD LOCKING COLUMNS TO TRIP_LEDGER
ALTER TABLE trip_ledger
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_trip_ledger_invoice_id ON trip_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_trip_ledger_is_locked ON trip_ledger(is_locked);

-- 3. SEED INITIAL INVOICE SERIES FOR SUPPLIER PROFILES
-- M/S City Tours & Travels starts at 108190 -> next is 108191
-- StarCiti Group starts at 106562 -> next is 106563
INSERT INTO invoice_series (supplier_id, prefix, financial_year, current_number)
VALUES 
  ('a0000000-0000-0000-0000-000000000002', '', '2026-27', 108190),
  ('a0000000-0000-0000-0000-000000000001', '', '2026-27', 106562),
  ('a0000000-0000-0000-0000-000000000003', 'SCT', '2026-27', 1000)
ON CONFLICT (supplier_id, prefix, financial_year) 
DO UPDATE SET current_number = EXCLUDED.current_number;

-- 4. ATOMIC ROW-LOCKED INVOICE ISSUANCE FUNCTION
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

  -- 2. Increment gap-free sequence
  v_next_num := v_series.current_number + 1;
  UPDATE invoice_series
  SET current_number = v_next_num, updated_at = NOW()
  WHERE id = v_series.id;

  -- Format invoice number
  IF v_series.prefix IS NOT NULL AND LENGTH(TRIM(v_series.prefix)) > 0 THEN
    v_inv_no := TRIM(v_series.prefix) || '-' || v_next_num::TEXT;
  ELSE
    v_inv_no := v_next_num::TEXT;
  END IF;

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
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
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

-- 5. TRIGGER: PREVENT MODIFICATION OR DELETION OF LOCKED INVOICES
CREATE OR REPLACE FUNCTION trg_check_invoice_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.status = 'locked') THEN
    RAISE EXCEPTION 'Invoice % is permanently locked and cannot be deleted. Any adjustments must be made via Credit or Debit Notes.', OLD.invoice_number;
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.status = 'locked') THEN
    RAISE EXCEPTION 'Invoice % is permanently locked and cannot be modified. Any adjustments must be made via Credit or Debit Notes.', OLD.invoice_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_lock_guard ON invoices;
CREATE TRIGGER trg_invoice_lock_guard
BEFORE UPDATE OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION trg_check_invoice_locked();

-- 6. TRIGGER: PREVENT MODIFICATION OR DELETION OF LOCKED TRIP LEDGER ROWS
CREATE OR REPLACE FUNCTION trg_check_trip_ledger_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.is_locked = TRUE) THEN
    RAISE EXCEPTION 'Trip ledger entry on % is locked by invoice % and cannot be deleted.', OLD.trip_date, OLD.invoice_id;
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.is_locked = TRUE) THEN
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

-- 7. GRANTS FOR APPLICATION USER
GRANT SELECT, INSERT, UPDATE ON invoices TO starciti_app;
GRANT SELECT, INSERT, UPDATE ON trip_ledger TO starciti_app;
GRANT SELECT, INSERT, UPDATE ON invoice_series TO starciti_app;
GRANT EXECUTE ON FUNCTION issue_invoice_atomic TO starciti_app;
