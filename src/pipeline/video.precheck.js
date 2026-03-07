'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * Validates all pre-conditions before the video pipeline can start.
 *
 * @param {Object} opts
 * @param {string}   opts.masterPath   - Absolute path to the master video file
 * @param {string}   opts.cardsDir     - Absolute path to the cards/ folder
 * @param {string[]} opts.uniqueSkus   - All unique SKUs required by the Showtime JSON
 * @param {import('./showtime.parser').SkuSegment[]} opts.segments - All timed segments
 * @returns {Promise<{ ok: boolean, errors: string[] }>}
 */
async function runPreChecks({ masterPath, cardsDir, uniqueSkus, segments }) {
    const errors = [];

    // 1. Master video must exist
    if (!fs.existsSync(masterPath)) {
        errors.push(`Master video not found: ${masterPath}`);
        return { ok: false, errors }; // Can't run ffprobe without it — stop early
    }

    // 2. Get master video duration via ffprobe
    let videoDuration = Infinity;
    try {
        const { stdout } = await execFileAsync('ffprobe', [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            masterPath,
        ]);
        videoDuration = parseFloat(stdout.trim());
        if (isNaN(videoDuration)) throw new Error('ffprobe returned a non-numeric duration.');
        console.log(`[pre-check] Master video duration: ${videoDuration.toFixed(2)}s`);
    } catch (e) {
        errors.push(`ffprobe failed to read master video — is ffmpeg installed? (${e.message})`);
    }

    // 3. Validate each segment's timing
    for (const seg of segments) {
        if (seg.in < 0) {
            errors.push(`SKU "${seg.sku}" has negative OffsetIn (${seg.in}).`);
        }
        if (seg.out <= seg.in) {
            errors.push(`SKU "${seg.sku}" has OffsetOut (${seg.out}) ≤ OffsetIn (${seg.in}).`);
        }
        if (seg.out > videoDuration) {
            errors.push(`SKU "${seg.sku}" OffsetOut (${seg.out}s) exceeds video duration (${videoDuration.toFixed(2)}s).`);
        }
    }

    // 4. Validate PNG card coverage
    for (const sku of uniqueSkus) {
        const cardPath = path.join(cardsDir, `${sku}.png`);
        if (!fs.existsSync(cardPath)) {
            errors.push(`Missing PNG card for SKU "${sku}": expected ${cardPath}`);
        }
    }

    return { ok: errors.length === 0, errors };
}

module.exports = { runPreChecks };
