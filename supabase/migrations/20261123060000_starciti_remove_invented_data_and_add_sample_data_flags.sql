-- ==============================================================================
-- Migration: 20261123060000_starciti_remove_invented_data_and_add_sample_data_flags.sql
-- 1. Add is_sample_data column to core tables
-- 2. Remove invented data:
--    - KL01 CP 3284 has NO invented Ertiga model (make_model = '7-Seat AC Car' from invoice; vehicle_type = 'sedan')
--    - Remove invented EMI links, monthly_emi_amount, and financiers
--    - Set bank names (SBI/HDFC) on supplier_profiles to NULL unless provided
--    - Flag demo bank accounts, payables, cash transactions and EMI schedules as is_sample_data = TRUE
-- 3. Stored procedure remove_all_sample_data() (SECURITY DEFINER, Admin only)
--    One-click deletion of all sample records across the database.
-- ==============================================================================

-- 1. ADD is_sample_data COLUMNS
DO $$
BEGIN
  -- Vehicles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'is_sample_data'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN is_sample_data BOOLEAN DEFAULT FALSE;
  END IF;

  -- Bank Accounts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' AND column_name = 'is_sample_data'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN is_sample_data BOOLEAN DEFAULT FALSE;
  END IF;

  -- Bank Transactions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'is_sample_data'
  ) THEN
    ALTER TABLE bank_transactions ADD COLUMN is_sample_data BOOLEAN DEFAULT FALSE;
  END IF;

  -- Vendor Payables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_payables' AND column_name = 'is_sample_data'
  ) THEN
    ALTER TABLE vendor_payables ADD COLUMN is_sample_data BOOLEAN DEFAULT FALSE;
  END IF;

  -- EMI Schedules
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emi_schedules' AND column_name = 'is_sample_data'
  ) THEN
    ALTER TABLE emi_schedules ADD COLUMN is_sample_data BOOLEAN DEFAULT FALSE;
  END IF;

  -- Cash Transactions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_transactions' AND column_name = 'is_sample_data'
  ) THEN
    ALTER TABLE cash_transactions ADD COLUMN is_sample_data BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. CLEAN UP INVENTED DATA ON REAL VEHICLE KL 01 CP 3284
-- The owner confirmed only '7-Seat AC Car' from the invoice; NO invented Ertiga model, NO invented EMI link
UPDATE vehicles
SET 
  make_model = '7-Seat AC Car',
  vehicle_type = 'sedan',
  monthly_emi_amount = NULL,
  emi_due_day = NULL,
  emi_financier = NULL,
  emi_account_no = NULL,
  is_sample_data = FALSE
WHERE reg_no = 'KL01CP3284' OR display_reg_no = 'KL-01-CP-3284';

-- Mark non-VTL-owner vehicles as sample data
UPDATE vehicles
SET is_sample_data = TRUE
WHERE reg_no NOT IN ('KL01CP3284');

-- Drop NOT NULL constraint on bank columns so bank details are truly optional (empty by default)
ALTER TABLE supplier_profiles ALTER COLUMN bank_name DROP NOT NULL;
ALTER TABLE supplier_profiles ALTER COLUMN account_number DROP NOT NULL;
ALTER TABLE supplier_profiles ALTER COLUMN ifsc DROP NOT NULL;

-- Clean up bank details on supplier profiles (no invented SBI / HDFC accounts unless owner provides them)
UPDATE supplier_profiles
SET 
  bank_name = NULL,
  account_number = NULL,
  ifsc = NULL,
  upi_id = NULL
WHERE id IN ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');

-- Mark demo bank accounts, EMI schedules, payables, and cash entries as sample data
UPDATE bank_accounts SET is_sample_data = TRUE;
UPDATE bank_transactions SET is_sample_data = TRUE;
UPDATE emi_schedules SET is_sample_data = TRUE;
UPDATE vendor_payables SET is_sample_data = TRUE;
UPDATE cash_transactions SET is_sample_data = TRUE;

-- 3. STORED PROCEDURE: remove_all_sample_data()
-- Deletes every seeded demo record not provided by the owner in a single atomic transaction.
CREATE OR REPLACE FUNCTION remove_all_sample_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cash_deleted INT := 0;
  v_bank_deleted INT := 0;
  v_bank_tx_deleted INT := 0;
  v_payables_deleted INT := 0;
  v_emi_deleted INT := 0;
  v_vehicles_deleted INT := 0;
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

  -- 6. Soft-delete / deactivate sample vehicles (preserving KL01CP3284)
  UPDATE vehicles 
  SET is_active = FALSE 
  WHERE is_sample_data = TRUE AND reg_no NOT IN ('KL01CP3284');
  GET DIAGNOSTICS v_vehicles_deleted = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'deleted_cash_transactions', v_cash_deleted,
    'deleted_bank_transactions', v_bank_tx_deleted,
    'deleted_bank_accounts', v_bank_deleted,
    'deleted_vendor_payables', v_payables_deleted,
    'deleted_emi_schedules', v_emi_deleted,
    'deactivated_sample_vehicles', v_vehicles_deleted,
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_all_sample_data() TO starciti_app, authenticated;
