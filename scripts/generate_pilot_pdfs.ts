import * as path from 'path';
import * as fs from 'fs';
import {
  renderInvoiceTemplate,
  calculateMonthlyFixedInvoice,
  calculateFormat1Invoice,
  MonthlyFixedContractParams,
  PerTripPackageParams,
} from '../src/engine';
import { format2VTLTemplate } from '../src/engine/templates/seeds/format2VTL';
import { format1SchoolTemplate } from '../src/engine/templates/seeds/format1School';
import { EXACT_SEED_VTL_AUG_2026 } from '../src/services/ledgerService';
import { generateInvoicePdf } from '../src/services/pdfGenerator';

async function main() {
  const outDir = path.resolve(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Generating real PDFs into:', outDir);

  // =========================================================================
  // 1. VTL August 2026 Invoice & Day-by-Day Logbook Annexure (Rs 68,617)
  // =========================================================================
  const vtlParams: MonthlyFixedContractParams = {
    fixedAmount: 65000,
    includedKm: 3000,
    includedHoursPerDay: 12,
    extraKmRate: 18,
    extraHourRate: 150,
    nightBataRate: 200,
    outstationBataRate: 200,
    contractWorkingDays: 30,
    roundingMode: 'down',
    legacyDecimalHoursBug: true, // Reproduces paper bill Rs 68,617
  };

  const vtlCalculation = calculateMonthlyFixedInvoice(
    '2026-08-01',
    '2026-08-31',
    EXACT_SEED_VTL_AUG_2026,
    vtlParams
  );

  const renderedVtl = renderInvoiceTemplate(format2VTLTemplate, {
    invoice: {
      number: '108191',
      date: '02/09/2026',
      periodText: '01/08/2026 to 31/08/2026',
    },
    supplier: {
      legalName: 'M/S CITY TOURS & TRAVELS',
      tradeName: 'M/S CITY TOURS & TRAVELS',
      address: 'TC 36/1229(1), Killipalam, Karamana PO, Trivandrum - 695002',
      phone: '+91 6238603200, 8136910938',
      email: 'citytoursandtravels07@gmail.com',
      pan: 'AFMPR5264Q',
      gstin: '32AFMPR5264Q1ZP',
      bankName: 'Canara Bank',
      accountNumber: '120024108845',
      ifsc: 'CNRB0001200',
    },
    customer: {
      name: 'M/s Vindhya Telelinks Limited (Public Limited Company)',
      billingAddress: 'CC No. 40/1072A, PRG-59, North Janatha Road, Palarivattom, Cochin - 682025',
      pan: 'AAACV7757J',
      gstin: '32AAACV7757J2Z0',
    },
    contract: {
      name: 'Monthly Contract - Vindhya Telelinks Limited',
      agreementNo: '202526000005308395 DT. 01/11/2025',
      vehiclePlate: 'KL 01 CP 3284',
      vehicleType: 'Sedan (Swift Dzire)',
      driverName: 'Hemanth Kumar',
      sacCode: '996601',
    },
    outputs: vtlCalculation,
    rows: [
      {
        description: 'Hiring charges for AC Car KL 01 CP 3284 with Driver for the month of August 2026',
        amount: vtlCalculation.fixedAmount,
      },
    ],
  });

  const vtlPdfPath = path.join(outDir, 'Invoice_VTL_August_2026.pdf');
  await generateInvoicePdf(renderedVtl, {
    outputPath: vtlPdfPath,
    annexureEntries: EXACT_SEED_VTL_AUG_2026,
  });
  console.log('✓ Generated VTL Invoice & Annexure:', vtlPdfPath);

  // =========================================================================
  // 2. Global Public School Real Invoice Sample (Rs 21,210)
  // =========================================================================
  const schoolLines = [
    { date: '2026-08-01', vehicleType: 'Sedan', totalHours: '10:00', totalKm: 82, rate: 2415, addlHours: '0:00', addlKm: 2, amount: 2445 },
    { date: '2026-08-02', vehicleType: 'Sedan', totalHours: '10:30', totalKm: 78, rate: 2415, addlHours: '0:30', addlKm: 0, amount: 2490 },
    { date: '2026-08-03', vehicleType: 'Sedan', totalHours: '10:00', totalKm: 80, rate: 2415, addlHours: '0:00', addlKm: 0, amount: 2415 },
    { date: '2026-08-04', vehicleType: 'Sedan', totalHours: '11:00', totalKm: 95, rate: 2415, addlHours: '1:00', addlKm: 15, amount: 2790 },
    { date: '2026-08-05', vehicleType: 'Sedan', totalHours: '10:00', totalKm: 80, rate: 2415, addlHours: '0:00', addlKm: 0, amount: 2415 },
    { date: '2026-08-06', vehicleType: 'Sedan', totalHours: '12:00', totalKm: 110, rate: 2415, addlHours: '2:00', addlKm: 30, amount: 3165 },
    { date: '2026-08-07', vehicleType: 'Sedan', totalHours: '10:00', totalKm: 80, rate: 2415, addlHours: '0:00', addlKm: 0, amount: 2415 },
    { date: '2026-08-08', vehicleType: 'Sedan', totalHours: '11:30', totalKm: 90, rate: 2415, addlHours: '1:30', addlKm: 10, amount: 3075 },
  ];

  const schoolParams: PerTripPackageParams = {
    basePackageAmount: 2415,
    packageKm: 80,
    packageHours: 10,
    extraKmRate: 15,
    extraHourRate: 150,
  };

  const schoolCalculation = calculateFormat1Invoice(schoolLines, schoolParams);

  const renderedSchool = renderInvoiceTemplate(format1SchoolTemplate, {
    invoice: {
      number: 'SC/2026/08/104',
      date: '31/08/2026',
      periodText: '01/08/2026 to 08/08/2026',
    },
    supplier: {
      legalName: 'StarCiti Group',
      tradeName: 'StarCiti Group',
      address: 'Killipalam, Karamana, Trivandrum - 695002',
      phone: '+91 6238603200',
      email: 'billing@starciti.in',
      pan: 'AFMPR5264Q',
      bankName: 'Canara Bank',
      accountNumber: '120024108845',
      ifsc: 'CNRB0001200',
    },
    customer: {
      name: 'Global Public School',
      billingAddress: 'Attakulangara, Trivandrum - 695023',
    },
    contract: {
      name: 'Daily Student & Faculty Transport',
      agreementNo: 'GPS/TR/2026-27/04',
      vehiclePlate: 'KL 82 4889',
      sacCode: '996601',
    },
    outputs: schoolCalculation,
    rows: schoolCalculation.rows,
  });

  const schoolPdfPath = path.join(outDir, 'Invoice_Global_Public_School_August_2026.pdf');
  await generateInvoicePdf(renderedSchool, {
    outputPath: schoolPdfPath,
  });
  console.log('✓ Generated School Invoice:', schoolPdfPath);
}

main().catch((err) => {
  console.error('Error generating PDFs:', err);
  process.exit(1);
});
