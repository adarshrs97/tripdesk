-- ==============================================================================
-- Migration: Add p_series_prefix to issue_invoice_atomic
-- Enables completely isolated TEST series (prefix 'TEST-') for pilot tests
-- Combines p_issue_date and p_series_prefix while dropping legacy overloads
-- ==============================================================================

DROP FUNCTION IF EXISTS issue_invoice_atomic(UUID, UUID, UUID, DATE, DATE, NUMERIC, JSONB, TEXT, INT, TEXT, TEXT, JSONB, DATE);
DROP FUNCTION IF EXISTS issue_invoice_atomic(UUID, UUID, UUID, DATE, DATE, NUMERIC, JSONB, TEXT, INT, TEXT, TEXT, JSONB, TEXT);
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
  p_issue_date DATE DEFAULT CURRENT_DATE,
  p_series_prefix TEXT DEFAULT ''
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION issue_invoice_atomic TO starciti_app;
