const express = require('express');
const router = express.Router();
const { toBuffer, toLabel } = require('../core/qr.generator');
const { resolve } = require('../core/sku.resolver');
const { fetchProductImage } = require('../io/image.fetcher');

router.post('/api/qr/single', async (req, res) => {
  const { sku, format } = req.body;

  if (!sku || typeof sku !== 'string') {
    return res.status(400).json({ error: 'sku (string) is required' });
  }

  try {
    const { url } = resolve(sku.trim());

    // Attempt to fetch product image for the label
    let imgBuffer = null;
    try {
      imgBuffer = await fetchProductImage(sku.trim());
    } catch (imgErr) {
      console.warn(`[single.route] Could not fetch image for ${sku}:`, imgErr.message);
    }

    // Generate the composite label
    const labelBuffer = await toLabel(url, sku.trim(), imgBuffer);
    const labelBase64 = `data:image/png;base64,${labelBuffer.toString('base64')}`;

    return res.json({
      sku: sku.trim(),
      url,
      format: 'png',
      data: labelBase64,
    });

  } catch (err) {
    console.error('[single.route] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
