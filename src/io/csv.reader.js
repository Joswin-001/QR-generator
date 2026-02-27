const fs = require('fs');
const { parse } = require('csv-parse');

/**
 * Reads a CSV file and extracts SKUs.
 * Handles single-column lists or header-aware parsing (looks for 'sku' or 'SKU').
 * 
 * @param {string} filePath 
 * @returns {Promise<string[]>} Array of SKUs
 */
async function readSkus(filePath) {
    return new Promise((resolve, reject) => {
        const skus = [];
        let isFirstRow = true;
        let skuColumnIndex = 0; // Default to first column

        fs.createReadStream(filePath)
            .pipe(parse({
                trim: true,
                skip_empty_lines: true
            }))
            .on('data', (row) => {
                if (isFirstRow) {
                    isFirstRow = false;
                    // Check if it's a header row
                    const headerIdx = row.findIndex(cell => cell.toLowerCase() === 'sku');
                    if (headerIdx !== -1) {
                        skuColumnIndex = headerIdx;
                        return; // Skip header row
                    }
                    // If no header found, process this row as data
                }

                const sku = row[skuColumnIndex];
                if (sku) {
                    skus.push(sku);
                }
            })
            .on('end', () => resolve(skus))
            .on('error', (err) => reject(new Error(`Failed to parse CSV: ${err.message}`)));
    });
}

module.exports = {
    readSkus
};
