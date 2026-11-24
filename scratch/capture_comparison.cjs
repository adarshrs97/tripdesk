const { chromium } = require('playwright');
const path = require('path');

async function captureComparison() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto('http://localhost:4173/#invoices');
  await page.waitForTimeout(1000);

  // Navigate to step 4
  const proceedBtn = await page.getByRole('button', { name: /Proceed to Review/i });
  if (proceedBtn) await proceedBtn.click();
  await page.waitForTimeout(600);

  const issueStepBtn = await page.getByRole('button', { name: /Proceed to Issue/i });
  if (issueStepBtn) await issueStepBtn.click();
  await page.waitForTimeout(600);

  const lockBtn = await page.getByRole('button', { name: /Issue & Lock Invoice/i });
  if (lockBtn) await lockBtn.click();
  await page.waitForTimeout(1000);

  // Click View Side-by-Side Comparison
  const compBtn = await page.getByRole('button', { name: /View Side-by-Side Comparison/i });
  if (compBtn) {
    await compBtn.click();
    await page.waitForTimeout(1000);
    const outDir = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';
    await page.screenshot({ path: path.join(outDir, 'm5_side_by_side_comparison.png') });
    console.log('Saved m5_side_by_side_comparison.png');
  }

  await browser.close();
}

captureComparison().catch(err => {
  console.error(err);
  process.exit(1);
});
