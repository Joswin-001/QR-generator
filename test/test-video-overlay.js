/**
 * test-video-overlay.js
 * 
 * Self-contained integration test for the FFmpeg overlay pipeline.
 * Run from the jtv-qr-generator directory:
 *   node test/test-video-overlay.js
 *
 * What it does:
 *   1. Creates a temp batch folder
 *   2. Generates a synthetic 30-second test video (color bars) via FFmpeg
 *   3. Creates two mock PNG cards via FFmpeg (solid colored rectangles)
 *   4. Builds a mock Showtime JSON with 3 segments (2 SKUs, one appearing twice)
 *   5. Runs the full pre-check validation
 *   6. Runs the FFmpeg overlay pipeline
 *   7. Reports results and cleans up
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { parseShowtime } = require('../src/pipeline/showtime.parser');
const { runPreChecks } = require('../src/pipeline/video.precheck');
const { overlayCards } = require('../src/pipeline/video.overlay');

// ─── Config ────────────────────────────────────────────────────────────────
const TMP = path.join(__dirname, '..', 'tmp_overlay_test');
const CARDS_DIR = path.join(TMP, 'cards');
const OUTPUT_DIR = path.join(TMP, 'output');
const MASTER_PATH = path.join(TMP, 'master.mp4');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'final_with_cards.mp4');

const TEST_SKUS = ['JSK028', 'JLW13615'];

// Mock Showtime JSON (same structure as production)
const MOCK_SHOWTIME = {
    Filename: 'EP001.mp4.json',
    Presentations: [
        { Item: 'THUMB', OffsetIn: '0', OffsetOut: '2' },
        { Item: 'JSK028', OffsetIn: '3', OffsetOut: '10' },
        { Item: 'SCTE35', OffsetIn: '10', OffsetOut: '11' },
        { Item: 'JLW13615', OffsetIn: '12', OffsetOut: '20' },
        { Item: 'JSK028', OffsetIn: '22', OffsetOut: '28' }, // same SKU, second window
    ]
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function log(msg) { console.log(`\n✅ ${msg}`); }
function fail(msg) { console.error(`\n❌ FAIL: ${msg}`); process.exit(1); }

function ffmpegSync(...args) {
    const result = spawnSync('ffmpeg', ['-y', ...args], { encoding: 'utf-8' });
    if (result.status !== 0) {
        console.error(result.stderr?.slice(-1000));
        fail(`ffmpeg failed for command: ffmpeg ${args.join(' ')}`);
    }
}

// ─── Setup ──────────────────────────────────────────────────────────────────
function setup() {
    [TMP, CARDS_DIR, OUTPUT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

    // 1. Generate a synthetic 30s test video (color bars, 1280x720)
    console.log('\n🎬 Generating 30s synthetic test video (1280x720)...');
    ffmpegSync(
        '-f', 'lavfi', '-i', 'color=c=blue:size=1280x720:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
        '-t', '30',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-c:a', 'aac', '-b:a', '64k',
        MASTER_PATH
    );
    log(`Master video created: ${MASTER_PATH}`);

    // 2. Generate mock card PNGs (one per SKU)
    const cardColors = { JSK028: 'red', JLW13615: 'green' };
    for (const [sku, color] of Object.entries(cardColors)) {
        const cardPath = path.join(CARDS_DIR, `${sku}.png`);
        console.log(`\n🖼  Generating card PNG for ${sku} (${color} box)...`);
        ffmpegSync(
            '-f', 'lavfi', '-i', `color=c=${color}:size=400x600:rate=1`,
            '-frames:v', '1',
            cardPath
        );
        log(`Card created: ${cardPath}`);
    }
}

// ─── Main test ──────────────────────────────────────────────────────────────
async function runTest() {
    console.log('═'.repeat(60));
    console.log('  JTV Video Overlay — Integration Test');
    console.log('═'.repeat(60));

    // Step 1: Setup assets
    setup();

    // Step 2: Parse Showtime JSON
    console.log('\n📋 Step 1: Parsing Showtime JSON...');
    const showtimeRaw = JSON.stringify(MOCK_SHOWTIME);
    let parsed;
    try {
        parsed = parseShowtime(showtimeRaw);
    } catch (e) {
        fail(`parseShowtime threw: ${e.message}`);
    }
    console.log(`   batchId:     ${parsed.batchId}`);
    console.log(`   uniqueSkus:  ${parsed.uniqueSkus.join(', ')}`);
    console.log(`   segments:    ${parsed.segments.length} (THUMB + SCTE35 filtered out)`);

    if (parsed.segments.length !== 3) fail(`Expected 3 segments, got ${parsed.segments.length}`);
    if (parsed.uniqueSkus.length !== 2) fail(`Expected 2 unique SKUs, got ${parsed.uniqueSkus.length}`);
    log('Showtime JSON parsed correctly');

    // Step 3: Run pre-checks
    console.log('\n🔍 Step 2: Running pre-checks...');
    const { ok, errors } = await runPreChecks({
        masterPath: MASTER_PATH,
        cardsDir: CARDS_DIR,
        uniqueSkus: parsed.uniqueSkus,
        segments: parsed.segments,
    });
    if (!ok) {
        fail(`Pre-checks failed:\n  - ${errors.join('\n  - ')}`);
    }
    log('All pre-checks passed');

    // Step 4: Run FFmpeg overlay
    console.log('\n🎞  Step 3: Running FFmpeg overlay (this may take ~30s)...');
    const startTime = Date.now();

    try {
        await overlayCards({
            masterPath: MASTER_PATH,
            cardsDir: CARDS_DIR,
            outputPath: OUTPUT_PATH,
            segments: parsed.segments,
            cardHeightPct: 0.60,
            onProgress: ({ frame, fps }) => {
                process.stdout.write(`\r   Frame: ${frame || '?'}  FPS: ${fps || '?'}    `);
            },
        });
    } catch (e) {
        fail(`overlayCards threw: ${e.message}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const outputStat = fs.statSync(OUTPUT_PATH);
    const outputSizeMB = (outputStat.size / 1024 / 1024).toFixed(2);

    console.log(''); // newline after progress
    log(`Overlay complete in ${elapsed}s`);
    log(`Output: ${OUTPUT_PATH} (${outputSizeMB} MB)`);

    // Step 5: Verify output exists and has a reasonable size
    if (outputStat.size < 10000) fail('Output file is suspiciously small — something went wrong.');

    console.log('\n' + '═'.repeat(60));
    console.log('  ✅ ALL TESTS PASSED');
    console.log('  Open the output to visually verify card overlays:');
    console.log(`  ${OUTPUT_PATH}`);
    console.log('═'.repeat(60) + '\n');

    // Cleanup prompt
    console.log('Temp folder kept for inspection:', TMP);
    console.log('To clean up: Remove-Item -Recurse -Force "' + TMP + '"');
}

runTest().catch(e => {
    console.error('\n💥 Unhandled error:', e);
    process.exit(1);
});
