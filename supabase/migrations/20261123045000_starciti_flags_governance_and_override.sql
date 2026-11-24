-- ==============================================================================
-- Milestone 7c Follow-up: Flags Governance, Audit, Soft-Delete & Admin Override
-- 1. "Avoid" flag requires admin override with written reason (logged), not unconditional block.
-- 2. Soft-delete only (deleted_at, deleted_by) - rows never physically destroyed.
-- 3. Audit trail (created_by, updated_by, view_audit) and configurable retention period.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Add override tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'internal_flags' AND column_name = 'admin_override_reason'
  ) THEN
    ALTER TABLE internal_flags ADD COLUMN admin_override_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'internal_flags' AND column_name = 'overridden_by'
  ) THEN
    ALTER TABLE internal_flags ADD COLUMN overridden_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'internal_flags' AND column_name = 'overridden_at'
  ) THEN
    ALTER TABLE internal_flags ADD COLUMN overridden_at TIMESTAMPTZ;
  END IF;

  -- 2. Add soft-delete columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'internal_flags' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE internal_flags ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'internal_flags' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE internal_flags ADD COLUMN deleted_by TEXT;
  END IF;

  -- 3. Add retention period and view audit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'internal_flags' AND column_name = 'retention_months'
  ) THEN
    ALTER TABLE internal_flags ADD COLUMN retention_months INT DEFAULT 12;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'internal_flags' AND column_name = 'view_audit'
  ) THEN
    ALTER TABLE internal_flags ADD COLUMN view_audit JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 4. Update RLS policies to enforce soft-delete visibility
DROP POLICY IF EXISTS "internal_flags_admin_staff_select" ON internal_flags;
CREATE POLICY "internal_flags_admin_staff_select" ON internal_flags
  FOR SELECT TO authenticated, starciti_app
  USING (
    get_current_app_role() IN ('admin', 'staff')
    AND deleted_at IS NULL
  );

-- Function for soft-deleting an internal flag
CREATE OR REPLACE FUNCTION soft_delete_internal_flag(
  p_flag_id UUID,
  p_deleted_by TEXT DEFAULT get_current_app_role()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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
