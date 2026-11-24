# StarCiti Fleet Management System
## The First 30 Minutes: Administrator Quick-Start Guide
*ലളിതമായ തുടക്ക വഴികാട്ടി (Simple Getting-Started Guide)*

Welcome to StarCiti Fleet Management. This guide walks you through setting up and running your first complete billing cycle from scratch in under 30 minutes.

---

### Step 1: Run the First-Run Setup Wizard (ആദ്യ സജ്ജീകരണം)
1. Launch the web portal at your local server or Cloudflare domain (`https://fleet.yourdomain.com`).
2. On first launch, the **First-Run Setup Wizard** opens automatically.
3. Configure your initial credentials:
   - **Admin Email & Password**: Create your secure credentials (managed directly by Supabase Auth).
   - **Primary Entity**: Enter your primary registered business name (e.g., `M/S City Tours & Travels` or `StarCiti Group`).
   - **Bank Account**: Enter your initial operational bank account or cash ledger (e.g., Canara Bank / Federal Bank).
4. Click **Complete Setup**. The system initializes the core schema, seeds your baseline invoice templates, and prompts you to log in with your new admin credentials.

---

### Step 2: Set Up Operating Entities (സ്ഥാപനങ്ങൾ)
*Path: Settings → Operating Entities (ക്രമീകരണങ്ങൾ → ബിസിനസ്സ് യൂണിറ്റുകൾ)*
1. StarCiti supports multi-entity operations under one single database.
2. Review or add your business units:
   - **Format 1 Entity**: `StarCiti Group` (used for Institutional & School contracts).
   - **Format 2 Entity**: `M/S City Tours & Travels` (used for Corporate & Telecom contracts like Vindhya Telelinks Ltd).
3. Set default tax profiles (e.g., *No tax* or *GST 5% - confirm with your CA*), address, PAN, and GSTIN.

---

### Step 3: Register Fleet Vehicles & Drivers (വാഹനങ്ങളും ഡ്രൈവർമാരും)
*Path: Fleet → Vehicles / Drivers (വാഹനങ്ങൾ / ഡ്രൈവർമാർ)*
1. **Add Vehicles**:
   - Click **+ Add Vehicle**.
   - Enter Registration Number (e.g., `KL 01 CP 3284`, `KL 82 4889`, `KL 74 E 3694`, `KL 21 M 2378`).
   - Select Fuel Type: Petrol, Diesel, CNG, or Electric.
   - Set the vehicle's default service interval and expected efficiency units (km/L, km/kg, or km/kWh).
2. **Add Drivers**:
   - Click **+ Add Driver**.
   - Enter Name (e.g., *Hemanth*, *Muhammad Fayaz*, *Asheerkhan*, *Afzal*), Phone, and License Details.
   - Generate their secure driver mobile portal link (`#driver`).

---

### Step 4: Register Customer & Versioned Contract (ഉപഭോക്താവും കരാറും)
*Path: Master Data → Customers & Contracts (ഉപഭോക്താക്കൾ & കരാറുകൾ)*
1. **Add Customer**:
   - Click **+ Add Customer**.
   - Example: *M/s Vindhya Telelinks Ltd* or *Global Public School*.
   - Fill in billing address, GSTIN, PAN, and credit payment terms (e.g., 30 days).
2. **Add Contract**:
   - Click **+ New Contract** under the customer.
   - Enter Agreement No, Effective Start Date, and select Supplier Entity (`M/S City Tours & Travels`).
   - Select Billing Model:
     - **Starter: Monthly contract** (for fixed monthly allowances + extra km/hr rates).
     - **Starter: Per-trip package** (for flat package or slab rates).
   - Configure versioned terms:
     - Base Rate (₹) & Included Km / Hours.
     - Extra Km Rate & Extra Hour Rate.
     - Driver Bata (Night / Outstation).
     - Rounding Mode (Nearest ₹1, Decimal, etc.).
     - Tax Profile.
   - *Note*: Any future price renegotiation creates a new version with an `effective_from` date without altering past issued bills.

---

### Step 5: Import Excel Trips or Mobile Driver Logging (ട്രിപ്പ് ഡാറ്റ രേഖപ്പെടുത്തൽ)
*Path: Ledger → Import Trips (ലെഡ്ജർ → എക്സൽ ഇമ്പോർട്ട്)*
1. Click **Import Trips** and select your customer/contract.
2. Upload your monthly duty slip or vendor log sheet (`.xlsx` or `.csv`).
3. **Column Mapping**:
   - The Smart Auto-Detect engine automatically matches Excel headers (Date, Vehicle, Opening Km, Closing Km, Starting Time, Ending Time, Toll, etc.).
   - Adjust any custom column headers and click **Save as Import Profile** so future monthly uploads require zero re-mapping.
4. **Pre-Commit Validation**:
   - The validation engine checks for:
     - Bad time formats (e.g., invalid `HH.MM`).
     - Odometer backward steps or gaps.
     - Duplicate trip slips.
5. Click **Commit Trips to Ledger**.

---

### Step 6: Close Month & Issue Invoices with Annexures (ബില്ലിംഗും ക്ലോസിംഗും)
*Path: Billing → Invoices → Generate Invoice (ബില്ലിംഗ് → ഇൻവോയ്സ്)*
1. Select the Customer, Contract, and Billing Month (e.g., August 2026).
2. The billing engine aggregates all validated trips, computes base package, extra hours, extra km, driver bata, tolls, and tax.
3. Review the preview:
   - **Invoice Page**: Clean, professional tax invoice matching your exact corporate format.
   - **Trip Logbook Annexure**: Complete day-by-day itemized trip summary attached automatically.
4. Click **Issue & Lock Month**:
   - The ledger trips are permanently locked against accidental edits or tampering.
   - Download the official PDF or share the one-click customer approval link via WhatsApp.

---

### Malayalam Language Toggle (മലയാളം ഭാഷാ മാറ്റം)
In every view (Contracts, Customers, Ledger, Import, Driver PWA), click the **EN / മലയാളം** toggle button at the top header to switch labels instantly.
