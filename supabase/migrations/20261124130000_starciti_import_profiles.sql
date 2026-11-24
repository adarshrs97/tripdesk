-- Migration: Import Profiles Database Table with RLS
-- Store customer Excel duty slip import column mapping profiles in PostgreSQL

CREATE TABLE IF NOT EXISTS public.import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  profile_name TEXT NOT NULL DEFAULT 'Default Profile',
  mapping JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT import_profiles_customer_unique UNIQUE(customer_id)
);

-- Enable Row Level Security
ALTER TABLE public.import_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_profiles FORCE ROW LEVEL SECURITY;

-- 1. Only admin and staff can select/read profiles
DROP POLICY IF EXISTS "rls_import_profiles_select" ON public.import_profiles;
DROP POLICY IF EXISTS "import_profiles_select" ON public.import_profiles;
CREATE POLICY "import_profiles_select" ON public.import_profiles
  FOR SELECT
  USING (
    get_current_app_role() IN ('admin', 'staff')
    OR auth.uid() IN (SELECT id FROM public.app_users WHERE role IN ('admin', 'staff'))
  );

-- 2. Admin and staff can write (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "rls_import_profiles_insert" ON public.import_profiles;
DROP POLICY IF EXISTS "rls_import_profiles_update" ON public.import_profiles;
DROP POLICY IF EXISTS "rls_import_profiles_delete" ON public.import_profiles;
DROP POLICY IF EXISTS "import_profiles_admin_staff" ON public.import_profiles;

CREATE POLICY "import_profiles_admin_staff" ON public.import_profiles
  FOR ALL
  USING (
    get_current_app_role() IN ('admin', 'staff')
    OR auth.uid() IN (SELECT id FROM public.app_users WHERE role IN ('admin', 'staff'))
  )
  WITH CHECK (
    get_current_app_role() IN ('admin', 'staff')
    OR auth.uid() IN (SELECT id FROM public.app_users WHERE role IN ('admin', 'staff'))
  );

-- Grants
GRANT ALL ON public.import_profiles TO postgres;

DO $$
BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_profiles TO authenticated, service_role, starciti_app;
  GRANT SELECT ON public.import_profiles TO anon;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
