const fs = require('fs/promises');
const path = require('path');

/**
 * Writes a summary CSV file.
 * 
 * @param {Array<{sku: string, url: string, status: string, file: string, error?: string}>} results 
 * @param {string} outputDir 
 * @returns {Promise<string>} The absolute path to the saved file
 */
async function writeCsv(results, outputDir) {
    const filePath = path.join(outputDir, 'qr_summary.csv');

    const headers = ['SKU', 'URL', 'Status', 'File', 'Error'];
    const rows = results.map(r => [
        r.sku,
        r.url || '',
        r.status,
        r.file || '',
        r.error ? `"${r.error.replace(/"/g, '""')}"` : ''
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    await fs.writeFile(filePath, csvContent, 'utf8');
    return filePath;
}

/**
 * Writes a summary JSON file.
 * 
 * @param {Array<any>} results 
 * @param {string} outputDir 
 * @returns {Promise<string>} The absolute path to the saved file
 */
async function writeJson(results, outputDir) {
    const filePath = path.join(outputDir, 'qr_summary.json');
    await fs.writeFile(filePath, JSON.stringify(results, null, 2), 'utf8');
    return filePath;
}

module.exports = {
    writeCsv,
    writeJson
};
