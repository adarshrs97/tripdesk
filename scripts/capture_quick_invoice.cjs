const { chromium } = require('playwright');
const path = require('path');
const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("+ New Quick Invoice")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm6_quick_invoice_modal.png') });
  console.log('Saved m6_quick_invoice_modal.png successfully!');
  await browser.close();
})().catch(console.error);
