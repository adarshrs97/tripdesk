const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await context.newPage();

  console.log('1. Capturing Accounts Treasury Hub (Cash Register)...');
  await page.goto('http://localhost:4173/#accounts', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm8_accounts_treasury_hub.png'),
    fullPage: false,
  });

  console.log('2. Capturing Vendor Payables Tab...');
  const payablesTab = page.locator('button:has-text("Vendor Payables")');
  if (await payablesTab.count() > 0) {
    await payablesTab.first().click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm8_accounts_vendor_payables.png'),
    fullPage: false,
  });

  console.log('3. Capturing Vehicle Loan EMI Schedule Tab...');
  const emiTab = page.locator('button:has-text("Vehicle Loan EMI")');
  if (await emiTab.count() > 0) {
    await emiTab.first().click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm8_accounts_emi_schedules.png'),
    fullPage: false,
  });

  console.log('4. Capturing Financial Reports Dashboard (Vehicle P&L & Strict Incomplete Data Rule)...');
  await page.goto('http://localhost:4173/#reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm8_financial_reports_pnl.png'),
    fullPage: false,
  });

  console.log('5. Capturing Receivables Ageing Tab...');
  const receivablesTab = page.locator('button:has-text("Receivables Ageing")');
  if (await receivablesTab.count() > 0) {
    await receivablesTab.first().click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm8_receivables_ageing.png'),
    fullPage: false,
  });

  console.log('6. Capturing Fleet Utilisation Tab...');
  const utilTab = page.locator('button:has-text("Fleet Utilisation")');
  if (await utilTab.count() > 0) {
    await utilTab.first().click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm8_fleet_utilisation.png'),
    fullPage: false,
  });

  console.log('7. Capturing Cost Allocation Settings Tab...');
  await page.goto('http://localhost:4173/#settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const costTab = page.locator('button:has-text("Cost Allocation")');
  if (await costTab.count() > 0) {
    await costTab.first().click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm8_cost_allocation_settings.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('Milestone 8 screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
