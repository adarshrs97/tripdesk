const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function renderReferencePdf() {
  const pdfBuffer = fs.readFileSync('reference/Invoice VTL August 2026- Monthly.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    body { margin: 0; background: #525659; display: flex; justify-content: center; padding: 20px; }
    canvas { background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <canvas id="the-canvas"></canvas>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdfData = atob('${pdfBase64}');
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    loadingTask.promise.then(function(pdf) {
      return pdf.getPage(1);
    }).then(function(page) {
      const scale = 2.0;
      const viewport = page.getViewport({ scale: scale });
      const canvas = document.getElementById('the-canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      return page.render(renderContext).promise;
    }).then(function() {
      window.RENDER_DONE = true;
    }).catch(function(err) {
      window.RENDER_ERROR = err.message;
    });
  </script>
</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });
  await page.setContent(html);

  await page.waitForFunction(() => window.RENDER_DONE === true || window.RENDER_ERROR !== undefined, { timeout: 20000 });

  const isErr = await page.evaluate(() => window.RENDER_ERROR);
  if (isErr) {
    throw new Error('PDF render error: ' + isErr);
  }

  const canvas = await page.$('#the-canvas');
  const outPath = path.resolve('public', 'reference_vtl_invoice.png');
  await canvas.screenshot({ path: outPath });
  console.log('Saved reference PDF rendered image to:', outPath);

  await browser.close();
}

renderReferencePdf().catch(err => {
  console.error('Error rendering reference PDF:', err);
  process.exit(1);
});
