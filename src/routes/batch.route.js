const express = require('express');
const router = express.Router();
const multer = require('multer');
const { renderPages } = require('../imagesheet/pdf.renderer');
const { extractText } = require('../imagesheet/ocr.engine');
const { extractSkus } = require('../imagesheet/sku.extractor');
const { extractProductImages } = require('../imagesheet/image.extractor');
const { buildCollectionUrl } = require('../imagesheet/collection.url.builder');
const { toBuffer: generateQRBuffer } = require('../core/qr.generator');
const batchStore = require('../store/batch.store');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are accepted'));
    }
    cb(null, true);
  },
});

router.post('/api/qr/batch', upload.single('imagesheet'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  try {
    // Step 1 — Render PDF pages to images
    const pageBuffers = await renderPages(req.file.buffer, { dpi: 300 });

    // Step 2 — OCR each page
    const allText = [];
    for (const pageBuffer of pageBuffers) {
      const text = await extractText(pageBuffer);
      allText.push(text);
    }
    const fullText = allText.join('\n');

    // Step 3 — Extract SKUs
    const extraction = extractSkus(fullText);
    const skus = extraction.skus;
    if (skus.length === 0) {
      return res.status(422).json({ error: 'No SKUs could be extracted from this PDF.' });
    }

    // Step 4 — Extract product images from PDF grid (page 1)
    const images = await extractProductImages(pageBuffers[0], skus.length);

    // Step 5 — Extract batch ID
    const batchId = extraction.episodeCode || `BATCH${Date.now()}`;

    // Step 6 — Register batch with images
    batchStore.save(batchId, skus, images);

    // Step 7 — Build proxy QR URL
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
      pageCount: pageBuffers.length,
    });

  } catch (err) {
    console.error('[batch.route] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
