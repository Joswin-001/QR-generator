const constants = require('../config/constants');

/**
 * Fetches the JTV product image for a given SKU as an ArrayBuffer.
 * 
 * @param {string} sku 
 * @returns {Promise<Buffer | null>} The image buffer, or null if not found.
 */
async function fetchProductImage(sku) {
    if (!sku) return null;
    
    // JTV images generally follow this structure
    const imageUrl = `https://images.jtv.com/jewelry/JTV-${sku}-1-medium.jpg`;
    
    try {
        const res = await fetch(imageUrl, {
            headers: {
                // Mimic a standard browser to avoid basic blocks
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            // fast timeout
            signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        
        return null;
    } catch (error) {
        console.warn(`[Warning] Failed to fetch image for ${sku}: ${error.message}`);
        return null;
    }
}

module.exports = {
    fetchProductImage
};
