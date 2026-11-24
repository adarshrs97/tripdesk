const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4173/ ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Capture Quick Invoice Modal
  console.log('Opening Quick Invoice Modal...');
  const newInvBtn = await page.$('button:has-text("+ New Invoice")');
  if (newInvBtn) {
    await newInvBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm6_quick_invoice_modal.png') });
    console.log('Saved m6_quick_invoice_modal.png');
    // Close modal
    const cancelBtn = await page.$('button:has-text("Cancel")');
    if (cancelBtn) await cancelBtn.click();
    await page.waitForTimeout(400);
  }

  // 2. Navigate to Settings
  console.log('Navigating to Settings...');
  const settingsNav = await page.$('a[href="/settings"], button:has-text("Settings")');
  if (settingsNav) {
    await settingsNav.click();
  } else {
    // Click sidebar link
    await page.click('text=Settings');
  }
  await page.waitForTimeout(600);

  // 3. Capture Tax Profiles tab
  console.log('Clicking Tax Profiles tab...');
  await page.click('button:has-text("Tax Profiles")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm6_taxes_catalogue.png') });
  console.log('Saved m6_taxes_catalogue.png');

  // 4. Capture Invoice Templates Gallery
  console.log('Clicking Invoice Templates tab...');
  await page.click('button:has-text("Invoice Templates")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm6_template_gallery.png') });
  console.log('Saved m6_template_gallery.png');

  // 5. Open Visual Builder for Format 2 VTL
  console.log('Opening Visual Builder...');
  const editBtn = await page.$('button:has-text("Inspect / Clone"), button:has-text("Edit Template")');
  if (editBtn) {
    await editBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'm6_visual_builder.png') });
    console.log('Saved m6_visual_builder.png');
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
