'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function getVideoHeight(filePath) {
    const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=height',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
    ]);
    const h = parseInt(stdout.trim(), 10);
    if (isNaN(h) || h <= 0) throw new Error(`Could not read video height from: ${filePath}`);
    return h;
}

async function overlayCards({ masterPath, cardsDir, outputPath, segments, cardHeightPct = 0.09, onProgress }) {

    // ── 0. Resolve video height ───────────────────────────────────────────────
    const videoHeight = await getVideoHeight(masterPath);
    const cardPixelHeight = Math.round(videoHeight * cardHeightPct / 2) * 2;
    console.log(`[overlay] Video height: ${videoHeight}px → Card height: ${cardPixelHeight}px (${(cardHeightPct * 100).toFixed(0)}%)`);

    // ── 1. Deduplicate card inputs ────────────────────────────────────────────
    const skuToInputIndex = new Map();
    const cardInputs = [];

    for (const seg of segments) {
        if (!skuToInputIndex.has(seg.sku)) {
            const idx = 1 + cardInputs.length;
            skuToInputIndex.set(seg.sku, idx);
            cardInputs.push(seg.sku);
        }
    }

    // ── 2. Build -i arguments ─────────────────────────────────────────────────
    const inputArgs = ['-i', masterPath];
    for (const sku of cardInputs) {
        inputArgs.push('-i', path.join(cardsDir, `${sku}.png`));
    }

    // ── 3. Build filter_complex ───────────────────────────────────────────────
    const filterLines = [];
    let currentBase = '[0:v]';

    // Pre-scale each unique card
    for (const sku of cardInputs) {
        const idx = skuToInputIndex.get(sku);
        const tag = `[card_${sku.replace(/[^a-zA-Z0-9]/g, '_')}]`;
        filterLines.push(`[${idx}:v]scale=-2:${cardPixelHeight}${tag}`);
    }

    // Chain overlay operations — MIDDLE-RIGHT position
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const cardTag = `[card_${seg.sku.replace(/[^a-zA-Z0-9]/g, '_')}]`;
        const outTag = i < segments.length - 1 ? `[v${i}]` : '[vout]';
        const enableExpr = `between(t,${seg.in},${seg.out})`;

        filterLines.push(
            `${currentBase}${cardTag}overlay=x='W-w-20':y='(H-h)/2':enable='${enableExpr}'${outTag}`
        );
        currentBase = outTag;
    }

    const filterComplex = filterLines.join('; ');

    // ── 4. Encoder selection ──────────────────────────────────────────────────
    const encoder = process.env.FFMPEG_ENCODER || 'libx264';
    const encoderArgs = encoder === 'libx264'
        ? ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23']
        : ['-c:v', encoder];

    // ── 5. Assemble FFmpeg args ───────────────────────────────────────────────
    const args = [
        '-y',
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[vout]',
        '-map', '0:a?',
        '-c:a', 'copy',
        ...encoderArgs,
        '-movflags', '+faststart',
        outputPath,
    ];

    // ── 6. Spawn FFmpeg ───────────────────────────────────────────────────────
    return new Promise((resolve, reject) => {
        console.log(`[overlay] Starting FFmpeg encode → ${outputPath}`);
        console.log(`[overlay] Encoder: ${encoder}`);
        console.log(`[overlay] Segments: ${segments.length}, Unique cards: ${cardInputs.length}`);

        const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderrBuf = '';

        ff.stderr.on('data', (chunk) => {
            const text = chunk.toString();
            stderrBuf += text;
            if (onProgress) {
                const frameMatch = text.match(/frame=\s*(\d+)/);
                const fpsMatch = text.match(/fps=\s*([\d.]+)/);
                if (frameMatch) {
                    onProgress({
                        frame: parseInt(frameMatch[1], 10),
                        fps: fpsMatch ? parseFloat(fpsMatch[1]) : null,
                    });
                }
            }
        });

        ff.on('close', (code) => {
            if (code === 0) {
                console.log(`[overlay] ✅ Done: ${outputPath}`);
                resolve();
            } else {
                const tail = stderrBuf.slice(-2000);
                reject(new Error(`FFmpeg exited with code ${code}.\n--- stderr tail ---\n${tail}`));
            }
        });

        ff.on('error', (err) => {
            reject(new Error(`Failed to spawn FFmpeg: ${err.message}. Is ffmpeg installed and on PATH?`));
        });
    });
}

module.exports = { overlayCards };
