-- ==============================================================================
-- Milestone 7a: Driver Expenses & Fuel Checks Schema
-- Fuel logs, receipt photos, km/L outlier detection, rollback flags,
-- duplicate receipt protection, review queue, and held-from-settlement states.
-- ==============================================================================

-- Ensure authenticated role exists for local standalone Postgres
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starciti_app') THEN
    CREATE ROLE starciti_app LOGIN;
  END IF;
END $$;

-- 1. VEHICLE FUEL EFFICIENCY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS vehicle_fuel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type VARCHAR(50) UNIQUE NOT NULL, -- 'sedan', 'suv', 'hatchback', 'minibus'
  min_kml NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
  max_kml NUMERIC(5, 2) NOT NULL DEFAULT 22.00,
  target_kml NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
  fuel_type VARCHAR(20) NOT NULL DEFAULT 'diesel',
  receipt_photo_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  duplicate_window_days INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial fuel threshold settings for Starciti fleet
INSERT INTO vehicle_fuel_settings (vehicle_type, min_kml, max_kml, target_kml, fuel_type, receipt_photo_mandatory)
VALUES 
  ('sedan', 16.00, 22.00, 18.50, 'diesel', true),
  ('suv', 12.00, 17.50, 14.50, 'diesel', true),
  ('hatchback', 17.00, 24.00, 20.00, 'petrol', true),
  ('minibus', 9.00, 14.00, 11.50, 'diesel', true)
ON CONFLICT (vehicle_type) DO UPDATE SET
  min_kml = EXCLUDED.min_kml,
  max_kml = EXCLUDED.max_kml,
  target_kml = EXCLUDED.target_kml;

-- 2. FUEL EXPENSES TABLE
CREATE TABLE IF NOT EXISTS fuel_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE RESTRICT,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE RESTRICT,
  entry_date DATE NOT NULL,
  odometer_reading NUMERIC(10, 1) NOT NULL,
  previous_odometer NUMERIC(10, 1),
  fuel_litres NUMERIC(8, 2) NOT NULL CHECK (fuel_litres > 0),
  rate_per_litre NUMERIC(8, 2) NOT NULL CHECK (rate_per_litre > 0),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount > 0),
  fuel_station TEXT,
  receipt_photo_url TEXT,
  receipt_hash TEXT,
  km_per_litre NUMERIC(6, 2),
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'held_from_settlement', 'rejected')),
  held_reason TEXT,
  anomalies JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. OTHER DRIVER EXPENSES TABLE (Tolls, Parking, Cleaning, Repairs)
CREATE TABLE IF NOT EXISTS driver_other_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE RESTRICT,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE RESTRICT,
  trip_id UUID REFERENCES trip_ledger(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('toll', 'parking', 'cleaning', 'repairs', 'permit', 'other')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  receipt_photo_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'held_from_settlement', 'rejected')),
  held_reason TEXT,
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance & audit lookups
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_date ON fuel_expenses(vehicle_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_driver_date ON fuel_expenses(driver_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_status ON fuel_expenses(status);
CREATE INDEX IF NOT EXISTS idx_fuel_receipt_hash ON fuel_expenses(receipt_hash);

-- 4. RLS POLICIES FOR FUEL EXPENSES
ALTER TABLE vehicle_fuel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_other_expenses ENABLE ROW LEVEL SECURITY;

-- Vehicle Fuel Settings: Everyone can read; only Admin can edit
DROP POLICY IF EXISTS "fuel_settings_select_all" ON vehicle_fuel_settings;
CREATE POLICY "fuel_settings_select_all" ON vehicle_fuel_settings
  FOR SELECT TO authenticated, starciti_app USING (true);

DROP POLICY IF EXISTS "fuel_settings_admin_write" ON vehicle_fuel_settings;
CREATE POLICY "fuel_settings_admin_write" ON vehicle_fuel_settings
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

-- Fuel Expenses:
-- Driver: Can view and insert their own records only. Cannot edit status/reviewed fields.
DROP POLICY IF EXISTS "fuel_expenses_driver_select" ON fuel_expenses;
CREATE POLICY "fuel_expenses_driver_select" ON fuel_expenses
  FOR SELECT TO authenticated, starciti_app
  USING (
    get_current_app_role() IN ('admin', 'staff') OR
    (get_current_app_role() = 'driver' AND driver_id = get_current_app_driver_id())
  );

DROP POLICY IF EXISTS "fuel_expenses_driver_insert" ON fuel_expenses;
CREATE POLICY "fuel_expenses_driver_insert" ON fuel_expenses
  FOR INSERT TO authenticated, starciti_app
  WITH CHECK (
    get_current_app_role() IN ('admin', 'staff') OR
    (get_current_app_role() = 'driver' AND driver_id = get_current_app_driver_id())
  );

-- Staff and Admin: Can update status, held_reason, reviewed_by
DROP POLICY IF EXISTS "fuel_expenses_staff_admin_update" ON fuel_expenses;
CREATE POLICY "fuel_expenses_staff_admin_update" ON fuel_expenses
  FOR UPDATE TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Other Expenses:
DROP POLICY IF EXISTS "other_expenses_driver_select" ON driver_other_expenses;
CREATE POLICY "other_expenses_driver_select" ON driver_other_expenses
  FOR SELECT TO authenticated, starciti_app
  USING (
    get_current_app_role() IN ('admin', 'staff') OR
    (get_current_app_role() = 'driver' AND driver_id = get_current_app_driver_id())
  );

DROP POLICY IF EXISTS "other_expenses_driver_insert" ON driver_other_expenses;
CREATE POLICY "other_expenses_driver_insert" ON driver_other_expenses
  FOR INSERT TO authenticated, starciti_app
  WITH CHECK (
    get_current_app_role() IN ('admin', 'staff') OR
    (get_current_app_role() = 'driver' AND driver_id = get_current_app_driver_id())
  );

DROP POLICY IF EXISTS "other_expenses_staff_admin_update" ON driver_other_expenses;
CREATE POLICY "other_expenses_staff_admin_update" ON driver_other_expenses
  FOR UPDATE TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Grants
GRANT ALL ON TABLE vehicle_fuel_settings TO starciti_app, authenticated;
GRANT ALL ON TABLE fuel_expenses TO starciti_app, authenticated;
GRANT ALL ON TABLE driver_other_expenses TO starciti_app, authenticated;
