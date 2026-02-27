const express = require('express');
const router = express.Router();
const batchStore = require('../store/batch.store');
const { buildCollectionUrl } = require('../imagesheet/collection.url.builder');

// Register a batch manually
router.post('/api/redirect/register', (req, res) => {
  const { batchId, skus } = req.body;

  if (!batchId || !Array.isArray(skus) || skus.length === 0) {
    return res.status(400).json({
      error: 'batchId (string) and skus (non-empty array) are required',
    });
  }

  const cleanBatchId = batchId.trim().toUpperCase();
  const cleanSkus = skus.map(s => s.trim().toUpperCase()).filter(Boolean);

  batchStore.save(cleanBatchId, cleanSkus);

  const proxyBaseUrl = process.env.PROXY_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const redirectUrl = `${proxyBaseUrl}/r/${cleanBatchId}`;
  const collectionUrl = buildCollectionUrl(cleanSkus);

  return res.status(201).json({
    batchId: cleanBatchId,
    skus: cleanSkus,
    redirectUrl,
    collectionUrl,
  });
});

// QR scan lands here → 302 to jtv.com
router.get('/r/:batchId', (req, res) => {
  const batchId = req.params.batchId.trim().toUpperCase();
  const entry = batchStore.get(batchId);

  if (!entry) {
    return res.redirect(302, 'https://www.jtv.com');
  }

  const destination = buildCollectionUrl(entry.skus);

  res.set({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  });

  console.log(`[redirect] batchId=${batchId} skus=${entry.skus.length} ua=${req.headers['user-agent']?.substring(0, 60)}`);

  return res.redirect(302, destination);
});

// Debug: list all batches (dev only)
router.get('/api/redirect/batches', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  return res.json(batchStore.list());
});

module.exports = router;
