const constants = require('../config/constants');

/**
 * Extracts the core style number from a given SKU.
 * E.g., ZDG004-8 -> ZDG004
 * E.g., ZDG004-8A -> ZDG004-8A (preserves non-numeric suffix)
 *
 * @param {string} sku
 * @returns {string} The core style number
 */
function extractStyleNumber(sku) {
  if (!sku) return '';
  sku = sku.trim();
  // Strip suffix like '-8', '-10', but keep '-8A'
  const match = sku.match(/^(.*?)(-\d+)$/);
  if (match) {
    return match[1];
  }
  return sku;
}

/**
 * Resolves a SKU into a JTV product URL.
 *
 * @param {string} sku
 * @returns {{ styleNumber: string, url: string, originalSku: string }}
 */
function resolve(sku) {
  const cleanSku = (sku || '').trim();
  const styleNumber = extractStyleNumber(cleanSku);
  const url = `${constants.JTV_PRODUCT_BASE_URL}/${styleNumber}`;
  
  return {
    styleNumber,
    url,
    originalSku: cleanSku
  };
}

module.exports = {
  extractStyleNumber,
  resolve
};
