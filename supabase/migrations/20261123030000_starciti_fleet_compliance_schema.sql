-- Migration: 20261123030000_starciti_fleet_compliance_schema.sql
-- Milestone 7b: Fleet Compliance, Document Expiries, EMI & Service Due

-- 1. Extend vehicles table with routine service tracking and EMI metadata
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS last_service_odometer INT,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS service_interval_km INT NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS next_service_due_km INT,
  ADD COLUMN IF NOT EXISTS next_service_due_date DATE,
  ADD COLUMN IF NOT EXISTS emi_financier TEXT,
  ADD COLUMN IF NOT EXISTS emi_account_no TEXT;

-- 2. Compliance Settings Table (Configurable as Data)
CREATE TABLE IF NOT EXISTS compliance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_windows_days INT[] NOT NULL DEFAULT '{60, 30, 7}',
  service_km_warning_threshold INT NOT NULL DEFAULT 500,
  service_days_warning_threshold INT NOT NULL DEFAULT 14,
  emi_days_warning_threshold INT NOT NULL DEFAULT 5,
  police_clearance_validity_months INT NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default compliance settings if empty
INSERT INTO compliance_settings (
  id,
  alert_windows_days,
  service_km_warning_threshold,
  service_days_warning_threshold,
  emi_days_warning_threshold,
  police_clearance_validity_months
) VALUES (
  'e0000000-0000-0000-0000-000000000001',
  '{60, 30, 7}',
  500,
  14,
  5,
  12
) ON CONFLICT (id) DO NOTHING;

-- 3. Vehicle Service Logs (Maintenance History)
CREATE TABLE IF NOT EXISTS vehicle_service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  odometer_reading INT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('periodic', 'oil_change', 'brake_pad', 'tyres', 'accidental', 'general')),
  workshop_name TEXT NOT NULL,
  bill_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bill_photo_url TEXT,
  notes TEXT,
  created_by TEXT DEFAULT get_current_app_role(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE compliance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_service_logs ENABLE ROW LEVEL SECURITY;

-- Policies for compliance_settings
DROP POLICY IF EXISTS "compliance_settings_read_all" ON compliance_settings;
CREATE POLICY "compliance_settings_read_all" ON compliance_settings
  FOR SELECT TO authenticated, starciti_app
  USING (TRUE);

DROP POLICY IF EXISTS "compliance_settings_admin_update" ON compliance_settings;
CREATE POLICY "compliance_settings_admin_update" ON compliance_settings
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() = 'admin')
  WITH CHECK (get_current_app_role() = 'admin');

-- Policies for vehicle_service_logs
DROP POLICY IF EXISTS "service_logs_read" ON vehicle_service_logs;
CREATE POLICY "service_logs_read" ON vehicle_service_logs
  FOR SELECT TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "service_logs_write" ON vehicle_service_logs;
CREATE POLICY "service_logs_write" ON vehicle_service_logs
  FOR INSERT TO authenticated, starciti_app
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "service_logs_update" ON vehicle_service_logs;
CREATE POLICY "service_logs_update" ON vehicle_service_logs
  FOR UPDATE TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Grants
GRANT ALL ON TABLE compliance_settings TO starciti_app, authenticated;
GRANT ALL ON TABLE vehicle_service_logs TO starciti_app, authenticated;
