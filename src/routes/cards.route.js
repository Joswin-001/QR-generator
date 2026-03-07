'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs');
const { parseShowtime } = require('../pipeline/showtime.parser');
const { generateCards } = require('../pipeline/card.generator');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.json$/i)) {
            return cb(new Error('Only JSON files accepted'));
        }
        cb(null, true);
    },
});

router.post('/api/video/cards', upload.single('showtime'), async (req, res) => {
    let showtimeBuffer;
    try {
        if (req.file) {
            showtimeBuffer = req.file.buffer;
        } else if (req.body.showtimePath) {
            showtimeBuffer = fs.readFileSync(req.body.showtimePath);
        } else {
            return res.status(400).json({ error: 'Missing "showtime" file upload or "showtimePath".' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Could not read JSON file from given path: ' + e.message });
    }

    try {
        const { batchId, uniqueSkus } = parseShowtime(showtimeBuffer);

        if (!uniqueSkus || uniqueSkus.length === 0) {
            return res.status(422).json({ error: 'No valid SKUs found in JSON.' });
        }

        console.log(`[cards.route] Generating ${uniqueSkus.length} cards for batch: ${batchId}`);

        const cards = await generateCards(uniqueSkus, 4);

        if (cards.size === 0) {
            return res.status(500).json({ error: 'Could not generate any cards. CDN may be unreachable.' });
        }

        const zipFilename = `${batchId || 'cards'}_cards.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

        const archive = archiver('zip', { zlib: { level: 6 } });

        archive.on('error', (err) => {
            console.error('[cards.route] Archiver error:', err);
            res.destroy();
        });

        archive.pipe(res);

        for (const [sku, buffer] of cards) {
            archive.append(buffer, { name: `${sku}.png` });
        }

        await archive.finalize();

        console.log(`[cards.route] ✓ ZIP sent: ${cards.size} cards for ${batchId}`);

    } catch (err) {
        console.error('[cards.route] Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;
