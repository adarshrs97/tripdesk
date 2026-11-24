DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starciti_app') THEN
    CREATE ROLE starciti_app LOGIN;
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO starciti_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO starciti_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO starciti_app;

BEGIN;
SET ROLE starciti_app;

-- Test 1: Admin can see invoices
SELECT set_config('app.current_role', 'admin', true);
SELECT 'Admin can see invoices:' AS test, COUNT(*) AS count FROM invoices;

-- Test 2: Driver CANNOT see invoices
SELECT set_config('app.current_role', 'driver', true);
SELECT 'Driver CANNOT see invoices:' AS test, COUNT(*) AS count FROM invoices;

-- Test 3: Staff can read rate cards
SELECT set_config('app.current_role', 'staff', true);
SELECT 'Staff can see rate cards:' AS test, COUNT(*) AS count FROM rate_cards;

-- Test 4: Customer sees only own record via approval token
SELECT set_config('app.current_role', 'customer', true);
SELECT set_config('app.customer_token', 'token-vtl-approval-2026', true);
SELECT 'Customer sees only own record:' AS test, name FROM customers;

-- Test 5: Customer with GPS token sees only GPS
SELECT set_config('app.customer_token', 'token-gps-approval-2026', true);
SELECT 'Customer sees only GPS:' AS test, name FROM customers;

ROLLBACK;
