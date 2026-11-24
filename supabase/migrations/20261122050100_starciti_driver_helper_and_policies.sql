-- 0. Ensure driver_id column exists on app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id);

UPDATE public.app_users 
SET driver_id = 'd0000000-0000-0000-0000-000000000001'
WHERE id = 'c0000000-0000-0000-0000-000000000003';

UPDATE public.app_users 
SET driver_id = 'd0000000-0000-0000-0000-000000000004'
WHERE id = 'c0000000-0000-0000-0000-000000000005';

-- 1. Helper function to get authenticated driver_id securely
CREATE OR REPLACE FUNCTION get_current_app_driver_id()
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_app_driver_id() TO starciti_app;

-- 2. Update trip_ledger driver and customer policies
DROP POLICY IF EXISTS driver_trip_ledger_select ON trip_ledger;
DROP POLICY IF EXISTS driver_trip_ledger_insert ON trip_ledger;
DROP POLICY IF EXISTS driver_trip_ledger_update ON trip_ledger;
DROP POLICY IF EXISTS customer_trip_ledger_select ON trip_ledger;

CREATE POLICY driver_trip_ledger_select ON trip_ledger
  FOR SELECT
  USING (
    get_current_app_role() = 'driver'
    AND driver_id = get_current_app_driver_id()
  );

CREATE POLICY driver_trip_ledger_insert ON trip_ledger
  FOR INSERT
  WITH CHECK (
    get_current_app_role() = 'driver'
    AND driver_id = get_current_app_driver_id()
  );

CREATE POLICY driver_trip_ledger_update ON trip_ledger
  FOR UPDATE
  USING (
    get_current_app_role() = 'driver'
    AND driver_id = get_current_app_driver_id()
  );

CREATE POLICY customer_trip_ledger_select ON trip_ledger
  FOR SELECT
  USING (
    (get_current_app_role() = 'customer_viewer' AND contract_id IN (
      SELECT id FROM contracts WHERE customer_id IN (
        SELECT id FROM customers WHERE email = (SELECT email FROM app_users WHERE id = auth.uid())
      )
    ))
    OR
    (contract_id IN (
      SELECT a.contract_id FROM approvals a
      WHERE a.token_hash = NULLIF(current_setting('app.current_token_hash', true), '')
        AND a.is_revoked = FALSE
        AND a.expires_at > NOW()
    ))
  );

-- 3. Update approvals policies
DROP POLICY IF EXISTS admin_approvals_all ON approvals;
DROP POLICY IF EXISTS staff_approvals_all ON approvals;
DROP POLICY IF EXISTS customer_approvals_select ON approvals;

CREATE POLICY admin_approvals_all ON approvals
  FOR ALL
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

CREATE POLICY staff_approvals_all ON approvals
  FOR ALL
  USING (get_current_app_role() IN ('staff', 'admin'))
  WITH CHECK (get_current_app_role() IN ('staff', 'admin'));

CREATE POLICY customer_approvals_select ON approvals
  FOR SELECT
  USING (
    (get_current_app_role() = 'customer_viewer' AND customer_id IN (
      SELECT id FROM customers WHERE email = (SELECT email FROM app_users WHERE id = auth.uid())
    ))
    OR
    (token_hash = NULLIF(current_setting('app.current_token_hash', true), '')
      AND is_revoked = FALSE
      AND expires_at > NOW())
  );

-- 4. Storage objects policies with JWT support
DROP POLICY IF EXISTS "storage_driver_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_driver_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_staff_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_all" ON storage.objects;

CREATE POLICY "storage_driver_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    (get_current_app_role() = 'driver' AND name LIKE (COALESCE(get_current_app_driver_id()::TEXT, '') || '/%'))
    OR
    (current_setting('app.current_role', true) = 'driver' AND name LIKE (current_setting('app.current_user_id', true) || '/%'))
  );

CREATE POLICY "storage_driver_select" ON storage.objects
  FOR SELECT
  USING (
    (get_current_app_role() = 'driver' AND name LIKE (COALESCE(get_current_app_driver_id()::TEXT, '') || '/%'))
    OR
    (current_setting('app.current_role', true) = 'driver' AND name LIKE (current_setting('app.current_user_id', true) || '/%'))
  );

CREATE POLICY "storage_staff_select" ON storage.objects
  FOR SELECT
  USING (
    get_current_app_role() IN ('admin', 'staff')
    OR current_setting('app.current_role', true) IN ('admin', 'staff')
  );

CREATE POLICY "storage_admin_all" ON storage.objects
  FOR ALL
  USING (
    get_current_app_role() = 'admin'
    OR current_setting('app.current_role', true) = 'admin'
  )
  WITH CHECK (
    get_current_app_role() = 'admin'
    OR current_setting('app.current_role', true) = 'admin'
  );
