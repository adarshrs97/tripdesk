const { chromium } = require('playwright');

async function testPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.goto('http://localhost:4173/#invoices');
  await page.waitForTimeout(1500);

  const text = await page.innerText('body');
  console.log('Body text preview:', text.slice(0, 300));

  await browser.close();
}

testPage().catch(err => console.error(err));
