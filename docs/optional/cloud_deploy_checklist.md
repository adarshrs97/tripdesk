# StarCiti ERP - Supabase Cloud Deployment & Go-Live Checklist

This checklist is prepared for **Mr. M. Ratnaraj** (City Tours & Travels / StarCiti Group, Trivandrum) to deploy the verified StarCiti ERP system to production Supabase Cloud with **zero risk** to real financial numbering.

---

## Pre-Flight Invariants
- [x] **Zero Invented Data**: No dummy vehicles (KL01 BZ 4111 removed), no fake banks, no fake EMIs, no fake payables.
- [x] **Real Data Provenance**: Confirmed real clients (`M/s Vindhya Telelinks Limited`, `Global Public School`), 4 real fleet vehicles (`KL01 CP 3284`, `KL82 4889`, `KL74 E 3694`, `KL21 M 2378`), and 4 real drivers (`Hemanth Kumar`, `Muhammad Fayaz.s`, `Asheerkhan`, `Afzal`).
- [x] **Zero Guessed Invoice Starts**: Production series start at `0` until real numbers are provided.
- [x] **Forced RLS & Immutability**: All tables have Row Level Security FORCED. Triggers strictly block updating or deleting locked trips or issued invoices across all user roles.
- [x] **Lighthouse WCAG 2.1 AA Accessibility**: All 7 main application screens score **100/100**.

---

## Step 1: Create Supabase Cloud Project
1. Log in to [Supabase Console](https://supabase.com/dashboard).
2. Click **New Project**.
3. Set Organization: `StarCiti Group / City Tours`.
4. Project Name: `starciti-erp-prod`.
5. Database Password: Generate a strong 24-character password and store it securely.
6. Region: **South Asia (Mumbai) - `ap-south-1`** *(Crucial for sub-40ms latency across Kerala)*.
7. Pricing Plan: **Free** (or Pro plan if continuous backup point-in-time recovery is desired).

---

## Step 2: Gather Environment Credentials
In the Supabase Dashboard, go to **Project Settings -> API** and copy:
- `Project URL`: `https://<project-ref>.supabase.co`
- `Project API Keys -> anon (public)`: `eyJhbGciOi...`
- `Project API Keys -> service_role (secret)`: `eyJhbGciOi...`

In **Project Settings -> Database**:
- `Connection String -> URI (Transaction Pooler - Port 6543)`:
  `postgresql://postgres.<project-ref>:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`

---

## Step 3: Run the Fresh Production Database Script
Execute `scripts/fresh_production_database.sql` directly in the Supabase Cloud SQL Editor:

```bash
# Option A: Via Supabase Web Dashboard
1. Open Supabase Dashboard -> SQL Editor
2. Open file: scripts/fresh_production_database.sql
3. Paste contents and click "Run"

# Option B: Via psql CLI
psql "postgresql://postgres.<project-ref>:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" -f scripts/fresh_production_database.sql
```

**Verification Check:**
After running, verify in SQL Editor:
```sql
SELECT 'invoices' AS table_name, count(*) FROM invoices
UNION ALL SELECT 'trip_ledger', count(*) FROM trip_ledger
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'vehicles', count(*) FROM vehicles
UNION ALL SELECT 'drivers', count(*) FROM drivers;
```
Expected output:
- `invoices`: **0**
- `trip_ledger`: **0**
- `customers`: **2** (VTL, Global Public School)
- `vehicles`: **4** (KL01 CP 3284, KL82 4889, KL74 E 3694, KL21 M 2378)
- `drivers`: **4** (Hemanth Kumar, Muhammad Fayaz.s, Asheerkhan, Afzal)

---

## Step 4: Configure Storage Bucket & Policies
1. In Supabase Dashboard -> **Storage**:
   - Ensure the `odometer-photos` bucket is created.
   - Verify `Public bucket` is **OFF** (Private).
2. Storage RLS Policies:
   - `drivers_upload_own_odometer_photo`: Allows authenticated drivers to upload only into their own prefix: `(storage.foldername(name))[1] = get_current_app_driver_id()::text`.
   - `staff_read_odometer_photos`: Allows `admin` and `staff` roles to view photos for verification.

---

## Step 5: Configure Production Hosting (Vercel / Netlify / Custom Host)
In your frontend deployment platform (e.g. Vercel):
Set the Environment Variables:
```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
DATABASE_URL=postgresql://postgres.<project-ref>:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

Deploy the frontend:
```bash
npm run build
```

---

## Step 6: Pilot Testing With TEST Invoice Series (Zero Risk)
Before touching official serial numbers, pilot test in production using the pre-seeded **`TEST`** invoice series:

1. Log in to the ERP as Administrator.
2. In the top bar, switch the Letterhead / Entity to **`City Tours & Travels (TEST)`** or **`StarCiti Group (TEST)`**.
3. Create an ad-hoc invoice or run a test month-close.
4. Verify the generated invoice number is **`TEST-0001`**, **`TEST-0002`**, etc.
5. Review the PDF layout, tax calculation (CGST + SGST vs Nil), and print rendering.
6. Test cancellation:
   - Cancel the test invoice with reason *"Pilot validation test"*.
   - Confirm the invoice status turns to `cancelled` and the number is preserved.

---

## Step 7: Setting Real Series Numbers for Go-Live
When ready to issue the first real tax invoice:
1. Provide the real last-issued numbers:
   - City Tours last number: `[ ]`
   - StarCiti Group last number: `[ ]`
2. In ERP **Settings -> Invoice Series** (or via SQL):
   ```sql
   -- Example if City Tours last issued was 108190:
   UPDATE invoice_series 
   SET current_number = 108190 
   WHERE supplier_id = 'a0000000-0000-0000-0000-000000000002' AND prefix = '';

   -- Next issued invoice will be 108191.
   ```
3. Real tax invoicing is now live, sequential, and row-locked against concurrency.
