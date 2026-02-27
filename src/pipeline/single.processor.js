const skuResolver = require('../core/sku.resolver');
const algoliaClient = require('../core/algolia.client');
const qrGenerator = require('../core/qr.generator');
const fileWriter = require('../io/file.writer');
const constants = require('../config/constants');
const path = require('path');

/**
 * Validates and processes a single SKU.
 * 
 * @param {string} sku 
 * @param {object} opts { validate: boolean, logo: string | null, format: 'png'|'svg', outputDir: string, margin: number, width: number }
 * @returns {Promise<{ sku: string, url: string, status: string, file?: string, error?: string }>}
 */
async function processSingle(sku, opts) {
    try {
        const { url, styleNumber } = skuResolver.resolve(sku);

        if (opts.validate) {
            const { exists } = await algoliaClient.validateSku(sku);
            if (!exists) {
                return { sku, url, status: 'SKIPPED', error: 'SKU not found in Algolia' };
            }
        }

        let filePath;
        const filename = sku; // Or styleNumber, if preferred. Requirements indicate generating for the exact requested SKU name.

        if (opts.format === 'svg') {
            const svgString = await qrGenerator.toSvg(url, opts);
            filePath = await fileWriter.writeSvg(filename, svgString, opts.outputDir);
        } else {
            let buffer = await qrGenerator.toBuffer(url, opts);
            if (opts.logo) {
                buffer = await qrGenerator.withLogo(buffer, opts.logo);
            }
            filePath = await fileWriter.writePng(filename, buffer, opts.outputDir);
        }

        return { sku, url, status: 'SUCCESS', file: filePath };
    } catch (err) {
        return {
            sku,
            url: skuResolver.resolve(sku).url, // Try to provide the URL even if it failed midway
            status: 'ERROR',
            error: err.message
        };
    }
}

module.exports = {
    processSingle
};
