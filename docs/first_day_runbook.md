# Starciti Fleet & Billing Desk — First-Day Runbook
**For Mr. M. Ratnaraj & Office Operations Team**  
*Plain English Guide &bull; Zero Jargon &bull; Step-by-Step*

---

## Welcome!
This guide explains how to use your new system for day-to-day operations: logging trips, closing the month, issuing invoices, sharing bills on WhatsApp, collecting payments with TDS, and correcting any mistakes without headache.

---

## 1. How to Enter a Daily Trip

You have two easy ways to enter trips:

### Method A: Office Bulk Entry (Spreadsheet-Style)
1. In the left navigation menu, click **Trip Ledger**.
2. Select your customer (e.g., *Vindhya Telelinks Limited*) and the month (e.g., *August 2026*).
3. Click the date row you want to fill.
4. Type in:
   - **Start KM** and **Close KM** (The system automatically calculates the used distance).
   - **Start Time** and **Close Time** (The system calculates the running duration and alerts if extra hours apply).
   - If the trip involved outstation travel, night driving, or toll charges, click the respective chip (**Night Bata**, **Outstation**, or type toll amount).
5. Click **Save Row** or press `Enter`. The row is saved immediately.
   - *Odometer Alert*: If there is a jump larger than 15 KM between yesterday's closing and today's start, the system flags it in yellow with an **Anomaly Check** button so you can acknowledge it or fix a typing mistake.

### Method B: Driver Phone App (PWA)
1. Give your driver the mobile link on their phone.
2. In the morning, the driver taps **Start Trip**, types the odometer reading, takes a photo of the dashboard meter, and taps **Submit**.
3. In the evening, the driver taps **Close Trip**, enters the final odometer reading, snaps the photo, and submits.
4. *No internet?* The driver can still log the trip offline. The phone saves it safely and uploads automatically when connection returns.

---

## 2. How to Close the Month & Generate Invoices

At month end (typically on the 28th to 31st of the month), use the **4-Step Month-Close Wizard**:

1. Click **Billing & Invoices** > **Run Month Close**.
2. Select the Customer (*Vindhya Telelinks Limited* or *Global Public School*) and the month.
3. The 4-step wizard guides you:
   - **Step 1: Check**  
     The system checks that all days in the month are accounted for, verifies odometer continuity, and confirms contract status. If a contract is marked *Renewal Pending*, you can provide an admin reason to proceed.
   - **Step 2: Review & "Why This Amount?"**  
     See the exact bill preview formatted exactly like your paper invoices. Click **Why this amount?** to see every formula: fixed monthly rental + extra hours pro-rata + bata + toll. Compare with previous month's bill side-by-side.
   - **Step 3: Issue & Lock**  
     Click **Issue Invoice**. The system grabs the next gap-free invoice number from your series, locks all ledger trips so nobody can change them, and produces a print-ready PDF with complete daily trip annexure.
   - **Step 4: Send**  
     Click **Send via WhatsApp** to instantly send the formatted invoice details to the customer coordinator or download the PDF with one click.

---

## 3. How to Issue an "Invoice for Anyone" (Walk-ins & Quick Trips)

If a customer walks in or calls for a one-off airport pickup, wedding hire, or tempo traveller trip without a pre-existing contract:

1. Click the green **+ New Invoice** button at the top right of any screen.
2. Choose **Invoice Type**: Tax Invoice, Bill of Supply, Proforma, or Trip Sheet.
3. Select an existing customer OR click **+ Add New Customer Inline** to type their name, phone, and address in 10 seconds.
4. Add line items:
   - Click a **Quick Pick Service** chip (e.g., *Airport Pickup TRV*, *Outstation Running @ ₹16/km*), OR
   - Type custom description, quantity, rate, discount, and tax rate.
5. Click **Issue Invoice**. Your invoice is generated immediately with proper GST breakup and amount in words.

---

## 4. How to Send an Invoice on WhatsApp

1. On the invoice details page or at Step 4 of the wizard, click **Send via WhatsApp**.
2. A WhatsApp window opens with a pre-written, professional message:
   - Invoice Number & Date
   - Customer Name & Billing Period
   - Amount Payable in ₹
   - Bank details for NEFT/RTGS payment
3. Click send in WhatsApp. If you also want to attach the PDF, click **Download PDF** and attach it to the chat.

---

## 5. How to Record Payment and TDS

When the customer pays your bank account or hands you a cheque/cash:

1. Go to **Receivables & Payments** in the sidebar.
2. Find the invoice and click **Record Payment**.
3. Enter:
   - **Payment Date** and **Payment Mode** (Bank Transfer / NEFT, UPI, Cheque, or Cash).
   - **Amount Received**: Type the actual amount credited to your bank account.
   - **TDS Deducted**: If the customer deducted tax (e.g., 1% or 2% under Section 194C):
     - The modal automatically displays the customer's PAN type (Company vs Individual/Firm).
     - Click **1%** or **2%** or type the exact TDS amount deducted as shown on their payment advice.
     - Note: An advisory reminder *"Confirm with your CA"* is displayed to ensure tax year alignment.
   - **Transaction Reference**: Bank UTR number or Cheque number.
4. Click **Save Payment**.
   - The invoice status automatically updates: **Paid in Full** (green) or **Part Paid** (amber) with remaining balance.

---

## 6. How to Undo a Mistake

Mistakes happen. Here is how to handle them cleanly and legally:

### Scenario A: Mistake in a Daily Trip (Before Month-Close)
- If the month has NOT been closed, simply open **Trip Ledger**, click the row, correct the KM or hours, and save.

### Scenario B: Mistake on an Issued / Locked Invoice
- To protect your business legally under GST audit rules, locked invoices cannot be silently overwritten. Instead:
  1. **Option 1: Issue a Credit Note or Debit Note**  
     Go to the invoice, click **Issue Credit/Debit Note**. Enter the adjustment amount (e.g., if you overcharged ₹1,200 for a toll, issue a Credit Note of ₹1,200). The customer's receivable balance is reduced automatically.
  2. **Option 2: Cancel the Entire Invoice**  
     If an invoice was created by accident or with the wrong customer:  
     - Go to **Settings > Series & Numbering** or open the invoice.  
     - Click **Cancel Invoice**.  
     - Type a mandatory cancellation reason (e.g. *"Duplicate invoice created in error"*).  
     - The invoice number is preserved with status **CANCELLED** (never deleted, so your serial numbering has zero gaps).  
     - All 31 daily ledger trips are immediately **unlocked**, allowing you to fix the ledger and issue a fresh invoice.

---

## 7. Need Help?
- **Office Telephone**: +91 6238603200 / +91 8136910938
- **Primary Supplier**: City Tours & Travels / Starciti Group
- **Tax & Billing Setup**: Settings > Tax Profiles & Item Catalogue
