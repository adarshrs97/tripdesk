-- ==============================================================================
-- Milestone 7b Follow-up: Fuel Types, Units, and Per-Vehicle Calibration
-- Support for petrol, diesel, CNG, electric, and other fuel types with respective
-- efficiency units (km/L, km/kg, km/kWh, km/unit), and per-vehicle service intervals.
-- ==============================================================================

-- 1. Ensure fuel_type on vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'fuel_type'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN fuel_type TEXT NOT NULL DEFAULT 'diesel' 
      CHECK (fuel_type IN ('petrol', 'diesel', 'cng', 'electric', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'min_efficiency'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN min_efficiency NUMERIC(5, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'max_efficiency'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN max_efficiency NUMERIC(5, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'service_interval_km'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN service_interval_km INT NOT NULL DEFAULT 10000;
  END IF;
END $$;

-- 2. Extend vehicle_fuel_settings with unit and note
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_fuel_settings' AND column_name = 'unit'
  ) THEN
    ALTER TABLE vehicle_fuel_settings ADD COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'km/L';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_fuel_settings' AND column_name = 'is_default_assumption'
  ) THEN
    ALTER TABLE vehicle_fuel_settings ADD COLUMN is_default_assumption BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicle_fuel_settings' AND column_name = 'note'
  ) THEN
    ALTER TABLE vehicle_fuel_settings ADD COLUMN note TEXT DEFAULT 'default assumption (editable)';
  END IF;
END $$;

-- 3. Seed / Update fuel settings for various fuel types and vehicle categories
INSERT INTO vehicle_fuel_settings (vehicle_type, min_kml, max_kml, target_kml, fuel_type, unit, receipt_photo_mandatory, is_default_assumption, note)
VALUES 
  ('sedan', 16.00, 22.00, 18.50, 'diesel', 'km/L', true, true, 'default assumption (editable)'),
  ('suv', 12.00, 17.50, 14.50, 'diesel', 'km/L', true, true, 'default assumption (editable)'),
  ('hatchback', 17.00, 24.00, 20.00, 'petrol', 'km/L', true, true, 'default assumption (editable)'),
  ('minibus', 9.00, 14.00, 11.50, 'diesel', 'km/L', true, true, 'default assumption (editable)')
ON CONFLICT (vehicle_type) DO UPDATE SET
  fuel_type = EXCLUDED.fuel_type,
  unit = EXCLUDED.unit,
  is_default_assumption = EXCLUDED.is_default_assumption,
  note = EXCLUDED.note;
