const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureEmpty() {
  const artifactDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    console.log('Dialog opened:', dialog.message());
    await dialog.accept();
  });

  console.log('Navigating to Accounts Desk...');
  await page.goto('http://localhost:4173/#accounts');
  await page.waitForTimeout(1000);

  // Click Remove All Sample Data button
  const purgeBtn = await page.$('button:has-text("Remove All Sample Data")');
  if (purgeBtn) {
    console.log('Clicking purge sample data...');
    await purgeBtn.click();
    await page.waitForTimeout(1500);
  }

  // 1. Bank Accounts Empty State
  const bankTab = await page.$('button:has-text("Bank Accounts")');
  if (bankTab) {
    await bankTab.click();
    await page.waitForTimeout(800);
    const bankEmptyShot = path.join(artifactDir, 'm9_accounts_empty_bank_state.png');
    await page.screenshot({ path: bankEmptyShot });
    console.log('Captured empty bank state:', bankEmptyShot);
  }

  // 2. EMI Schedules Empty State
  const emiTab = await page.$('button:has-text("Loan EMI Schedule")');
  if (emiTab) {
    await emiTab.click();
    await page.waitForTimeout(800);
    const emiEmptyShot = path.join(artifactDir, 'm9_accounts_empty_emi_state.png');
    await page.screenshot({ path: emiEmptyShot });
    console.log('Captured empty emi state:', emiEmptyShot);
  }

  await browser.close();
}

captureEmpty().catch(console.error);
