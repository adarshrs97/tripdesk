-- ==============================================================================
-- Migration: 20261123050000_starciti_accounts_and_reports_schema.sql
-- Milestone 8: Accounts (Cash Register, Bank Accounts, Payables, EMI Schedule)
--              & Financial Reports (Vehicle P&L, Contract Margin, Receivables Ageing, Utilisation)
-- ==============================================================================

-- 1. CASH TRANSACTIONS (Cash-in-hand register)
CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('receipt', 'payment', 'deposit_to_bank', 'petty_cash')),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'driver_bata', 'fuel_settlement', 'customer_cash_payment', 'office_expense', 
    'workshop_maintenance', 'toll_parking', 'police_rto_challan', 'owner_drawing', 'other'
  )),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  reference_no TEXT,
  description TEXT NOT NULL,
  running_balance NUMERIC(12, 2),
  created_by TEXT DEFAULT get_current_app_role(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BANK ACCOUNTS & TRANSACTIONS
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  branch TEXT NOT NULL,
  account_type VARCHAR(20) NOT NULL DEFAULT 'current' CHECK (account_type IN ('current', 'savings', 'od')),
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode VARCHAR(30) NOT NULL CHECK (mode IN ('bank_transfer', 'upi', 'neft', 'rtgs', 'cheque', 'cash_deposit', 'emi_debit')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reference_no TEXT,
  description TEXT NOT NULL,
  cleared BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VENDOR PAYABLES
CREATE TABLE IF NOT EXISTS vendor_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  vendor_type VARCHAR(50) NOT NULL CHECK (vendor_type IN (
    'attached_vehicle', 'workshop_service', 'fuel_station_credit', 'spare_parts', 'rto_permit', 'other'
  )),
  bill_no TEXT,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'part_paid', 'paid')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. EMI PAYMENT SCHEDULES
CREATE TABLE IF NOT EXISTS emi_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  financier TEXT NOT NULL,
  account_no TEXT NOT NULL,
  month_year VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  paid_date DATE,
  payment_reference TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_vehicle_month_emi UNIQUE (vehicle_id, month_year)
);

