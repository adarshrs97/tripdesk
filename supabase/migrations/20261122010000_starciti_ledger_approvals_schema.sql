-- StarCiti Fleet & Billing Desk - Milestone 3 Ledger, Approvals & Anomaly Schema
-- Includes RLS policies for Admin, Staff, Driver (own rows only), and Customer (tokenized contract scope)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TRIP LEDGER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS trip_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    trip_date DATE NOT NULL,
    day_status VARCHAR(20) NOT NULL DEFAULT 'RUN', -- RUN, SUNDAY, HOLIDAY, NO_RUN, LEAVE, BREAKDOWN, SUBSTITUTE
    start_km INTEGER,
    close_km INTEGER,
    used_km INTEGER,
    start_time VARCHAR(10),
    close_time VARCHAR(10),
    duration_minutes INTEGER,
    ends_next_day BOOLEAN DEFAULT FALSE,
    night_bata BOOLEAN DEFAULT FALSE,
    outstation_bata BOOLEAN DEFAULT FALSE,
    toll_amount NUMERIC(10, 2) DEFAULT 0,
    permit_amount NUMERIC(10, 2) DEFAULT 0,
    parking_amount NUMERIC(10, 2) DEFAULT 0,
    other_charges NUMERIC(10, 2) DEFAULT 0,
    remarks TEXT,
    tags TEXT[] DEFAULT '{}',
    extra JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_id, trip_date, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ledger_contract_date ON trip_ledger(contract_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_trip_ledger_driver ON trip_ledger(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_ledger_vehicle ON trip_ledger(vehicle_id);

-- ============================================================================
-- 2. APPROVALS TABLE (128-bit Hashed Token, Expiry, Revocation, Rate-limiting)
-- ============================================================================
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- '2026-08'
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 of 128-bit token
    status VARCHAR(20) NOT NULL DEFAULT 'pending_approval', -- pending_approval, approved, rejected
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(100),
    coordinator_designation VARCHAR(100),
    notes TEXT,
    approved_at TIMESTAMPTZ,
    request_count INTEGER DEFAULT 0,
    last_requested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_token_hash ON approvals(token_hash);
CREATE INDEX IF NOT EXISTS idx_approvals_contract_month ON approvals(contract_id, year_month);

-- ============================================================================
-- 3. ANOMALY ACKNOWLEDGEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS anomaly_acks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anomaly_id VARCHAR(100) NOT NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    acknowledged_by VARCHAR(100) NOT NULL,
    notes TEXT,
    acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(anomaly_id, contract_id)
);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE trip_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_acks ENABLE ROW LEVEL SECURITY;

-- TRIP LEDGER POLICIES
-- Admin: Full Access
CREATE POLICY admin_trip_ledger_all ON trip_ledger
    FOR ALL
    USING (current_setting('app.current_role', true) = 'admin')
    WITH CHECK (current_setting('app.current_role', true) = 'admin');

-- Staff: Full Read/Write on Ledger (Staff cannot edit rate_cards or contract_terms)
CREATE POLICY staff_trip_ledger_all ON trip_ledger
    FOR ALL
    USING (current_setting('app.current_role', true) = 'staff')
    WITH CHECK (current_setting('app.current_role', true) = 'staff');

-- Driver: Can ONLY read and insert/update their OWN rows!
CREATE POLICY driver_trip_ledger_select ON trip_ledger
    FOR SELECT
    USING (
        current_setting('app.current_role', true) = 'driver'
        AND driver_id::text = current_setting('app.current_user_id', true)
    );

CREATE POLICY driver_trip_ledger_insert ON trip_ledger
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_role', true) = 'driver'
        AND driver_id::text = current_setting('app.current_user_id', true)
    );

CREATE POLICY driver_trip_ledger_update ON trip_ledger
    FOR UPDATE
    USING (
        current_setting('app.current_role', true) = 'driver'
        AND driver_id::text = current_setting('app.current_user_id', true)
    );

-- Customer: Read-Only access to their specific contract's trips via verified token
CREATE POLICY customer_trip_ledger_select ON trip_ledger
    FOR SELECT
    USING (
        current_setting('app.current_role', true) = 'customer_viewer'
        AND contract_id IN (
            SELECT a.contract_id FROM approvals a
            WHERE a.token_hash = current_setting('app.current_token_hash', true)
              AND a.is_revoked = FALSE
              AND a.expires_at > NOW()
        )
    );

-- APPROVALS POLICIES
-- Admin: Full Access
CREATE POLICY admin_approvals_all ON approvals
    FOR ALL
    USING (current_setting('app.current_role', true) = 'admin')
    WITH CHECK (current_setting('app.current_role', true) = 'admin');

-- Staff: Full Read & Update
CREATE POLICY staff_approvals_all ON approvals
    FOR ALL
    USING (current_setting('app.current_role', true) = 'staff')
    WITH CHECK (current_setting('app.current_role', true) = 'staff');

-- Customer Viewer: Can read and update approval sign-off only for their matching token
CREATE POLICY customer_approvals_select ON approvals
    FOR SELECT
    USING (
        current_setting('app.current_role', true) = 'customer_viewer'
        AND token_hash = current_setting('app.current_token_hash', true)
        AND is_revoked = FALSE
        AND expires_at > NOW()
    );

CREATE POLICY customer_approvals_update ON approvals
    FOR UPDATE
    USING (
        current_setting('app.current_role', true) = 'customer_viewer'
        AND token_hash = current_setting('app.current_token_hash', true)
        AND is_revoked = FALSE
        AND expires_at > NOW()
    );

-- ANOMALY ACKS POLICIES
CREATE POLICY admin_staff_anomaly_acks ON anomaly_acks
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('admin', 'staff'))
    WITH CHECK (current_setting('app.current_role', true) IN ('admin', 'staff'));

-- Grant permissions to starciti_app role
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_ledger TO starciti_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON approvals TO starciti_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON anomaly_acks TO starciti_app;
