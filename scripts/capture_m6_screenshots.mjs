import { chromium } from 'playwright';
import path from 'path';

const outDir = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4173/#accounts...');
  await page.goto('http://localhost:4173/#accounts', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Receivables Dashboard
  console.log('Taking screenshot 1: m6_receivables_dashboard.png');
  await page.screenshot({ path: path.join(outDir, 'm6_receivables_dashboard.png'), fullPage: false });

  // 2. Payment Modal with 2% TDS
  console.log('Clicking Record Payment button...');
  const recordPaymentBtn = page.locator('button:has-text("Record Payment")').first();
  await recordPaymentBtn.click();
  await page.waitForTimeout(500);

  console.log('Taking screenshot 2: m6_payment_modal_tds.png');
  await page.screenshot({ path: path.join(outDir, 'm6_payment_modal_tds.png'), fullPage: false });

  // Close payment modal
  const cancelPaymentBtn = page.locator('button:has-text("Cancel")');
  await cancelPaymentBtn.click();
  await page.waitForTimeout(500);

  // 3. Customer Statement
  console.log('Clicking Customer Outstanding Statements tab...');
  const customerTabBtn = page.locator('button:has-text("Customer Outstanding Statements")');
  await customerTabBtn.click();
  await page.waitForTimeout(500);

  console.log('Clicking View & Print Account Statement...');
  const statementBtn = page.locator('button:has-text("View & Print Account Statement")').first();
  await statementBtn.click();
  await page.waitForTimeout(500);

  console.log('Taking screenshot 3: m6_customer_statement.png');
  await page.screenshot({ path: path.join(outDir, 'm6_customer_statement.png'), fullPage: false });

  // Close statement modal
  const closeStatementBtn = page.locator('button:has-text("✕")');
  await closeStatementBtn.click();
  await page.waitForTimeout(500);

  // 4. Series Admin
  console.log('Navigating to http://localhost:4173/#settings...');
  await page.goto('http://localhost:4173/#settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  console.log('Clicking Series Admin tab...');
  const seriesAdminTab = page.locator('button:has-text("Series Admin")');
  await seriesAdminTab.click();
  await page.waitForTimeout(500);

  console.log('Taking screenshot 4: m6_series_admin.png');
  await page.screenshot({ path: path.join(outDir, 'm6_series_admin.png'), fullPage: false });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
