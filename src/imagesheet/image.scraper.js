/**
 * image.scraper.js
 *
 * Fetches product images directly from the JTV CDN using the known URL pattern:
 *   https://images.jtv.com/jewelry/JTV-{SKU}-1-medium.jpg
 *
 * No HTML scraping needed — direct CDN hit per SKU.
 * Converts each image to base64 for the WAF bypass collection page.
 */

const axios = require('axios');
const pLimit = require('p-limit');

const CDN_BASE = 'https://images.jtv.com/jewelry/JTV-{sku}-1-medium.jpg';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://www.jtv.com/',
};

async function scrapeProductImage(sku) {
    const imageUrl = CDN_BASE.replace('{sku}', sku.toUpperCase());

    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: HEADERS,
        });

        if (response.status === 200) {
            const contentType = response.headers['content-type'] || 'image/jpeg';
            const base64 = Buffer.from(response.data).toString('base64');
            console.log(`[image.scraper] ✓ ${sku} (${Math.round(response.data.byteLength / 1024)}KB)`);
            return `data:${contentType};base64,${base64}`;
        }

        console.warn(`[image.scraper] ✗ ${sku} — status ${response.status}`);
        return null;

    } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
            console.warn(`[image.scraper] ✗ ${sku} — not found on CDN (404)`);
        } else {
            console.warn(`[image.scraper] ✗ ${sku} — ${err.message}`);
        }
        return null;
    }
}

async function scrapeProductImages(skus, concurrency = 5) {
    const limit = pLimit(concurrency);

    const results = await Promise.all(
        skus.map(sku => limit(() => scrapeProductImage(sku)))
    );

    const successCount = results.filter(Boolean).length;
    console.log(`[image.scraper] Done: ${successCount}/${skus.length} images fetched`);

    return results;
}

module.exports = {
    scrapeProductImage,
    scrapeProductImages,
};
