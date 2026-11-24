-- ==============================================================================
-- Migration: 20261123070000_starciti_fix_real_data_provenance.sql
-- 1. Ensure customers table has is_sample_data column
-- 2. Mark real master records as is_sample_data = FALSE:
--    - Customers: M/s Vindhya Telelinks Limited, Global Public School (real invoice photo)
--    - Vehicles: KL01 CP 3284, KL82 4889, KL74 E 3694, KL21 M 2378
--    - Drivers: Hemanth Kumar, Muhammad Fayaz.s, Asheerkhan, Afzal
-- 3. Stored procedure remove_all_sample_data() ensures ZERO real records are touched
-- ==============================================================================

-- 1. Add is_sample_data to customers if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'is_sample_data'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_sample_data BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Strictly classify Real Confirmed Owner Records
-- Customers (Both VTL and Global Public School are real from owner invoice photos)
UPDATE customers
SET is_sample_data = FALSE, is_active = TRUE
WHERE id IN (
  'c0000000-0000-0000-0000-000000000001', -- M/s Vindhya Telelinks Limited
  'c0000000-0000-0000-0000-000000000002'  -- Global Public School
) OR name ILIKE '%Vindhya%' OR name ILIKE '%Global Public School%';

-- Vehicles (All 4 vehicles from owner files: KL01CP3284, KL824889, KL74E3694, KL21M2378)
UPDATE vehicles
SET is_sample_data = FALSE, is_active = TRUE
WHERE reg_no IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378')
   OR display_reg_no IN ('KL-01-CP-3284', 'KL-82-4889', 'KL-74-E-3694', 'KL-21-M-2378');

-- Ensure make_model for KL01CP3284 matches exact VTL invoice text
UPDATE vehicles
SET make_model = '7-Seat AC Car'
WHERE reg_no = 'KL01CP3284' OR display_reg_no = 'KL-01-CP-3284';

-- Mark any other vehicles (like demo KL01BZ4111) as sample data
UPDATE vehicles
SET is_sample_data = TRUE
WHERE reg_no NOT IN ('KL01CP3284', 'KL824889', 'KL74E3694', 'KL21M2378');

-- Drivers (All 4 drivers from owner roster are real and active)
UPDATE drivers
SET is_active = TRUE
WHERE id IN (
  'd0000000-0000-0000-0000-000000000001', -- Hemanth Kumar
  'd0000000-0000-0000-0000-000000000002', -- Muhammad Fayaz.s
  'd0000000-0000-0000-0000-000000000003', -- Asheerkhan
  'd0000000-0000-0000-0000-000000000004'  -- Afzal
);

-- 3. Stored Procedure: remove_all_sample_data()
-- Atomic deletion of demo records with GUARANTEE that zero real entities are deleted or deactivated.
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

GRANT EXECUTE ON FUNCTION remove_all_sample_data() TO starciti_app, authenticated;
