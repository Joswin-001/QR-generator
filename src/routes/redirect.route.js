const express = require('express');
const router = express.Router();
const batchStore = require('../store/batch.store');

router.post('/api/redirect/register', (req, res) => {
  const { batchId, skus } = req.body;
  if (!batchId || !Array.isArray(skus) || skus.length === 0) {
    return res.status(400).json({ error: 'batchId and skus required' });
  }
  const cleanBatchId = batchId.trim().toUpperCase();
  const cleanSkus = skus.map(s => s.trim().toUpperCase()).filter(Boolean);
  batchStore.save(cleanBatchId, cleanSkus, []);
  const proxyBaseUrl = process.env.PROXY_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return res.status(201).json({
    batchId: cleanBatchId,
    skus: cleanSkus,
    redirectUrl: `${proxyBaseUrl}/r/${cleanBatchId}`,
  });
});

router.get('/r/:batchId', (req, res) => {
  const batchId = req.params.batchId.trim().toUpperCase();
  const entry = batchStore.get(batchId);

  if (!entry) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Batch Not Found</title><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
      <body style="background:#0f0f13;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
        <h2>Batch Not Found</h2>
        <p style="color:#aaa;margin-top:10px;">This QR code points to a batch that doesn't exist on this server.</p>
        <p style="color:#666;font-size:12px;margin-top:20px;">(If you generated this locally, it's saved on your local machine, not on Railway)</p>
      </body>
      </html>
    `);
  }

  const cardsHtml = entry.skus.map((sku, i) => {
    const imageBase64 = entry.images && entry.images[i];
    const productUrl = `https://www.jtv.com/product/${sku}`;

    const imgSrc = imageBase64
      ? (imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`)
      : null;

    return `
      <a class="card" href="${productUrl}" target="_blank">
        ${imgSrc
        ? `<img class="card-img" src="${imgSrc}" alt="${sku}"/>`
        : `<div class="card-img-placeholder">No image</div>`
      }
        <div class="card-body">
          <span class="card-sku">${sku}</span>
        </div>
        <span class="card-btn">Shop Now &rarr;</span>
      </a>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>JTV Collection &middot; ${batchId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f13;
      color: #fff;
      min-height: 100vh;
    }
    header {
      background: #1a1a24;
      border-bottom: 1px solid #2a2a3a;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    header svg { width: 32px; height: 32px; flex-shrink: 0; }
    header h1 { font-size: 18px; font-weight: 700; }
    header p { font-size: 12px; color: #888; margin-top: 2px; }
    .batch-badge {
      margin-left: auto;
      background: #2a2a3a;
      border: 1px solid #3a3a4a;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 11px;
      color: #aaa;
      font-family: monospace;
    }
    .container { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 16px;
    }
    #grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .card {
      background: #1a1a24;
      border: 1px solid #2a2a3a;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.15s, border-color 0.15s;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
    }
    .card:hover { transform: translateY(-2px); border-color: #e63946; }
    .card-img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      background: #fff;
      padding: 8px;
    }
    .card-img-placeholder {
      width: 100%;
      aspect-ratio: 1;
      background: #2a2a3a;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #444;
      font-size: 12px;
    }
    .card-body {
      padding: 12px;
      flex: 1;
    }
    .card-sku {
      font-family: monospace;
      font-size: 12px;
      color: #e63946;
      font-weight: 700;
    }
    .card-btn {
      margin: 0 12px 12px;
      background: #e63946;
      color: #fff;
      border-radius: 8px;
      padding: 10px;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      display: block;
    }
    footer { text-align: center; padding: 32px 16px; color: #444; font-size: 12px; }
  </style>
</head>
<body>
<header>
  <svg viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#e63946"/>
    <path d="M8 8h16v3H8zM8 14.5h10v3H8zM8 21h13v3H8z" fill="#fff"/>
  </svg>
  <div>
    <h1>JTV Collection</h1>
    <p>Scan results from your imagesheet</p>
  </div>
  <span class="batch-badge">Batch: ${batchId}</span>
</header>
<div class="container">
  <p class="section-title">${entry.skus.length} products found</p>
  <div id="grid">${cardsHtml}</div>
</div>
<footer>jewelrytelevision.com &nbsp;&middot;&nbsp; Powered by JTV Code Forge</footer>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  return res.send(html);
});

router.get('/api/redirect/batches', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  return res.json(batchStore.list());
});

module.exports = router;
