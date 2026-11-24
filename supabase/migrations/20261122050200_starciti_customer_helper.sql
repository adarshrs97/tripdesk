ALTER TABLE app_users ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
UPDATE customers SET email = 'admin@vindhyatelelinks.com' WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE customers SET email = 'accounts@loyolatvm.edu.in' WHERE id = 'c0000000-0000-0000-0000-000000000002';
UPDATE app_users SET customer_id = 'c0000000-0000-0000-0000-000000000001' WHERE email = 'admin@vindhyatelelinks.com';

CREATE OR REPLACE FUNCTION get_current_app_customer_id()
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_app_customer_id() TO starciti_app;

-- Update customers and invoices policies to use get_current_app_customer_id()
DROP POLICY IF EXISTS rls_select_customers ON customers;
CREATE POLICY rls_select_customers ON customers FOR SELECT
  USING (
    get_current_app_role() IN ('admin', 'staff')
    OR (
      get_current_app_role() = 'customer_viewer'
      AND id = get_current_app_customer_id()
    )
    OR (
      approval_token = NULLIF(current_setting('app.customer_token', true), '')
    )
  );

DROP POLICY IF EXISTS customer_invoices_select ON invoices;
CREATE POLICY customer_invoices_select ON invoices FOR SELECT
  USING (
    get_current_app_role() = 'customer_viewer'
    AND customer_id = get_current_app_customer_id()
  );
