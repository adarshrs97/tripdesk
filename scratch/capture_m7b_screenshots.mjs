import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to app...');
  await page.goto('http://localhost:4173/');
  await page.waitForLoadState('networkidle');

  // 1. Navigate to Fleet Compliance
  console.log('Navigating to Fleet Compliance...');
  await page.locator('button:has-text("Fleet & Drivers")').click();
  await page.waitForTimeout(400);

  // Click on "Compliance Calendar"
  const compNav = page.locator('button:has-text("Compliance Calendar")');
  await compNav.click();
  await page.waitForTimeout(1000);

  // Capture screenshot 1: Fleet Compliance Dashboard
  console.log('Capturing m7b_fleet_compliance_dashboard.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm7b_fleet_compliance_dashboard.png') });

  // Click on "Vehicle Documents Checklist" tab
  console.log('Clicking Vehicle Documents Checklist tab...');
  await page.locator('button:has-text("Vehicle Documents Checklist")').click();
  await page.waitForTimeout(600);
  console.log('Capturing m7b_vehicle_documents_checklist.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm7b_vehicle_documents_checklist.png') });

  // 2. Navigate to More & Settings -> Compliance Alerts tab
  console.log('Navigating to Settings -> Compliance Alerts...');
  await page.locator('button:has-text("More & Settings")').click();
  await page.waitForTimeout(500);

  await page.locator('button:has-text("Compliance Alerts")').click();
  await page.waitForTimeout(600);

  console.log('Capturing m7b_compliance_settings.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm7b_compliance_settings.png') });

  // 3. Capture Updated Fuel Log Modal with Full Tank check
  console.log('Navigating back to Fuel & Expenses...');
  await page.locator('button:has-text("Fleet & Drivers")').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Fuel & Expenses")').click();
  await page.waitForTimeout(600);

  await page.locator('button:has-text("Log Driver Fuel Entry")').click();
  await page.waitForTimeout(500);

  console.log('Capturing m7a_full_tank_fuel_modal.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm7a_full_tank_fuel_modal.png') });

  await browser.close();
  console.log('All M7b screenshots captured successfully.');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