-- 5. FINANCIAL & ALLOCATION SETTINGS
CREATE TABLE IF NOT EXISTS financial_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_rules JSONB NOT NULL DEFAULT '{
    "driver_pay_method": "actual_or_daily_bata",
    "emi_allocation_method": "actual_vehicle_emi",
    "cost_completeness_strict": true,
    "include_service_in_pnl": true,
    "include_fuel_in_pnl": true,
    "include_emi_in_pnl": true,
    "include_driver_pay_in_pnl": true,
    "default_working_days": 30,
    "receivables_ageing_brackets": [30, 60, 90]
  }'::jsonb,
  cost_completeness_strict BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT get_current_app_role()
);

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON cash_transactions(entry_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_vendor_payables_due ON vendor_payables(due_date);
CREATE INDEX IF NOT EXISTS idx_emi_schedules_month ON emi_schedules(vehicle_id, month_year);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE emi_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON TABLE cash_transactions TO starciti_app, authenticated;
GRANT ALL ON TABLE bank_accounts TO starciti_app, authenticated;
GRANT ALL ON TABLE bank_transactions TO starciti_app, authenticated;
GRANT ALL ON TABLE vendor_payables TO starciti_app, authenticated;
GRANT ALL ON TABLE emi_schedules TO starciti_app, authenticated;
GRANT ALL ON TABLE financial_settings TO starciti_app, authenticated;

-- Cash Transactions RLS
DROP POLICY IF EXISTS "cash_admin_staff_all" ON cash_transactions;
CREATE POLICY "cash_admin_staff_all" ON cash_transactions
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Bank Accounts RLS
DROP POLICY IF EXISTS "bank_accounts_admin_staff_all" ON bank_accounts;
CREATE POLICY "bank_accounts_admin_staff_all" ON bank_accounts
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Bank Transactions RLS
DROP POLICY IF EXISTS "bank_transactions_admin_staff_all" ON bank_transactions;
CREATE POLICY "bank_transactions_admin_staff_all" ON bank_transactions
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Vendor Payables RLS
DROP POLICY IF EXISTS "vendor_payables_admin_staff_all" ON vendor_payables;
CREATE POLICY "vendor_payables_admin_staff_all" ON vendor_payables
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- EMI Schedules RLS
DROP POLICY IF EXISTS "emi_schedules_admin_staff_all" ON emi_schedules;
CREATE POLICY "emi_schedules_admin_staff_all" ON emi_schedules
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- Financial Settings RLS
DROP POLICY IF EXISTS "financial_settings_admin_staff_all" ON financial_settings;
CREATE POLICY "financial_settings_admin_staff_all" ON financial_settings
  FOR ALL TO authenticated, starciti_app
  USING (get_current_app_role() IN ('admin', 'staff'))
  WITH CHECK (get_current_app_role() IN ('admin', 'staff'));

-- 8. SEED BASELINE FINANCIAL MASTERS & AUG 2026 SCHEDULES
-- Bank Accounts for City Tours & Travels & Starciti Group
INSERT INTO bank_accounts (
  id,
  supplier_id,
  bank_name,
  account_number,
  ifsc_code,
  branch,
  account_type,
  opening_balance,
  current_balance
) VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002', -- City Tours
    'State Bank of India',
    '30894567123',
    'SBIN0070032',
    'Killipalam, Trivandrum',
    'current',
    150000.00,
    184500.00
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001', -- Starciti
    'HDFC Bank',
    '50200012345678',
    'HDFC0000043',
    'Vazhuthacaud, Trivandrum',
    'current',
    85000.00,
    112000.00
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Default Financial Settings
INSERT INTO financial_settings (
  id,
  allocation_rules,
  cost_completeness_strict
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  '{
    "driver_pay_method": "actual_or_daily_bata",
    "emi_allocation_method": "actual_vehicle_emi",
    "cost_completeness_strict": true,
    "include_service_in_pnl": true,
    "include_fuel_in_pnl": true,
    "include_emi_in_pnl": true,
    "include_driver_pay_in_pnl": true,
    "default_working_days": 30,
    "receivables_ageing_brackets": [30, 60, 90]
  }'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial EMI Schedules for Aug 2026 for financed fleet vehicles
INSERT INTO emi_schedules (
  id,
  vehicle_id,
  financier,
  account_no,
  month_year,
  due_date,
  amount,
  paid_date,
  payment_reference,
  status
) VALUES
  (
    'e0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', -- KL 01 CP 3284 (Ertiga)
    'HDFC Bank Auto Loan',
    'HDFC-AUTO-94812',
    '2026-08',
    '2026-08-10',
    14250.00,
    '2026-08-09',
    'ACH-DR-881920',
    'paid'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002', -- KL 01 BZ 4111 (Innova Crysta)
    'Kotak Mahindra Prime',
    'KOTAK-CF-11029',
    '2026-08',
    '2026-08-15',
    21500.00,
    '2026-08-14',
    'ACH-DR-882031',
    'paid'
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001', -- KL 01 CP 3284 Sep 2026
    'HDFC Bank Auto Loan',
    'HDFC-AUTO-94812',
    '2026-09',
    '2026-09-10',
    14250.00,
    NULL,
    NULL,
    'pending'
  )
ON CONFLICT (vehicle_id, month_year) DO NOTHING;

-- Seed Sample Aug 2026 Vendor Payables (Workshop Service & Fuel Credit)
INSERT INTO vendor_payables (
  id,
  vendor_name,
  vendor_type,
  bill_no,
  bill_date,
  due_date,
  amount,
  amount_paid,
  status,
  vehicle_id,
  notes
) VALUES
  (
    '7a000000-0000-0000-0000-000000000001',
    'Popular Maruti Service Centre, Kaimanam',
    'workshop_service',
    'POP-INV-84192',
    '2026-08-18',
    '2026-09-05',
    4650.00,
    4650.00,
    'paid',
    '10000000-0000-0000-0000-000000000001', -- KL 01 CP 3284
    'Periodic 140,000 km oil service, synthetic engine oil, oil filter and brake cleaning'
  ),
  (
    '7a000000-0000-0000-0000-000000000002',
    'BPCL City Fuel Station, Killipalam',
    'fuel_station_credit',
    'BPCL-STMT-2026-08',
    '2026-08-31',
    '2026-09-10',
    38400.00,
    20000.00,
    'part_paid',
    NULL,
    'Monthly fleet diesel credit billing for August 2026'
  )
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Aug 2026 Cash Transactions
INSERT INTO cash_transactions (
  id,
  entry_date,
  transaction_type,
  category,
  amount,
  driver_id,
  vehicle_id,
  description,
  running_balance
) VALUES
  (
    'c1000000-0000-0000-0000-000000000001',
    '2026-08-01',
    'payment',
    'driver_bata',
    1000.00,
    'd0000000-0000-0000-0000-000000000001', -- Hemanth
    '10000000-0000-0000-0000-000000000001',
    'Driver trip allowance advance for VTL early morning dispatch',
    24000.00
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    '2026-08-15',
    'payment',
    'office_expense',
    450.00,
    NULL,
    NULL,
    'Office tea and stationery expenses',
    23550.00
  )
ON CONFLICT (id) DO NOTHING;
