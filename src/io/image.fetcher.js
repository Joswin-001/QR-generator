const axios = require('axios/dist/node/axios.cjs');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://www.jtv.com/',
};

/**
 * Fetches the JTV product image for a given SKU as an ArrayBuffer.
 * Tries several common JTV CDN patterns.
 * 
 * @param {string} sku 
 * @returns {Promise<Buffer | null>} The image buffer, or null if not found.
 */
async function fetchProductImage(sku) {
    if (!sku) return null;
    const cleanSku = sku.toUpperCase().trim();

    // Patterns to try in order of likelihood
    const patterns = [
        `https://images.jtv.com/jewelry/JTV-${cleanSku}-1-medium.jpg`,
        `https://images.jtv.com/jewelry/${cleanSku}-1-medium.jpg`,
        `https://images.jtv.com/jewelry/JTV-${cleanSku}-1.jpg`,
        `https://images.jtv.com/jewelry/${cleanSku}-1.jpg`
    ];

    for (const url of patterns) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: HEADERS,
                timeout: 5000,
                // Do not throw on 404, we want to try the next pattern
                validateStatus: (status) => status === 200 || status === 404
            });

            if (res.status === 200) {
                console.log(`[image.fetcher] ✓ Found image for ${cleanSku} at ${url}`);
                return Buffer.from(res.data);
            }
        } catch (error) {
            console.warn(`[image.fetcher] ! Attempt failed for ${url}: ${error.message}`);
        }
    }

    console.warn(`[image.fetcher] ✗ No image found for ${cleanSku} after trying all patterns.`);
    return null;
}

module.exports = {
    fetchProductImage
};
