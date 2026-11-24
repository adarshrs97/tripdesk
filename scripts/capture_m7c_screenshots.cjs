const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('1. Capturing Internal Flags Manager...');
  await page.goto('http://localhost:4173/#flags', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm7c_internal_flags_manager.png'),
    fullPage: false,
  });

  console.log('2. Capturing Fleet with Resurfaced Flag Badges...');
  await page.goto('http://localhost:4173/#fleet', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm7c_fleet_resurfacing_flags.png'),
    fullPage: false,
  });

  console.log('3. Capturing Month-Close Step 1 with Resurfaced Flags...');
  await page.goto('http://localhost:4173/#invoices', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm7c_month_close_flags_resurfacing.png'),
    fullPage: false,
  });

  console.log('4. Capturing Fuel Thresholds Settings with Calibration & Units...');
  await page.goto('http://localhost:4173/#settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Click Fuel Efficiency tab if visible
  const fuelTab = page.locator('button:has-text("Fuel Thresholds"), button:has-text("Fuel Efficiency"), button:has-text("Fuel")');
  if (await fuelTab.count() > 0) {
    await fuelTab.first().click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'm7b_fuel_calibration_and_units.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('Screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
