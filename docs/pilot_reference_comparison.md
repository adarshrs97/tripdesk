# Starciti Fleet & Billing Desk — Pilot Real-Data Invoice Comparison

**Reference Document**: `reference/Invoice VTL August 2026- Monthly.pdf` (Invoice #108190)  
**Contract**: M/s Vindhya Telelinks Limited (Public Limited Company) &bull; Agreement Date: 12/08/2024 &bull; Status: Renewal Pending  
**Vehicle**: KL 01 CP 3284 (Maruti Dzire Sedan) &bull; Fixed 3,000 KM & 12 Hrs/Day @ ₹65,000/month  
**Billing Period**: 01/08/2026 to 31/08/2026 (31 calendar days)

---

## 1. Line-by-Line Financial Reconciliation

| Billing Component | Reference Paper Bill (#108190) | Starciti Billing Engine (Pure) | Starciti with Legacy Toggle | Difference & Audit Note |
| :--- | :--- | :--- | :--- | :--- |
| **Fixed Monthly Retainer** | ₹65,000.00 | ₹65,000.00 | ₹65,000.00 | **Exact Match (₹0 diff)** |
| **Included KM Allowance** | 3,000 KM | 3,000 KM | 3,000 KM | **Exact Match** |
| **Actual Distance Run** | 1,884 KM | 1,884 KM | 1,884 KM | **Exact Match** |
| **Extra KM Charged** | 0 KM (₹0) | 0 KM (₹0) | 0 KM (₹0) | **Exact Match (1884 < 3000)** |
| **Extra Duty Duration** | 9h 45m | 585 mins (9h 45m = 9.75 hrs) | 9.45 decimal hrs | **Calculated to the exact minute** |
| **Extra Hours Amount** | ₹1,417.50 | ₹1,462.50 | ₹1,417.50 | **₹45.00 Discrepancy Explained** *(See §2 below)* |
| **Driver Night Bata** | ₹400.00 (2 days @ ₹200) | ₹400.00 (2 days @ ₹200) | ₹400.00 | **Exact Match (Aug 1 & Aug 22)** |
| **Outstation Bata** | ₹600.00 (3 days @ ₹200) | ₹600.00 (3 days @ ₹200) | ₹600.00 | **Exact Match (Aug 5, 16, 19)** |
| **Toll & State Permits** | ₹1,200.00 (2 permits @ ₹600)| ₹1,200.00 (2 permits @ ₹600) | ₹1,200.00 | **Exact Match (Kanyakumari)** |
| **Gross Subtotal** | ₹68,617.50 | ₹68,662.50 | ₹68,617.50 | **₹45.00** |
| **Round Off** | -₹0.50 | -₹0.50 | -₹0.50 | **Down to whole rupee** |
| **Total Payable** | **₹68,617.00** | **₹68,662.00** | **₹68,617.00** | **100% Rupee-Accurate** |

---

## 2. Root-Cause Analysis of the Historical ₹45 Discrepancy

On the historical August 2026 invoice, the staff typed:
$$\text{Extra Hours} = 9.45 \times ₹150 = ₹1,417.50$$

However, 585 minutes equals 9 hours and 45 minutes:
$$\frac{45\text{ minutes}}{60\text{ minutes/hour}} = 0.75\text{ hours}$$
$$\text{Correct Duration} = 9.75\text{ hours} \times ₹150 = ₹1,462.50$$

- **Business Impact**: Typing `9.45` directly from the clock reading caused Starciti to lose ₹45 on every invoice with 45 minutes extra duty.
- **Starciti Advantage**: The new pure billing engine prevents this loss by calculating pro-rata by minute. Furthermore, if VTL's procurement auditors demand the historical calculation bug for backward consistency, the contract setting `legacyDecimalHoursBug: true` can be toggled to match ₹68,617 to the exact rupee.

---

## 3. Visual Layout & Typography Match

- **Header**: Matches City Tours & Travels trade styling, Killipalam Trivandrum address, proprietor contact details, PAN, and GSTIN.
- **Metadata Box**: Right-aligned Invoice Number, Date, Billing Period, and Vehicle Registration Number (KL 01 CP 3284).
- **Recipient Block**: Formatted recipient name and Trivandrum office address.
- **Duty Details Table**: 8-column layout with Date, Vehicle, Start KM, Close KM, Total KM, Start Time, Close Time, Extra Hours, and Remarks.
- **Breakup Box**: Itemized summary of Fixed Monthly Rate, Extra Hours, Night Bata, Outstation Bata, Toll & Permit, Round Off, and Total Payable.
- **Amount in Words**: Automatic Indian Numbering System (`Sixty Eight Thousand Six Hundred and Sixty Two Only`).
- **Annexure**: Verified complete 31-day log attached automatically.
