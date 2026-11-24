# Starciti Fleet Desk - Owner Demonstration & Walkthrough Checklist

> **Purpose:** Internal operational guide for conducting live screen-by-screen walkthroughs with the fleet owner (Mr. Ratnaraj).
> **Note:** This is an internal engineering & desk reference document, not shown in the customer-facing UI.

---

## 1. Operational Dashboard & High-Level Health
* **URL:** `/#dashboard`
* **What to Show:**
  * Active vehicles, ongoing driver duties, and month-end close reminder badge (active 28th to 1st).
  * Fast navigation via keyboard shortcut (`⌘K` / `Ctrl+K`) opening the Command Palette.
  * Supplier entity indicator showing active legal billing identity (*M/S City Tours & Travels* [Format 2 / VTL] or *StarCiti Group* [Format 1 / School]).

---

## 2. Daily Trip Ledger Grid (Format 2 Institutional - VTL August 2026)
* **URL:** `/#ledger`
* **What to Show:**
  * Real 31 days of August 2026 loaded directly from verified logbook:
    * 24 active run days on primary vehicle `KL01 CP 3284` (Hemanth Kumar).
    * 1 substitute vehicle run on `KL74 E 3694` (Afzal, 20-Aug-2026, 50 km).
    * 4 Sundays and 2 Onam public holidays (26 & 28 Aug) correctly categorized.
  * Inline anomaly detection (red/amber flags on KM gaps > 15 km, duty hours > 16 hrs, or missing driver/vehicle).
  * "Acknowledge Anomaly" workflow with audit trail.
  * Excel / CSV Importer: demonstrates composite key deduplication (`vehicle + date + start_km`). Re-importing the same sheet results in 0 duplicate records.

---

## 3. Driver Mobile Phone View (Malayalam & English PWA)
* **URL:** `/#driver`
* **What to Show:**
  * Mobile-optimized full-screen interface tailored for phone use in cabs.
  * Instant bilingual toggle (**EN** / **മലയാളം**):
    * Trip start/end (ആരംഭം / അവസാനം).
    * Opening KM / Closing KM (ആരംഭ കി.മീ / അവസാന കി.മീ).
    * Toll, Parking & Outstation Bata allowance toggles.
  * Live camera snapshot capture for odometer proof & fuel receipts.
  * Offline-first queue: logs saved locally in IndexedDB/localStorage when mobile data is dropped in transit, syncing automatically upon network restoration.

---

## 4. Month-Close Wizard & Billing Reconciliation (VTL Contract)
* **URL:** `/#invoices`
* **What to Show:**
  * **Step 1 - Pre-flight Gate:** Checks for unacknowledged ledger gaps, pending driver fuel entries, and customer coordinator approval status.
  * **Step 2 - Dual-Rate Calculation:**
    * Fixed monthly allowance (e.g., 1,500 km @ ₹20,000 / ₹42,000 base package).
    * Extra KM calculation (@ ₹13/km or ₹14/km).
    * Extra Hours calculation (@ ₹75/hr or ₹100/hr).
    * Sunday/Holiday run allowances & driver night/outstation bata.
  * **The August 2026 VTL Difference Analysis:**
    * Calculated Total: **₹68,662.50** (rounds to ₹68,662).
    * Historically Billed: **₹68,617.00**.
    * Exact difference: **₹45.00** (extra hours 9h45m was billed as 9.45 decimal in the historical spreadsheet, rather than 9.75 decimal hours (9h + 45/60m)).
  * **Step 3 - Draft Preview:** Series-aware invoice generation using the isolated `TEST-` series on the development machine until real sequence starts are provided.
  * **Step 4 - Atomic Final Issuance:** Immutable lock on trip ledger records; status moves to `issued`.

---

## 5. Global Public School Monthly Billing (Format 1 Package)
* **URL:** `/#invoices` (Filter: Global Public School)
* **What to Show:**
  * Trip-package billing structure matching real school invoice photo:
    * Standard monthly vehicle package: **₹21,210.00**.
    * Dedicated route billing for vehicle `KL21 M 2378` / `KL82 4889`.
  * TDS configuration per customer setting with explicit "Confirm with your CA" guidance (no hardcoded pre-selected deduction).

---

## 6. Template Builder & Letterhead Gallery
* **URL:** `/#templates`
* **What to Show:**
  * Visual side-by-side template designer with instant print preview.
  * Switch between:
    * *Format 1:* School / Package tabular slip.
    * *Format 2:* Institutional Logbook Detailed Annexure (VTL).
    * *Format 3:* Modern GST Tax Invoice with SAC 9966 breakdown.
  * Strict separation: templates are pure declarative JSON definitions; tax and calculation rules remain in tested TypeScript code.

---

## 7. Driver Expenses & Fuel Fraud Prevention
* **URL:** `/#expenses`
* **What to Show:**
  * Fuel entries review queue.
  * **Full-Tank Method:** Calculates true km/L between consecutive full-tank fills. Single partial fills show "Insufficient data (accumulating to next full fill)" rather than raising false outlier alarms.
  * **Automated Fraud Checks:**
    * Odometer rollback detection (fuel odometer < previous trip odometer).
    * Duplicate bill detection (matching date, station, amount, or perceptual image hash).
    * Fuel-type specific thresholds (Diesel vs Petrol vs CNG vs EV) with per-vehicle expected km/L ranges.
  * "Hold from settlement" toggle for suspicious slips pending driver clarification.

---

## 8. Fleet Compliance & Expiry Alerts Calendar
* **URL:** `/#compliance`
* **What to Show:**
  * Expiry tracking for all 4 fleet vehicles (`KL01 CP 3284`, `KL82 4889`, `KL74 E 3694`, `KL21 M 2378`).
  * Color-coded alerts:
    * **Red:** Expired or expiring within 7 days.
    * **Amber:** Expiring within 30 days.
    * **Green:** Fully compliant.
  * Documents tracked: Registration Certificate (RC), Fitness Certificate (FC), Motor Insurance, State Road Tax, Pollution (PUC), and All-Kerala / National Permits.

---

## 9. Internal Notes & Caution Flags (Zero-Leakage Guarantee)
* **URL:** `/#flags`
* **What to Show:**
  * Entity-linked notes for Customers, Vehicles, Drivers, and Vendors.
  * Severity levels: `Note`, `Caution` (amber advisory), and `Avoid` (hard warning requiring written admin override reason).
  * **Zero-Leakage Proof:** Flags resurface *only* in internal dispatch, allocation, and month-close screens for staff/admin. They are strictly excluded from:
    * Customer PDF invoices and duty slips.
    * Customer WhatsApp approval portal.
    * Driver mobile phone app.

---

## 10. Accounts, Receivables & Profitability Reports
* **URL:** `/#accounts` and `/#reports`
* **What to Show:**
  * Clean production-ready empty states for newly added accounts ("Add your first bank account", "No vehicle loan EMI schedules recorded").
  * Cash ledger (petty cash receipts and disbursements).
  * Accounts Receivables Ageing report (0-30 days, 31-60 days, 61-90 days, 90+ days overdue).
  * Vehicle-level Profit & Loss: Revenue minus Fuel, Maintenance, and EMI share. Shows "Incomplete data" rather than zero-filling when operational expenses are missing.
