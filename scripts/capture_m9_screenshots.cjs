const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const artifactDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to Accounts Desk...');
  await page.goto('http://localhost:4173/#accounts');
  await page.waitForTimeout(1500);

  // 1. Accounts Desk with Sample Data Warning Banner
  const bannerShot = path.join(artifactDir, 'm9_accounts_sample_data_banner.png');
  await page.screenshot({ path: bannerShot });
  console.log('Captured:', bannerShot);

  // 2. Bank Accounts Tab
  const bankTab = await page.$('button:has-text("Bank Accounts")');
  if (bankTab) {
    await bankTab.click();
    await page.waitForTimeout(800);
    const bankShot = path.join(artifactDir, 'm9_accounts_bank_accounts.png');
    await page.screenshot({ path: bankShot });
    console.log('Captured:', bankShot);
  }

  // 3. EMI Schedules Tab
  const emiTab = await page.$('button:has-text("Loan EMI Schedule")');
  if (emiTab) {
    await emiTab.click();
    await page.waitForTimeout(800);
    const emiShot = path.join(artifactDir, 'm9_accounts_emi_schedules.png');
    await page.screenshot({ path: emiShot });
    console.log('Captured:', emiShot);
  }

  // 4. Settings Manager -> Sample Data & Reset Tab
  console.log('Navigating to Settings Manager...');
  await page.goto('http://localhost:4173/#settings');
  await page.waitForTimeout(1000);
  const sampleDataTab = await page.$('button:has-text("Sample Data & Reset")');
  if (sampleDataTab) {
    await sampleDataTab.click();
    await page.waitForTimeout(800);
    const settingsShot = path.join(artifactDir, 'm9_settings_sample_data_tab.png');
    await page.screenshot({ path: settingsShot });
    console.log('Captured:', settingsShot);
  }

  // 5. Financial Reports
  console.log('Navigating to Financial Reports...');
  await page.goto('http://localhost:4173/#reports');
  await page.waitForTimeout(1200);
  const reportsShot = path.join(artifactDir, 'm9_financial_reports_clean.png');
  await page.screenshot({ path: reportsShot });
  console.log('Captured:', reportsShot);

  await browser.close();
  console.log('All M9 screenshots captured successfully.');
}

capture().catch(console.error);
