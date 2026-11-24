import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to app...');
  await page.goto('http://localhost:4173/');
  await page.waitForLoadState('networkidle');

  // Click on "Fleet & Drivers" in primary sidebar navigation
  console.log('Clicking Fleet & Drivers...');
  await page.locator('button:has-text("Fleet & Drivers")').click();
  await page.waitForTimeout(500);

  // Click on "Fuel & Expenses" subpage
  console.log('Clicking Fuel & Expenses subpage...');
  await page.locator('button:has-text("Fuel & Expenses")').click();
  await page.waitForTimeout(1000);

  // Capture screenshot 1: Fuel & Expenses Review Queue
  console.log('Capturing m7a_fuel_review_queue.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm7a_fuel_review_queue.png') });

  // Open "Log Driver Fuel Entry" modal
  console.log('Opening Driver Fuel Log Modal...');
  const logButton = page.locator('button:has-text("Log Driver Fuel Entry")');
  await logButton.click();
  await page.waitForTimeout(600);

  // Capture screenshot 2: Driver Fuel Log Modal
  console.log('Capturing m7a_driver_fuel_log_modal.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm7a_driver_fuel_log_modal.png') });

  // Close modal
  await page.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(400);

  // Click on "More & Settings"
  console.log('Navigating to More & Settings...');
  await page.locator('button:has-text("More & Settings")').click();
  await page.waitForTimeout(500);

  // Click on "Fuel Thresholds" tab
  console.log('Clicking Fuel Thresholds tab in Settings...');
  await page.locator('button:has-text("Fuel Thresholds")').click();
  await page.waitForTimeout(600);

  // Capture screenshot 3: Fuel Thresholds Settings
  console.log('Capturing m7a_fuel_thresholds_settings.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm7a_fuel_thresholds_settings.png') });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
