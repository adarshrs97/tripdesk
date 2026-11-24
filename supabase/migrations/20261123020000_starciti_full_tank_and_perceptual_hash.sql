-- Migration: 20261123020000_starciti_full_tank_and_perceptual_hash.sql
-- Adds full-tank tracking, receipt number, and perceptual image hash support to fuel_expenses

ALTER TABLE fuel_expenses
  ADD COLUMN IF NOT EXISTS is_full_tank BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS perceptual_hash TEXT;

-- Index for receipt number lookup per station and date
CREATE INDEX IF NOT EXISTS idx_fuel_expenses_receipt_lookup 
  ON fuel_expenses (receipt_number, fuel_station, entry_date)
  WHERE receipt_number IS NOT NULL;

-- Index for perceptual hash lookup
CREATE INDEX IF NOT EXISTS idx_fuel_expenses_perceptual_hash 
  ON fuel_expenses (perceptual_hash)
  WHERE perceptual_hash IS NOT NULL;

-- Comments documenting business rules
COMMENT ON COLUMN fuel_expenses.is_full_tank IS 'Whether this fuel fill filled the tank to 100% capacity. Economy is strictly calculated between consecutive full fills.';
COMMENT ON COLUMN fuel_expenses.receipt_number IS 'Receipt / bill serial number issued by fuel station POS.';
COMMENT ON COLUMN fuel_expenses.perceptual_hash IS 'Perceptual visual hash (e.g. 64-bit dHash) for detecting re-photographed duplicates of the same physical bill.';
