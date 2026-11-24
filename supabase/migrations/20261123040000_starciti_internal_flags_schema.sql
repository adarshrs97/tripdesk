-- ==============================================================================
-- Milestone 7c: Internal Notes & Flags Schema
-- Operational flags (note, caution, avoid) entity-linked to driver, vehicle,
-- hotel, vendor, and customer. Strictly admin/staff only with ZERO LEAKAGE
-- to customer documents, driver apps, or invoice PDFs.
-- ==============================================================================

-- 1. INTERNAL FLAGS TABLE
CREATE TABLE IF NOT EXISTS internal_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('driver', 'vehicle', 'hotel', 'vendor', 'customer')),
  entity_id VARCHAR(100) NOT NULL, -- UUID or code of the linked entity
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('note', 'caution', 'avoid')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT DEFAULT get_current_app_role(),
  created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast entity lookup and filtering
CREATE INDEX IF NOT EXISTS idx_internal_flags_entity 
  ON internal_flags(entity_type, entity_id, is_active);
CREATE INDEX IF NOT EXISTS idx_internal_flags_severity 
  ON internal_flags(severity, is_active);
CREATE INDEX IF NOT EXISTS idx_internal_flags_created 
  ON internal_flags(created_at DESC);

-- 2. ENABLE ROW LEVEL SECURITY (Zero-Leakage Enforcement)
ALTER TABLE internal_flags ENABLE ROW LEVEL SECURITY;

-- Select Policy: Strictly admin and staff
DROP POLICY IF EXISTS "internal_flags_admin_staff_select" ON internal_flags;
CREATE POLICY "internal_flags_admin_staff_select" ON internal_flags
  FOR SELECT TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'));

-- Insert Policy: Strictly admin and staff
DROP POLICY IF EXISTS "internal_flags_admin_staff_insert" ON internal_flags;
CREATE POLICY "internal_flags_admin_staff_insert" ON internal_flags
  FOR INSERT TO authenticated, starciti_app
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Update Policy: Strictly admin and staff
DROP POLICY IF EXISTS "internal_flags_admin_staff_update" ON internal_flags;
CREATE POLICY "internal_flags_admin_staff_update" ON internal_flags
  FOR UPDATE TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Delete Policy: Strictly admin
DROP POLICY IF EXISTS "internal_flags_admin_delete" ON internal_flags;
CREATE POLICY "internal_flags_admin_delete" ON internal_flags
  FOR DELETE TO authenticated, starciti_app
  USING (get_current_app_role() = 'admin');

-- Grants
GRANT ALL ON TABLE internal_flags TO starciti_app, authenticated;

-- 3. SEED REALISTIC OPERATIONAL FLAGS
INSERT INTO internal_flags (
  id,
  entity_type,
  entity_id,
  severity,
  title,
  description,
  is_active
) VALUES 
  (
    'f0000000-0000-0000-0000-000000000001',
    'driver',
    'd0000000-0000-0000-0000-000000000001', -- Hemanth Kumar
    'note',
    'VIP & Corporate Route Specialist',
    'Fluent in Malayalam, Tamil and English. Highly rated for corporate VIP transfers and Technopark campus schedules.',
    true
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    'vehicle',
    '10000000-0000-0000-0000-000000000001', -- KL 01 CP 3284
    'caution',
    'Rear AC Blower Airflow Reduced',
    'Rear third-row AC vents blow warm air during noon peak sun. Service scheduled with Popular Maruti; allocate 1st and 2nd row passengers for daytime trips.',
    true
  ),
  (
    'f0000000-0000-0000-0000-000000000003',
    'customer',
    'c0000000-0000-0000-0000-000000000001', -- VTL
    'caution',
    'Factory Gate Security Clearance Required',
    'Kollam factory & warehouse premises require gate pass clearance 24h in advance. Driver must carry original physical Aadhaar card and wear safety shoes.',
    true
  ),
  (
    'f0000000-0000-0000-0000-000000000004',
    'vendor',
    'v-attached-tours-001',
    'avoid',
    'GPS Discrepancy on High-Range Routes',
    'GPS tracker intermittently disconnects on Munnar/Wayanad hill routes. Do not dispatch on outstation corporate packages until GPS replacement confirmed.',
    true
  ),
  (
    'f0000000-0000-0000-0000-000000000005',
    'hotel',
    'h-apollo-dimora-001',
    'note',
    'Driver Parking B2 & Front Desk Meal Vouchers',
    'Basement B2 reserved for taxi parking. Driver complimentary meal coupon must be collected from reception before 21:30.',
    true
  )
ON CONFLICT (id) DO NOTHING;
