'use strict';

const fs = require('fs');
const path = require('path');
const { parseShowtime } = require('./showtime.parser');
const { runPreChecks } = require('./video.precheck');
const { overlayCards } = require('./video.overlay');

async function runVideoOverlay({ cardsDir, showtimeRaw, masterPath }) {

    const outputDir = path.dirname(masterPath);
    const baseName = path.parse(masterPath).name;
    const statusFile = path.join(outputDir, `.${baseName}_status.json`);

    const writeStatus = (status) => {
        fs.writeFileSync(statusFile, JSON.stringify(status, null, 2), 'utf-8');
    };

    // ── 1. Parse Showtime JSON ────────────────────────────────────────────────
    let batchId, segments, uniqueSkus;
    try {
        ({ batchId, segments, uniqueSkus } = parseShowtime(showtimeRaw));
    } catch (e) {
        writeStatus({ stage: 'error', error: e.message });
        throw e;
    }

    writeStatus({
        batchId,
        stage: 'precheck',
        uniqueSkus: uniqueSkus.length,
        segmentCount: segments.length,
    });

    // ── 2. Pre-check validation ───────────────────────────────────────────────
    const { ok, errors } = await runPreChecks({ masterPath, cardsDir, uniqueSkus, segments });
    if (!ok) {
        writeStatus({ batchId, stage: 'error', error: errors.join(' | '), errors });
        return { batchId, status: 'PRECHECK_FAILED', errors };
    }

    writeStatus({
        batchId,
        stage: 'overlay',
        uniqueSkus: uniqueSkus.length,
        appearanceCount: segments.length,
        frame: 0,
        totalFrames: null,
        fps: null,
        startedAt: new Date().toISOString(),
    });

    // ── 3. Get total frames via ffprobe for accurate progress % ──────────────
    let totalFrames = null;
    try {
        const { execSync } = require('child_process');
        // ffprobe to get duration in seconds, then multiply by fps
        const probeOut = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames,r_frame_rate,duration -of json "${masterPath}"`,
            { encoding: 'utf-8', timeout: 15000 }
        );
        const probe = JSON.parse(probeOut);
        const stream = probe?.streams?.[0];

        if (stream?.nb_frames && parseInt(stream.nb_frames) > 0) {
            // Some containers store nb_frames directly
            totalFrames = parseInt(stream.nb_frames);
        } else if (stream?.duration && stream?.r_frame_rate) {
            // Calculate from duration × fps
            const [num, den] = stream.r_frame_rate.split('/').map(Number);
            const fps = num / den;
            totalFrames = Math.round(parseFloat(stream.duration) * fps);
        }

        if (totalFrames) {
            writeStatus({
                batchId,
                stage: 'overlay',
                uniqueSkus: uniqueSkus.length,
                appearanceCount: segments.length,
                frame: 0,
                totalFrames,
                fps: null,
                startedAt: new Date().toISOString(),
            });
        }
    } catch (e) {
        console.warn('[video.processor] Could not determine totalFrames via ffprobe:', e.message);
    }

    // ── 4. Run FFmpeg overlay ─────────────────────────────────────────────────
    const outputPath = path.join(outputDir, `${baseName}_with_cards.mp4`);

    try {
        await overlayCards({
            masterPath,
            cardsDir,
            outputPath,
            segments,
            cardHeightPct: parseFloat(process.env.CARD_HEIGHT_PCT || '0.55'),
            onProgress: ({ frame, fps }) => {
                writeStatus({
                    batchId,
                    stage: 'overlay',
                    uniqueSkus: uniqueSkus.length,
                    appearanceCount: segments.length,
                    frame,
                    totalFrames,   // ← now included so UI can show %
                    fps,
                    updatedAt: new Date().toISOString(),
                });
            },
        });
    } catch (e) {
        writeStatus({ batchId, stage: 'error', error: e.message });
        throw e;
    }

    // ── 5. Write final done status ────────────────────────────────────────────
    writeStatus({
        batchId,
        stage: 'done',          // ← lowercase 'done' matches what UI polls for
        uniqueSkus: uniqueSkus.length,
        appearanceCount: segments.length,
        outputPath,
        completedAt: new Date().toISOString(),
    });

    return { batchId, outputPath, status: 'DONE' };
}

module.exports = { runVideoOverlay };
