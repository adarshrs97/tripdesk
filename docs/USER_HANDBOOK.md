# 📘 Starciti Fleet Desk — User Handbook & Operations Guide

Welcome to **Starciti Fleet Desk**, a unified fleet operations, daily trip logging, and contract billing management system built specifically for passenger transport operators, corporate vehicle rentals, and institutional bus fleets.

This handbook is designed as a companion guide for your hands-on demo. It explains **how the system works**, the **day-to-day workflow**, what each role does, and answers **frequently asked questions (FAQs)** in simple, non-technical language.

---

## 📑 Table of Contents
1. [System Overview & Key Concepts](#1-system-overview--key-concepts)
2. [User Roles & Demo Login Credentials](#2-user-roles--demo-login-credentials)
3. [The End-to-End Operational Flow](#3-the-end-to-end-operational-flow)
   - [Step 1: Masters & Contract Setup](#step-1-masters--contract-setup)
   - [Step 2: Daily Trip Logging (Office & Driver)](#step-2-daily-trip-logging-office--driver)
   - [Step 3: Fuel Logging & Expense Tracking](#step-3-fuel-logging--expense-tracking)
   - [Step 4: Customer Logbook Review & Digital Approval](#step-4-customer-logbook-review--digital-approval)
   - [Step 5: Month-End Close & Locked Invoicing](#step-5-month-end-close--locked-invoicing)
   - [Step 6: Accounts, Receivables & Profitability Reports](#step-6-accounts-receivables--profitability-reports)
4. [Role-by-Role Quick Guides](#4-role-by-role-quick-guides)
   - [👨‍💼 Operations Staff Guide](#operations-staff-guide)
   - [🚗 Driver Mobile PWA Guide (English & Malayalam)](#driver-mobile-pwa-guide)
   - [🏢 Customer Coordinator Portal Guide](#customer-coordinator-portal-guide)
   - [👑 Business Owner / Admin Guide](#business-owner--admin-guide)
5. [Special Features Explained Simply](#5-special-features-explained-simply)
   - [Template-Driven Billing (No Fixed Formats)](#template-driven-billing)
   - [Excel Column Mapper & Saved Customer Profiles](#excel-column-mapper)
   - [Trip Locking & Invoice Immutability (Audit Protection)](#trip-locking--invoice-immutability)
   - [Offline Queue for Drivers on Low-Network Routes](#offline-queue-for-drivers)
   - [Internal Caution Notes vs Customer Documents](#internal-caution-notes)
6. [Frequently Asked Questions (FAQs)](#6-frequently-asked-questions-faqs)
7. [Quick Reference & Keyboard Shortcuts](#7-quick-reference--keyboard-shortcuts)

---

## 1. System Overview & Key Concepts

Starciti Fleet Desk replaces manual paper logbooks, fragmented WhatsApp messages, and error-prone monthly spreadsheets with a **single source of truth**:

- **🚗 Driver / Office**: Logs daily opening/closing odometers and duty hours.
- **📊 Office Ledger Grid**: Reconciles daily run km, duty hours, and flags gaps in odometer continuity.
- **📋 Customer Coordinator**: Verifies and approves vehicle logbooks via a secure one-click link.
- **🔒 Month Close**: Locks all trips for the month, calculates billing formulas, and issues the invoice.
- **📄 Professional PDF**: Produces gap-free numbered tax invoices and daily logbook annexures.
- **💰 Accounts & Reports**: Tracks customer payment receipts, TDS certificates, and per-vehicle profit & loss.

### The Three Golden Principles
1. **Zero Data Tampering (Immutability)**: Once a month's bill is issued, the trips linked to that bill are permanently **locked**. Nobody—not even the business owner—can secretly edit numbers, alter KM, or delete records. This guarantees 100% legal audit integrity.
2. **Template-Driven, Not Hardcoded**: Layouts, extra km charges, night bata, taxes, and logbook formats are stored in editable templates. You can add new corporate clients or custom packages without changing any software code.
3. **No Fake Data / Clean Baseline**: The system starts clean with real operating entities, confirmed customer contracts, and real vehicle registration numbers.

---

## 2. User Roles & Demo Login Credentials

The system provides 4 distinct role-based experiences. For your live demo, use these pre-configured accounts:

| Role | Demo Email | Demo Password | Primary Purpose |
|---|---|---|---|
| **👑 Admin (Owner)** | `ratnaraaj@yahoo.com` | `Starciti2026!Admin` | Full operational control, tariff pricing, series administration, bank accounts, and financial profit & loss reports. |
| **👨‍💼 Staff (Operations)** | `operations@starciti.com` | `Starciti2026!Staff` | Daily dispatch, trip logging, Excel logbook import, driver expense review, customer approvals, and month-close invoicing. |
| **🚗 Driver (Mobile PWA)** | `hemanth@starciti.com` | `Starciti2026!Driver` | Mobile phone view: start/close daily duty, log opening/closing odometer, record fuel, works in English and Malayalam, functions offline. |
| **🏢 Customer (Coordinator)** | `admin@vindhyatelelinks.com` | `Starciti2026!Client` | Read-only corporate client view: inspect monthly vehicle logbooks, review running totals, and approve/reject monthly bills. |

---

## 3. The End-to-End Operational Flow

### Step 1: Masters & Contract Setup
*Located under: **Customers & Contracts** (`#customers`) and **Fleet & Drivers** (`#fleet`)*

Before logging trips, the system holds your operational foundation:
1. **Operating Billing Entities**:
   - `StarCiti Group`: Used for institutional bus fleets and per-trip package contracts (e.g., Global Public School).
   - `M/S City Tours & Travels`: Used for monthly dedicated corporate contracts (e.g., M/s Vindhya Telelinks Ltd).
   - Switch active letterheads anytime from the top-right header dropdown.
2. **Vehicles & Drivers**:
   - Vehicles store fuel types, expected mileage (min/max efficiency), and permit/fitness expiry dates.
   - Drivers store license numbers, daily bata rates, and phone numbers.
3. **Customer Contracts & Versioned Terms**:
   - Each customer has one or more contracts.
   - Contracts specify the **Billing Model**:
     - *Monthly Fixed Pro-Rata* (e.g., ₹45,000/month for 2,000 km & 250 hours).
     - *Per-Trip Package* (e.g., fixed rate per daily school bus trip).
     - *Ad-Hoc / Custom Slab* (per-km + hourly extra charges + night bata).
   - **Effective Dates**: If rates change from September 1st, old invoices stay pinned to August rates; new trips automatically bill at the new rate.

---

### Step 2: Daily Trip Logging (Office & Driver)
*Located under: **Daily Trip Ledger** (`#ledger`) and **Driver Mobile View** (`#driver`)*

Trips enter the ledger in three convenient ways:
1. **Direct Entry by Office Staff**:
   - Click the green **"+ Log Trip"** button in the header or double-click any cell in the ledger calendar grid.
   - Enter Vehicle, Driver, Opening KM, Closing KM, Start Time, and End Time.
   - The engine automatically calculates run km, elapsed duty hours, and flags any KM gaps.
2. **Mobile Logging by Drivers**:
   - Drivers open the app on their smartphone (`#driver`).
   - Touch-friendly large buttons allow opening duty in the morning (opening KM + odometer photo) and closing duty at night.
   - Features a one-tap language toggle between **English** and **മലയാളം** (Malayalam).
3. **Monthly Client Excel Importer**:
   - If a client gives you an Excel sheet at month-end, click **"Import Excel"**.
   - Map their columns once using the **Saved Customer Profile** (e.g., "VTL Monthly Format").
   - Preview calculations and detect bad time entries before saving.

---

### Step 3: Fuel Logging & Expense Tracking
*Located under: **Driver Expenses & Fuel** (`#expenses`)*

1. Drivers or staff log fuel fills: Date, Vehicle, Litres, Fuel Rate, Total Cost, and Odometer reading.
2. **Outlier Detection**: If a vehicle's expected mileage is 10–14 km/L and the logged fuel calculation shows 6 km/L or 28 km/L, the system flags an **Efficiency Warning** for management review.
3. **Full-Tank Method**: Ensures mileage is calculated accurately between full-tank fill-ups.

---

### Step 4: Customer Logbook Review & Digital Approval
*Located under: **Customer Approvals** (`#approvals`)*

1. Before generating the final bill, office staff share a digital logbook summary with the customer coordinator.
2. The customer receives a **Tokenized Approval Link** via WhatsApp or Email.
   - The customer does **not** need a password or software account.
   - The secure link opens their specific vehicle's daily entries for that month.
3. The coordinator inspects the dates, running km, extra hours, and clicks **"Approve Monthly Logbook"** or requests an adjustment with a note.
4. Approvals are logged with timestamps and IP addresses for audit compliance.

---

### Step 5: Month-End Close & Locked Invoicing
*Located under: **Invoices & Billing** (`#invoices`)*

1. Click the **"Month Close"** button in the header.
2. Select the Customer, Contract, and Month (e.g., August 2026).
3. **Pre-Close Health Check**: The engine checks:
   - Are all 31 days accounted for?
   - Are there any unapproved days or KM overlaps?
   - Is contract renewal up to date?
4. **Billing Formula Engine**:
   - Automatically computes base package + pro-rata days + extra km charges + extra hour charges + driver bata.
   - Correctly handles time mathematics (e.g., 9h 45m = 9.75 billable hours, with optional legacy spreadsheet decimal toggle).
5. **Issue & Lock**:
   - Generates the next sequential, gap-free invoice number (e.g., `TEST-CTT-0001` or `CTT/26-27/0089`).
   - The invoice and all 31 underlying trips are **locked permanently**.
   - Download the **Official PDF Invoice** and the matching **Daily Logbook Annexure** in one click.

---

### Step 6: Accounts, Receivables & Profitability Reports
*Located under: **Accounts & EMI** (`#accounts`) and **Financial Reports** (`#reports`)*

1. **Receivables & TDS Tracking**:
   - Record customer payment receipts (NEFT/Cheque/Cash).
   - Track TDS deducted under Section 194C (1% or 2%) with certificate reference numbers.
   - View receivables ageing (Current, 30–60 days, 60–90 days, 90+ days overdue).
2. **Vehicle Profit & Loss (P&L)**:
   - For every vehicle, the system aggregates:
     `Revenue - Fuel Costs - Driver Bata - Maintenance - Allocated Vehicle EMI = Net Profit`
   - **Zero-Fill Protection**: If fuel logs or driver payments are unrecorded, the report displays an alert badge: *"Incomplete Cost Data — Profit Not Zero-Filled"*, ensuring you never make decisions based on false profit numbers.
3. **Fleet Utilisation**:
   - Displays Run Days vs Idle Days and Average Daily KM across the entire fleet.

---

## 4. Role-by-Role Quick Guides

### 👨‍💼 Operations Staff Guide
- **Morning Duty**:
  1. Open `#ledger`. Check vehicle-driver allocations for the day.
  2. Verify that yesterday's closing odometers match today's opening odometers.
- **Mid-Day**:
  1. Capture customer ad-hoc booking requests in `#quotes` or `#bookings`.
  2. Check `#expenses` for pending fuel log approvals.
- **Month-End (28th to 2nd)**:
  1. Open `#invoices`. Run "Month Close" for institutional and corporate contracts.
  2. Export PDF invoices and dispatch to client billing departments.

---

### 🚗 Driver Mobile PWA Guide (English & Malayalam)
- **Starting Trip / രാവിലെ ഡ്യൂട്ടി ആരംഭിക്കുമ്പോൾ**:
  1. Open the app link on your phone.
  2. Tap **"Start Duty / ഡ്യൂട്ടി ആരംഭിക്കുക"**.
  3. Enter current odometer reading (KM) and optional photo.
- **Ending Trip / വൈകുന്നേരം ഡ്യൂട്ടി അവസാനിപ്പിക്കുമ്പോൾ**:
  1. Tap **"Close Duty / ഡ്യൂട്ടി അവസാനിപ്പിക്കുക"**.
  2. Enter closing odometer reading and duty end time.
- **No Mobile Signal? (ഓഫ്‌ലൈൻ മോഡ്)**:
  - Don't worry! Enter the KM as usual. The app saves it in your phone's memory (**Offline Queue**) and automatically uploads it to the office as soon as network signal returns.

---

### 🏢 Customer Coordinator Portal Guide
- **Reviewing Vehicle Service**:
  1. Click the secure approval link received from StarCiti operations.
  2. The screen shows all daily trips for your assigned vehicle(s) for the billing cycle.
  3. Check the total KM, starting points, destinations, and official extra hours.
  4. Click **"Verify & Approve"** to authorize billing submission.

---

### 👑 Business Owner / Admin Guide
- **Monitoring Health & Revenue**:
  1. Check `#dashboard` for pending payments, overdue compliance certificates (Insurance/Pollution/Permits), and active fleet count.
  2. Open `#reports` to view profit margins per vehicle and see which vehicles generate the highest return on investment.
  3. Open `#settings` → **"Go-live checklist"** to review pending bank details, tax profiles, or series numbers before switching from the test pilot to production.

---

## 5. Special Features Explained Simply

### Template-Driven Billing
In many software packages, invoice formats are hardcoded into the software. In Starciti Fleet Desk:
- Every invoice layout is a **declarative template**.
- Want to hide fuel lines on school invoices? Set `showFuelBreakup: false` in the template.
- Want to include a 31-day logbook annexure on VTL invoices? Set `includeAnnexure: true`.
- Both entities use their own independent starter templates: **"Starter: Per-trip package"** and **"Starter: Monthly contract"**.

### Excel Column Mapper
Every corporate customer maintains their logbook differently: one puts Date in Column A, another puts Date in Column C; one labels it "Total KM", another calls it "Closing Odo".
- Starciti's **Importer** lets you click and map columns visually.
- Click **"Save as Customer Profile"** (e.g. `VTL Standard Format`). Next month, you just upload the file and click Import in 5 seconds.

### Trip Locking & Invoice Immutability
- Once an invoice is issued, its `is_locked` flag turns `TRUE`.
- PostgreSQL database triggers prevent any modification to locked trips.
- If an invoice was created by mistake:
  1. Click **"Cancel Invoice"** (requires Admin reason).
  2. The invoice number is archived as cancelled (no numbering gaps).
  3. The linked trips unlock so corrections can be made and re-billed.

### Offline Queue for Drivers
- Drivers operating in remote ghats or underground basements don't lose data.
- Built using browser IndexedDB storage.
- An amber status badge (`● 2 queued trips`) indicates data waiting to sync. Once cellular data is re-established, the queue flushes automatically.

### Internal Caution Notes vs Customer Documents
- Staff can record internal notes on vehicles, drivers, or clients (e.g. *"Driver complains of slight clutch shudder"* or *"Client coordinator prefers morning billing call"*).
- The engine guarantees **Zero Leakage**: Internal flags are strictly stripped and will **never** appear on customer PDFs, WhatsApp duty slips, or approval links.

---

## 6. Frequently Asked Questions (FAQs)

#### Q1: How do I switch between StarCiti Group and City Tours & Travels?
> In the top-right header, click the **Billing Entity dropdown**. Selecting an entity instantly filters your invoices, series numbers, letterhead logo, and bank account details.

#### Q2: Can a driver see billing amounts or invoice profits?
> **No.** Driver logins are restricted by Row Level Security (RLS). Drivers can only view their own vehicle assignments and log KM/hours/fuel. Financial rates, customer contracts, and invoice amounts are completely invisible to drivers.

#### Q3: Why is my invoice series showing "TEST-SC-0001" instead of my real invoice number?
> The system starts safely in **Pilot Mode** with a TEST series so you can test importing, logging, and PDF printing without wasting legal tax invoice numbers. Once you are ready, go to **Settings → Go-live checklist** to enter your starting invoice numbers (e.g., `SC/26-27/0150`).

#### Q4: What happens if an extra hour is recorded as "9 hours 45 minutes"?
> The billing engine converts 9h 45m to **9.75 decimal hours** for accurate pro-rata calculation. If you need to match historical paper invoices that treated 9h45m as `9.45`, you can toggle on the *"Bill extra hours the old spreadsheet way"* flag in the contract terms.

#### Q5: Can I access the demo on my mobile phone while the server runs on a PC?
> **Yes.** You can open the live public HTTPS link on any smartphone or tablet. The UI automatically adapts to touch screens, and the Driver PWA is optimized for one-hand operation.

#### Q6: How do I back up our company data?
> Self-hosted backups run automatically every night. You can also run `scripts/backup_production.cjs` or use the Admin update script (`npm run update`), which always takes a safety snapshot before any upgrade.

#### Q7: What if my PC loses power or restarts?
> All Docker services (`db`, `auth`, `rest`, `storage`, `frontend`) have `restart: unless-stopped` enabled. When your PC reboots and Docker Desktop starts, the entire stack resumes automatically without requiring manual terminal commands.

---

## 7. Quick Reference & Keyboard Shortcuts

### Global Keyboard Shortcuts
- **`⌘K` / `Ctrl+K`**: Open the **Command Palette** to search customers, vehicles, drivers, or jump to any screen instantly.
- **`Esc`**: Close any active modal or drawer.

### System Color Codes & Badges
- 🟢 **Green (Active / Billed / Healthy)**: Active contract, verified trip, or paid invoice.
- 🟡 **Amber (Pending / Draft / Warning)**: Unbilled trip, renewal due within 30 days, or incomplete cost warning.
- 🔴 **Red (Critical / Expired / Overdue)**: Overdue invoice, expired vehicle RC/Insurance, or locked entry rejection.
- 🔵 **Blue (Informational)**: Package trip count or audit log entry.

---

### Need Assistance During Demo?
Open the **Command Palette (`Ctrl+K`)** and type the name of any customer, vehicle, or action to jump directly to it!
