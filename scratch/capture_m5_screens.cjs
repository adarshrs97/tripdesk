const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureM5() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // Navigate to invoices view in the running app
  await page.goto('http://localhost:4173/#invoices');
  await page.waitForTimeout(2000);

  // 1. Capture Step 1: Check
  const outDir = 'C:/Users/user/.gemini/antigravity/brain/107d0969-7f2d-4fbc-ad55-3fc2b10a33a0';
  await page.screenshot({ path: path.join(outDir, 'm5_step1_check.png') });
  console.log('Saved m5_step1_check.png');

  // Click 'Proceed to Review' to go to Step 2
  const proceedBtn = await page.getByRole('button', { name: /Proceed to Review/i });
  if (proceedBtn) {
    await proceedBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'm5_step2_review_format2.png') });
    console.log('Saved m5_step2_review_format2.png');

    // Click 'Why this amount?'
    const whyBtn = await page.getByRole('button', { name: /Why this amount/i });
    if (whyBtn) {
      await whyBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, 'm5_step2_why_amount.png') });
      console.log('Saved m5_step2_why_amount.png');
    }

    // Click 'Proceed to Issue' to go to Step 3
    const issueStepBtn = await page.getByRole('button', { name: /Proceed to Issue/i });
    if (issueStepBtn) {
      await issueStepBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, 'm5_step3_issue_lock.png') });
      console.log('Saved m5_step3_issue_lock.png');

      // Click 'Issue & Lock Invoice'
      const lockBtn = await page.getByRole('button', { name: /Issue & Lock Invoice/i });
      if (lockBtn) {
        await lockBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(outDir, 'm5_step4_send.png') });
        console.log('Saved m5_step4_send.png');
      }
    }
  }

  // Switch to School Format 1
  await page.goto('http://localhost:4173/#invoices');
  await page.waitForTimeout(1000);
  const schoolBtn = await page.getByRole('button', { name: /Global Public School/i });
  if (schoolBtn) {
    await schoolBtn.click();
    await page.waitForTimeout(800);
    const proceedBtn2 = await page.getByRole('button', { name: /Proceed to Review/i });
    if (proceedBtn2) {
      await proceedBtn2.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, 'm5_step2_review_format1_school.png') });
      console.log('Saved m5_step2_review_format1_school.png');
    }
  }

  await browser.close();
}

captureM5().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
