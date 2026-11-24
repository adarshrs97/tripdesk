BEGIN;
SET ROLE starciti_app;

-- 1. Staff attempts to insert a new rate card -> denied by RLS!
SELECT set_config('app.current_role', 'staff', true);
INSERT INTO rate_cards (id, vehicle_type, base_amount, included_hours, included_km, extra_hour_rate, extra_km_rate)
VALUES ('30000000-0000-0000-0000-000000000001', 'innova', 3500, 10, 80, 250, 20);

SELECT 'Staff insert rate card failed (count should be 0):' AS test, COUNT(*) FROM rate_cards WHERE vehicle_type = 'innova';

-- 2. Admin inserts a rate card -> allowed!
SELECT set_config('app.current_role', 'admin', true);
INSERT INTO rate_cards (id, vehicle_type, base_amount, included_hours, included_km, extra_hour_rate, extra_km_rate)
VALUES ('30000000-0000-0000-0000-000000000001', 'innova', 3500, 10, 80, 250, 20);

SELECT 'Admin insert rate card succeeded (count should be 1):' AS test, COUNT(*) FROM rate_cards WHERE vehicle_type = 'innova';

ROLLBACK;
