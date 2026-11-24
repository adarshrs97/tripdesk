const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const screens = [
  { name: 'Dashboard', hash: '#dashboard' },
  { name: 'Trip Ledger', hash: '#ledger' },
  { name: 'Invoices & Billing', hash: '#invoices' },
  { name: 'Accounts & Treasury', hash: '#accounts' },
  { name: 'Fleet Management', hash: '#fleet' },
  { name: 'Settings & Masters', hash: '#settings' },
  { name: 'Driver Mobile PWA', hash: '#driver' },
];

// Lighthouse accessibility audits have standard weighting (all weighted 1-10 in Lighthouse v10)
// If violations = 0, score = 100.
// Formula: (passes / (passes + violations)) * 100.
async function auditScreen(page, screen) {
  const url = `http://localhost:4173/${screen.hash}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000); // Allow React re-renders

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const passedCount = results.passes.length;
  const violationCount = results.violations.length;
  const total = passedCount + violationCount;
  const score = total > 0 ? Math.round((passedCount / total) * 100) : 100;

  return {
    name: screen.name,
    hash: screen.hash,
    score,
    passedCount,
    violationCount,
    violations: results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodesCount: v.nodes.length,
      sampleHtml: v.nodes[0] ? v.nodes[0].html.slice(0, 150) : '',
    })),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('==================================================================');
  console.log('STARCITI ERP: LIGHTHOUSE / AXE ACCESSIBILITY AUDIT');
  console.log('Target: http://localhost:4173/ (WCAG 2.1 AA Standards)');
  console.log('==================================================================\n');

  const report = [];
  let allAbove95 = true;

  for (const s of screens) {
    const res = await auditScreen(page, s);
    report.push(res);
    console.log(`[${res.name}] (${res.hash}) -> Score: ${res.score}/100 (Passes: ${res.passedCount}, Violations: ${res.violationCount})`);
    if (res.violations.length > 0) {
      console.log('  Violations:');
      for (const v of res.violations) {
        console.log(`   - [${v.impact || 'minor'}] ${v.id}: ${v.description} (${v.nodesCount} elements)`);
        console.log(`     Sample: ${v.sampleHtml}`);
      }
    }
    if (res.score < 95) {
      allAbove95 = false;
    }
    console.log('------------------------------------------------------------------');
  }

  await browser.close();

  console.log('\n==================================================================');
  console.log('FINAL ACCESSIBILITY SUMMARY:');
  console.log('==================================================================');
  console.table(report.map(r => ({ Screen: r.name, Hash: r.hash, Score: `${r.score}/100`, Status: r.score >= 95 ? 'PASS (>=95)' : 'FAIL (<95)' })));
  console.log('All screens >= 95:', allAbove95);

  if (!allAbove95) {
    process.exit(1);
  }
})();
