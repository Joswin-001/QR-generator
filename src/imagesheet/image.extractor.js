const sharp = require('sharp');

/**
 * The Moogle imagesheet is always a 4-column grid.
 * These crop regions are derived from the PDF block bboxes at 300 DPI (scale = 300/72 = 4.167)
 *
 * PDF points → pixels at 300 DPI:
 *   Row 1 images: y=138–238pt → y=575–992px
 *   Row 2 images: y=274–374pt → y=1142–1559px
 *   Col 1: x=36–169pt   → x=150–704px
 *   Col 2: x=174–307pt  → x=725–1279px
 *   Col 3: x=312–445pt  → x=1300–1854px
 *   Col 4: x=450–582pt  → x=1875–2425px
 */
const GRID_REGIONS = [
  // Row 1
  { left: 150,  top: 575,  width: 554, height: 417 },
  { left: 725,  top: 575,  width: 554, height: 417 },
  { left: 1300, top: 575,  width: 554, height: 417 },
  { left: 1875, top: 575,  width: 554, height: 417 },
  // Row 2
  { left: 150,  top: 1142, width: 554, height: 417 },
  { left: 725,  top: 1142, width: 554, height: 417 },
  { left: 1300, top: 1142, width: 554, height: 417 },
  { left: 1875, top: 1142, width: 554, height: 417 },
];

/**
 * Crops product images from a rendered page buffer.
 * Returns base64 PNG strings, one per grid cell.
 *
 * @param {Buffer} pageBuffer - Full page PNG at 300 DPI (2550x3300)
 * @param {number} count      - How many products to extract (max 8)
 * @returns {Promise<string[]>} - Array of base64 PNG strings
 */
async function extractProductImages(pageBuffer, count = 8) {
  const regions = GRID_REGIONS.slice(0, count);

  const images = await Promise.all(
    regions.map(async (region) => {
      try {
        const cropped = await sharp(pageBuffer)
          .extract(region)
          .resize(300, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer();
        return cropped.toString('base64');
      } catch (e) {
        console.warn('[image.extractor] crop failed:', e.message);
        return null;
      }
    })
  );

  return images;
}

module.exports = { extractProductImages };
