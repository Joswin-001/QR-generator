const algoliasearch = require('algoliasearch');
const constants = require('../config/constants');
const pLimit = require('p-limit');

let client = null;
let index = null;

/**
 * Initializes the Algolia client using credentials from constants/env.
 */
function initClient() {
    if (!client) {
        if (!constants.ALGOLIA_APP_ID || !constants.ALGOLIA_API_KEY) {
            throw new Error('Algolia credentials are required for validation. Check your .env file.');
        }
        client = algoliasearch(constants.ALGOLIA_APP_ID, constants.ALGOLIA_API_KEY);
        index = client.initIndex(constants.ALGOLIA_INDEX);
    }
    return index;
}

/**
 * Validates a single SKU against Algolia.
 * 
 * @param {string} sku 
 * @returns {Promise<{ exists: boolean, product: any | null }>}
 */
async function validateSku(sku) {
    try {
        const idx = initClient();
        // Assuming SKU is the objectID in Algolia or searchable attribute
        const product = await idx.getObject(sku);
        return { exists: true, product };
    } catch (err) {
        // Algolia returns 404 if object doesn't exist
        if (err.status === 404) {
            return { exists: false, product: null };
        }
        throw err;
    }
}

/**
 * Batch validates an array of SKUs against Algolia.
 * 
 * @param {string[]} skus 
 * @param {number} concurrency 
 * @returns {Promise<Map<string, { exists: boolean, product: any | null }>>}
 */
async function batchValidate(skus, concurrency = 10) {
    const limit = pLimit(concurrency);
    const results = new Map();

    const promises = skus.map(sku =>
        limit(async () => {
            try {
                const result = await validateSku(sku);
                results.set(sku, result);
            } catch (err) {
                results.set(sku, { exists: false, product: null, error: err.message });
            }
        })
    );

    await Promise.all(promises);
    return results;
}

module.exports = {
    validateSku,
    batchValidate
};
