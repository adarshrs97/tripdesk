-- ==============================================================================
-- Settings RLS, Database-Backed Vocabulary, Quote Tariffs & Setup State Lock
-- ==============================================================================

-- 1. Enable RLS on settings table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies
DROP POLICY IF EXISTS rls_select_settings ON public.settings;
CREATE POLICY rls_select_settings ON public.settings
  FOR SELECT
  USING (TRUE); -- Shared settings readable by all roles (staff, driver, customer, admin)

DROP POLICY IF EXISTS rls_modify_settings ON public.settings;
CREATE POLICY rls_modify_settings ON public.settings
  FOR ALL
  USING (
    get_current_app_role() = 'admin' 
    OR current_user = 'postgres'
  )
  WITH CHECK (
    get_current_app_role() = 'admin' 
    OR current_user = 'postgres'
  );

-- 3. Seed Shared English/Malayalam Vocabulary in Database (if not present)
INSERT INTO public.settings (key, scope, value, description)
VALUES (
  'system.vocabulary',
  'system',
  '[
    {"key": "trip", "english": "Trip / Duty", "malayalam": "യാത്ര"},
    {"key": "vehicle", "english": "Vehicle", "malayalam": "വാഹനം"},
    {"key": "driver", "english": "Driver", "malayalam": "ഡ്രൈവർ"},
    {"key": "customer", "english": "Customer / Client", "malayalam": "കസ്റ്റമർ"},
    {"key": "invoice", "english": "Invoice / Bill", "malayalam": "ഇൻവോയ്സ്"},
    {"key": "fuel", "english": "Fuel / Diesel", "malayalam": "ഇന്ധനം / ഡീസൽ"},
    {"key": "advance", "english": "Advance Payment", "malayalam": "അഡ്വാൻസ്"},
    {"key": "bata", "english": "Driver Bata", "malayalam": "ഡ്രൈവർ ബത്ത"},
    {"key": "opening_km", "english": "Opening KM", "malayalam": "ആരംഭ കി.മീ"},
    {"key": "closing_km", "english": "Closing KM", "malayalam": "അവസാന കി.മീ"},
    {"key": "hours", "english": "Total Hours", "malayalam": "മണിക്കൂർ"},
    {"key": "toll_parking", "english": "Toll & Parking", "malayalam": "ടോൾ / പാർക്കിംഗ്"}
  ]'::jsonb,
  'Shared English and Malayalam operational labels stored in database with RLS'
)
ON CONFLICT (key) DO NOTHING;

-- 4. Seed Empty Quote Tariffs (No Seeded Rates - Starts Clean & Editable in Settings)
INSERT INTO public.settings (key, scope, value, description)
VALUES (
  'system.quote_tariffs',
  'operations',
  '{}'::jsonb,
  'Configured quote tariff rates per vehicle category and tariff model'
)
ON CONFLICT (key) DO NOTHING;

-- 5. Seed Setup State Lock (Tracks whether first-run wizard has completed)
INSERT INTO public.settings (key, scope, value, description)
VALUES (
  'system.setup_state',
  'system',
  '{"completed": false, "completed_at": null, "admin_email": null}'::jsonb,
  'Permanent lock state for the first-run setup wizard'
)
ON CONFLICT (key) DO NOTHING;
