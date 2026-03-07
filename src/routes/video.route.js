'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { runVideoOverlay } = require('../pipeline/video.processor');
const { parseShowtime } = require('../pipeline/showtime.parser');
const { runPreChecks } = require('../pipeline/video.precheck');

const router = express.Router();

/**
 * We accept two files via multipart/form-data:
 *   showtime   → the Showtime JSON file
 *   (optional) master → if you want to upload the master video through the API
 *
 * For 25 GB master videos, it's strongly recommended NOT to upload through the API.
 * Instead, drop the master into the batch's input/ folder and provide
 * the `masterPath` body field pointing to it on disk.
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — for the JSON only
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'showtime' && !file.originalname.match(/\.(json)$/i)) {
            return cb(new Error('showtime field must be a .json file'));
        }
        cb(null, true);
    },
});

/**
 * POST /api/video/overlay
 *
 * Body (multipart/form-data):
 *   showtime  (file)     – Showtime JSON
 *   batchRoot (string)   – Absolute path to the batch folder on the server
 *   masterPath (string)  – Absolute path to the master video file on the server
 *
 * The endpoint fires off the job and returns immediately so the HTTP connection
 * doesn't time out waiting for a 25 GB encode. Poll /api/video/status?masterPath=...
 * for ongoing progress.
 */
router.post('/api/video/overlay', upload.single('showtime'), (req, res) => {
    let showtimeBuffer;
    if (req.file) {
        showtimeBuffer = req.file.buffer;
    } else if (req.body.showtimePath) {
        try {
            showtimeBuffer = fs.readFileSync(req.body.showtimePath);
        } catch (e) {
            return res.status(400).json({ error: 'Could not read showtime JSON from path: ' + e.message });
        }
    } else {
        return res.status(400).json({ error: 'Missing "showtime" file upload or "showtimePath".' });
    }

    const { cardsDir, masterPath } = req.body;

    if (!cardsDir || !masterPath) {
        return res.status(400).json({ error: '"cardsDir" and "masterPath" body fields are required.' });
    }

    if (!path.isAbsolute(cardsDir) || !path.isAbsolute(masterPath)) {
        return res.status(400).json({ error: '"cardsDir" and "masterPath" must be absolute paths.' });
    }

    // Fire and forget — we return 202 Accepted immediately
    res.status(202).json({
        message: 'Video overlay job accepted. Poll /api/video/status for progress.',
        masterPath,
        statusUrl: `/api/video/status?masterPath=${encodeURIComponent(masterPath)}`,
    });

    // Run in background (unhandled rejection is logged but won't crash Express)
    runVideoOverlay({
        cardsDir,
        showtimeRaw: showtimeBuffer,
        masterPath,

    }).catch((err) => {
        console.error('[video.route] Overlay job failed:', err.message);
    });
});

/**
 * GET /api/video/status?masterPath=<absolute-path>
 *
 * Returns the contents of status.json written by the processor,
 * giving the current stage, frame count, fps, and errors if any.
 */
router.get('/api/video/status', (req, res) => {
    const { masterPath } = req.query;

    if (!masterPath) {
        return res.status(400).json({ error: '"masterPath" query param is required.' });
    }

    const statusFile = path.join(path.dirname(masterPath), `.${path.parse(masterPath).name}_status.json`);

    if (!fs.existsSync(statusFile)) {
        return res.status(404).json({ error: 'No status file found. Has the job started?' });
    }

    try {
        const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
        return res.json(status);
    } catch (e) {
        return res.status(500).json({ error: 'Could not read status.json: ' + e.message });
    }
});

/**
 * POST /api/video/precheck
 *
 * Runs only the pre-check step (no FFmpeg). Useful for validating a batch
 * before starting a long encode.
 *
 * Body (multipart/form-data):
 *   showtime   (file)   – Showtime JSON
 *   cardsDir   (string) – Absolute path to the cards folder containing pngs
 *   masterPath (string) – Absolute path to the master video
 */
router.post('/api/video/precheck', upload.single('showtime'), async (req, res) => {
    let showtimeBuffer;
    if (req.file) {
        showtimeBuffer = req.file.buffer;
    } else if (req.body.showtimePath) {
        try {
            showtimeBuffer = fs.readFileSync(req.body.showtimePath);
        } catch (e) {
            return res.status(400).json({ error: 'Could not read showtime JSON from path: ' + e.message });
        }
    } else {
        return res.status(400).json({ error: 'Missing "showtime" file upload or "showtimePath".' });
    }

    const { cardsDir, masterPath } = req.body;
    if (!cardsDir || !masterPath) {
        return res.status(400).json({ error: '"cardsDir" and "masterPath" are required.' });
    }

    try {
        const { batchId, segments, uniqueSkus } = parseShowtime(showtimeBuffer);
        const { ok, errors } = await runPreChecks({ masterPath, cardsDir, uniqueSkus, segments });

        return res.status(ok ? 200 : 422).json({ batchId, ok, errors, uniqueSkus, segmentCount: segments.length });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

module.exports = router;
