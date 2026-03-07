'use strict';

const EXCLUDED_ITEMS = new Set(['SCTE35', 'THUMB']);

/**
 * @typedef {Object} SkuSegment
 * @property {string} sku   - The SKU (Item field from JSON)
 * @property {number} in    - OffsetIn in seconds
 * @property {number} out   - OffsetOut in seconds
 */

/**
 * Parses a Showtime JSON buffer/string and returns:
 *  - batchId   : derived from the Filename field
 *  - segments  : all timed SKU segments (THUMB + SCTE35 excluded), incl. duplicates
 *  - uniqueSkus: deduplicated list of SKUs needed (for card validation)
 *
 * @param {Buffer|string} raw - The raw JSON file content
 * @returns {{ batchId: string, segments: SkuSegment[], uniqueSkus: string[] }}
 */
function parseShowtime(raw) {
    let parsed;
    try {
        parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
    } catch (e) {
        throw new Error('Invalid Showtime JSON — could not parse: ' + e.message);
    }

    const presentations = parsed?.Presentations;
    if (!Array.isArray(presentations) || presentations.length === 0) {
        throw new Error('No "Presentations" array found in Showtime JSON.');
    }

    const segments = [];
    const seen = new Set();

    for (const entry of presentations) {
        const sku = entry?.Item?.trim();
        if (!sku || EXCLUDED_ITEMS.has(sku)) continue;

        const offsetIn = parseFloat(entry.OffsetIn);
        const offsetOut = parseFloat(entry.OffsetOut);

        if (isNaN(offsetIn) || isNaN(offsetOut)) {
            throw new Error(`SKU "${sku}" has invalid OffsetIn/OffsetOut values.`);
        }

        segments.push({ sku, in: offsetIn, out: offsetOut });
        seen.add(sku);
    }

    if (segments.length === 0) {
        throw new Error('No valid SKU segments found in Showtime JSON after filtering THUMB/SCTE35.');
    }

    // Derive batchId from the Filename field in the JSON (or fall back to a timestamp)
    const rawFilename = parsed?.Filename || '';
    const batchId = rawFilename
        .replace(/\.mp4\.json$/i, '')
        .replace(/\.mp4$/i, '')
        .replace(/\.json$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        || `BATCH_${Date.now()}`;

    return {
        batchId,
        segments,
        uniqueSkus: [...seen],
    };
}

module.exports = { parseShowtime };
