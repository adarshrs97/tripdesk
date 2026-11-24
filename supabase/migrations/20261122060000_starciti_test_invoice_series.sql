-- Dedicated Isolated TEST Series for Pilot Testing (M6.5)
-- Guarantees test and dry-run invoices NEVER collide or interfere with real sequence counters.

INSERT INTO invoice_series (id, supplier_id, prefix, financial_year, current_number)
VALUES (
  '6a22b931-5174-4c3f-9206-c82660f3b999',
  'a0000000-0000-0000-0000-000000000002', -- City Tours & Travels
  'TEST-',
  '2026-2027',
  1000
)
ON CONFLICT (supplier_id, prefix, financial_year) 
DO UPDATE SET current_number = EXCLUDED.current_number;
