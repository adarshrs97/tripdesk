-- Custom Global Roles for Starciti Local Stack
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starciti_app') THEN
    CREATE ROLE starciti_app NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
END $$;

GRANT anon, authenticated, service_role TO starciti_app;
