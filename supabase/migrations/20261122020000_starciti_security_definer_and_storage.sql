-- ============================================================================
-- Migration: Security Definer Token Verification & Storage RLS Policies
-- ============================================================================

-- 1. SECURITY DEFINER FUNCTION FOR TOKEN VALIDATION WITH RATE LIMITING
CREATE OR REPLACE FUNCTION verify_and_redeem_approval_token(p_token_hash TEXT)
RETURNS TABLE (
    approval_id UUID,
    contract_id UUID,
    customer_id UUID,
    year_month VARCHAR,
    status VARCHAR,
    is_valid BOOLEAN,
    rejection_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execution to starciti_app
GRANT EXECUTE ON FUNCTION verify_and_redeem_approval_token(TEXT) TO starciti_app;

-- 2. STORAGE OBJECTS SCHEMA & RLS FOR ODOMETER PHOTOS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- Only create mock storage.objects if running in a standalone Postgres without Supabase storage engine
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id TEXT NOT NULL DEFAULT 'odometer-photos',
      name TEXT NOT NULL, -- e.g. 'd0000000-0000-0000-0000-000000000001/photo.jpg'
      owner_id UUID,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO starciti_app;
    GRANT USAGE ON SCHEMA storage TO starciti_app;
  END IF;
END $$;

DROP POLICY IF EXISTS "storage_driver_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_driver_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_staff_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_all" ON storage.objects;

-- Driver can ONLY insert to their own folder (driver_id/*)
CREATE POLICY "storage_driver_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_role', true) = 'driver'
        AND name LIKE (current_setting('app.current_user_id', true) || '/%')
    );

-- Driver can ONLY select from their own folder
CREATE POLICY "storage_driver_select" ON storage.objects
    FOR SELECT
    USING (
        current_setting('app.current_role', true) = 'driver'
        AND name LIKE (current_setting('app.current_user_id', true) || '/%')
    );

-- Staff can read all photos across fleet (no edit)
CREATE POLICY "storage_staff_select" ON storage.objects
    FOR SELECT
    USING (
        current_setting('app.current_role', true) IN ('staff', 'admin')
    );

-- Admin has full access
CREATE POLICY "storage_admin_all" ON storage.objects
    FOR ALL
    USING (current_setting('app.current_role', true) = 'admin')
    WITH CHECK (current_setting('app.current_role', true) = 'admin');

DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO starciti_app;
  GRANT USAGE ON SCHEMA storage TO starciti_app;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
