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
  batchStore.save(cleanBatchId, cleanSkus);
  const proxyBaseUrl = process.env.PROXY_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return res.status(201).json({
    batchId: cleanBatchId,
    skus: cleanSkus,
    redirectUrl: `${proxyBaseUrl}/r/${cleanBatchId}`,
  });
});

// QR scan lands here → serve collection page
router.get('/r/:batchId', (req, res) => {
  const batchId = req.params.batchId.trim().toUpperCase();
  const entry = batchStore.get(batchId);

  if (!entry) {
    return res.redirect(302, 'https://www.jtv.com');
  }

  const skusJson = JSON.stringify(entry.skus);
  const algoliaAppId = process.env.ALGOLIA_APP_ID || '';
  const algoliaApiKey = process.env.ALGOLIA_API_KEY || '';
  const algoliaIndex = process.env.ALGOLIA_INDEX || 'uat_catalog_replica';

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

    header svg {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }

    header h1 {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
    }

    header p {
      font-size: 12px;
      color: #888;
      margin-top: 2px;
    }

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

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 16px;
    }

    #loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      gap: 16px;
      color: #666;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #2a2a3a;
      border-top-color: #e63946;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

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

    .card:hover {
      transform: translateY(-2px);
      border-color: #e63946;
    }

    .card-img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      background: #fff;
      padding: 12px;
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
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .card-sku {
      font-family: monospace;
      font-size: 11px;
      color: #e63946;
      font-weight: 600;
      text-transform: uppercase;
    }

    .card-title {
      font-size: 13px;
      color: #ccc;
      line-height: 1.4;
      flex: 1;
    }

    .card-price {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }

    .card-btn {
      margin: 0 12px 12px;
      background: #e63946;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      display: block;
      transition: background 0.15s;
    }

    .card-btn:hover { background: #c1121f; }

    .card-notfound {
      opacity: 0.4;
    }

    #error-msg {
      display: none;
      background: #2a1a1a;
      border: 1px solid #e63946;
      border-radius: 8px;
      padding: 16px;
      color: #e63946;
      font-size: 14px;
      margin-bottom: 20px;
    }

    footer {
      text-align: center;
      padding: 32px 16px;
      color: #444;
      font-size: 12px;
    }
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
  <div id="error-msg"></div>
  <p class="section-title">${entry.skus.length} products found</p>
  <div id="loading">
    <div class="spinner"></div>
    <span>Loading products...</span>
  </div>
  <div id="grid" style="display:none"></div>
</div>

<footer>jewelrytelevision.com &nbsp;&middot;&nbsp; Powered by JTV Code Forge</footer>

<script>
const SKUS = ${skusJson};
const ALGOLIA_APP_ID = '${algoliaAppId}';
const ALGOLIA_API_KEY = '${algoliaApiKey}';
const ALGOLIA_INDEX = '${algoliaIndex}';
const JTV_BASE = 'https://www.jtv.com/product';

async function fetchProduct(sku) {
  const url = \`https://\${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/\${ALGOLIA_INDEX}/\${sku}\`;
  try {
    const res = await fetch(url, {
      headers: {
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'X-Algolia-API-Key': ALGOLIA_API_KEY,
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getImageUrl(product) {
  try {
    const imgs = product.Media_Images;
    if (!imgs) return null;
    const keys = Object.keys(imgs);
    if (!keys.length) return null;
    const first = imgs[keys[0]];
    return first.url || first.Url || first.src || null;
  } catch {
    return null;
  }
}

function renderCard(sku, product) {
  const grid = document.getElementById('grid');
  const card = document.createElement('div');

  if (!product) {
    card.className = 'card card-notfound';
    card.innerHTML = \`
      <div class="card-img-placeholder">No image</div>
      <div class="card-body">
        <span class="card-sku">\${sku}</span>
        <span class="card-title">Product not found</span>
      </div>
    \`;
    grid.appendChild(card);
    return;
  }

  const imgUrl = getImageUrl(product);
  const title = product.Catalog_TitleDescription || sku;
  const price = product.Pricing_ActivePrice
    ? \`$\${parseFloat(product.Pricing_ActivePrice).toFixed(2)}\`
    : '';
  const productUrl = \`\${JTV_BASE}/\${sku}\`;

  card.className = 'card';
  card.innerHTML = \`
    \${imgUrl
      ? \`<img class="card-img" src="\${imgUrl}" alt="\${title}" loading="lazy" onerror="this.parentNode.querySelector('.card-img-placeholder') && this.remove(); this.style.display='none'"/>\`
      : \`<div class="card-img-placeholder">No image</div>\`
    }
    <div class="card-body">
      <span class="card-sku">\${sku}</span>
      <span class="card-title">\${title}</span>
      \${price ? \`<span class="card-price">\${price}</span>\` : ''}
    </div>
    <a class="card-btn" href="\${productUrl}" target="_blank">Shop Now &rarr;</a>
  \`;
  grid.appendChild(card);
}

async function main() {
  try {
    const results = await Promise.all(SKUS.map(sku => fetchProduct(sku)));
    document.getElementById('loading').style.display = 'none';
    document.getElementById('grid').style.display = 'grid';
    SKUS.forEach((sku, i) => renderCard(sku, results[i]));
  } catch (err) {
    document.getElementById('loading').style.display = 'none';
    const errEl = document.getElementById('error-msg');
    errEl.style.display = 'block';
    errEl.textContent = 'Failed to load products: ' + err.message;
  }
}

main();
</script>
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
