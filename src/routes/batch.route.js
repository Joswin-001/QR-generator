const express = require('express');
const router = express.Router();
const multer = require('multer');
const { scrapeProductImages } = require('../imagesheet/image.scraper');
const { buildCollectionUrl } = require('../imagesheet/collection.url.builder');
const { toBuffer: generateQRBuffer } = require('../core/qr.generator');
const batchStore = require('../store/batch.store');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/json' && !file.originalname.endsWith('.json')) {
      return cb(new Error('Only JSON files are accepted'));
    }
    cb(null, true);
  },
});

const EXCLUDED_ITEMS = new Set(['SCTE35', 'THUMB']);

router.post('/api/qr/batch', upload.single('imagesheet'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No JSON file uploaded' });
  }

  try {
    // Step 1 — Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch (e) {
      return res.status(422).json({ error: 'Invalid JSON file — could not parse.' });
    }

    const presentations = parsed?.Presentations;
    if (!Array.isArray(presentations) || presentations.length === 0) {
      return res.status(422).json({ error: 'No Presentations array found in JSON.' });
    }

    // Step 2 — Filter out SCTE35, THUMB and deduplicate
    const seen = new Set();
    const skus = [];
    for (const entry of presentations) {
      const item = entry?.Item?.trim();
      if (!item || EXCLUDED_ITEMS.has(item)) continue;
      if (!seen.has(item)) {
        seen.add(item);
        skus.push(item);
      }
    }

    if (skus.length === 0) {
      return res.status(422).json({ error: 'No valid SKUs found in this JSON after filtering.' });
    }

    // Step 3 — Derive batch ID from Filename
    const rawFilename = parsed?.Filename || req.file.originalname || '';
    const batchId = rawFilename
      .replace(/\.mp4\.json$/i, '')
      .replace(/\.mp4$/i, '')
      .replace(/\.json$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      || `BATCH${Date.now()}`;

    // Step 4 — Fetch images from JTV CDN
    console.log(`[batch.route] Fetching images for ${skus.length} SKUs...`);
    const images = await scrapeProductImages(skus, 5);

    // Step 5 — Save to store
    batchStore.save(batchId, skus, images);

    // Step 6 — Generate QR pointing to Railway proxy
    const proxyBaseUrl = process.env.PROXY_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const proxyRedirectUrl = `${proxyBaseUrl}/r/${batchId}`;
    const qrBuffer = await generateQRBuffer(proxyRedirectUrl);

    const collectionUrl = buildCollectionUrl(skus);

    return res.status(200).json({
      batchId,
      skus,
      proxyRedirectUrl,
      collectionUrl,
      qrCode: `data:image/png;base64,${qrBuffer.toString('base64')}`,
      sourceFile: rawFilename,
    });

  } catch (err) {
    console.error('[batch.route] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
