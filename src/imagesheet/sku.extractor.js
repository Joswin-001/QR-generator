/**
 * Extracts SKUs from raw OCR text with specialized filtering and normalization.
 * 
 * @param {string} rawOcrText - The raw string block from Tesseract
 * @returns {object} - { skus: string[], episodeCode: string | null }
 */
function extractSkus(rawOcrText) {
    const lines = rawOcrText.split('\n');
    const skus = new Set();
    let episodeCode = null;

    // 1. Noise line filtering (lowercase for comparison)
    const noiseWords = [
        'moogle', 'search', 'dashboard', 'shows', 'video', 'apps', 'jewelrytelevision',
        'show image sheet', 'schedule', 'jtv2 schedule', 'archive', 'products',
        'image sheet', 'rewind', 'studio view', 'live reserve view', 'episode',
        'list of products', 'get batch', 'confidential', 'proprietary',
        'moogle.jewelry', 'aspx', '1/1'
    ];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        const lowerLine = line.toLowerCase();
        
        // Skip noise lines entirely
        const isNoise = noiseWords.some(word => lowerLine.includes(word));
        if (isNoise) {
            // Check if "get batch" is in the line to extract the episode code
            if (lowerLine.includes('get batch')) {
                // Often looks like "GET BATCH NPT7Z"
                const match = line.match(/batch\s+([A-Z0-9]+)/i);
                if (match && match[1]) {
                    episodeCode = match[1];
                }
            }
            continue;
        }

        // 2. Token Extraction Regex for SKUs
        // Must start with Letter or number, followed by 4-14 alphanumeric chars.
        const skuRegex = /\b([A-Z][A-Z0-9]{4,14}|[0-9][A-Z0-9]{4,14})\b/g;
        let match;

        while ((match = skuRegex.exec(line)) !== null) {
            let token = match[1];

            // 3. Validity Gate: Token must contain AT LEAST one letter AND one digit
            const hasLetter = /[A-Z]/.test(token);
            const hasDigit = /[0-9]/.test(token);
            
            if (hasLetter && hasDigit) {
                // 4. OCR Normalization: O vs 0
                // JTV SKUs sometimes get O misread as 0 or vice versa if surrounded by digits
                // "After a letter, O followed by a digit -> 0"
                token = token.replace(/(?<=[A-Z])O(?=[0-9])/g, '0');
                // "After a digit, O followed by a digit -> 0"
                token = token.replace(/(?<=[0-9])O(?=[0-9])/g, '0');

                // 5. Deduplication using Set
                skus.add(token);
            }
        }
    }

    // Preserve first-occurrence order as an Array
    return {
        skus: Array.from(skus),
        episodeCode
    };
}

module.exports = {
    extractSkus
};
