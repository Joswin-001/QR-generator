const sharp = require('../sharp.helper')();

/**
 * Moogle imagesheets follow a strict 4-column grid.
 * 
 * Known measurements from PDF at 300 DPI (scale = 300/72 = 4.167):
 *   Column positions (x):
 *     Col 1: left=150,  width=554
 *     Col 2: left=725,  width=554
 *     Col 3: left=1300, width=554
 *     Col 4: left=1875, width=554
 *
 *   Row positions (y) — each row is 567px tall, starting at 575px:
 *     Row 1: top=575
 *     Row 2: top=1142  (575 + 567)
 *     Row 3: top=1709  (575 + 567*2)
 *     Row 4: top=2276  (575 + 567*3)  ← rare but possible
 */

const COLS = [
  { left: 150, width: 554 },
  { left: 725, width: 554 },
  { left: 1300, width: 554 },
  { left: 1875, width: 554 },
];

const ROW_START = 575;
const ROW_HEIGHT = 567;
const COLS_PER_ROW = 4;

/**
 * Build crop regions dynamically for any number of products.
 * Supports up to 4 rows (16 products).
 *
 * @param {number} count - Number of products to extract
 * @returns {{ left, top, width, height }[]}
 */
function buildRegions(count) {
  const regions = [];
  for (let i = 0; i < count; i++) {
    const col = i % COLS_PER_ROW;
    const row = Math.floor(i / COLS_PER_ROW);
    regions.push({
      left: COLS[col].left,
      top: ROW_START + row * ROW_HEIGHT,
      width: COLS[col].width,
      height: ROW_HEIGHT,
    });
  }
  return regions;
}

/**
 * Crops product images from a rendered page buffer.
 *
 * @param {Buffer} pageBuffer - Full page PNG at 300 DPI
 * @param {number} count      - Number of products to extract
 * @returns {Promise<string[]>} - Array of base64 PNG strings (null if crop fails)
 */
async function extractProductImages(pageBuffer, count) {
  const regions = buildRegions(count);

  // Get actual page dimensions to validate crops don't go out of bounds
  const metadata = await sharp(pageBuffer).metadata();
  const pageWidth = metadata.width || 2550;
  const pageHeight = metadata.height || 3300;

  const images = await Promise.all(
    regions.map(async (region, i) => {
      // Clamp region to page bounds
      const left = Math.max(0, region.left);
      const top = Math.max(0, region.top);
      const width = Math.min(region.width, pageWidth - left);
      const height = Math.min(region.height, pageHeight - top);

      if (width <= 0 || height <= 0) {
        console.warn(`[image.extractor] region ${i} out of bounds, skipping`);
        return null;
      }

      try {
        const cropped = await sharp(pageBuffer)
          .extract({ left, top, width, height })
          .resize(300, 300, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .png()
          .toBuffer();
        return cropped.toString('base64');
      } catch (e) {
        console.warn(`[image.extractor] crop ${i} failed:`, e.message);
        return null;
      }
    })
  );

  return images;
}

module.exports = { extractProductImages };
