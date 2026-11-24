-- ==============================================================================
-- Migration: 20261123080000_starciti_force_rls_and_invoice_immutability.sql
-- Milestone 9 Hardening:
-- 1. FORCE ROW LEVEL SECURITY on all core tables (enforcing RLS even for table owners)
-- 2. Refine trg_check_invoice_locked() so any non-draft invoice is permanently locked
-- 3. Set locked_at on any historical issued invoices
-- ==============================================================================

-- 1. FORCE ROW LEVEL SECURITY ON CORE TABLES
ALTER TABLE supplier_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE drivers FORCE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;
ALTER TABLE rate_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_ledger FORCE ROW LEVEL SECURITY;

-- 2. POPULATE locked_at FOR HISTORICAL INVOICES
UPDATE invoices
SET locked_at = COALESCE(locked_at, created_at, NOW())
WHERE status != 'draft' AND locked_at IS NULL;

-- 3. REFINED INVOICE IMMUTABILITY TRIGGER
-- Activates whenever locked_at IS NOT NULL OR status != 'draft'
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
