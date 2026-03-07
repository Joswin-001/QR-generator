'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

router.post('/api/video/captions', express.json(), (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const { inputVideo, modelSize = 'base' } = req.body;

    if (!inputVideo) {
        send('error', { message: 'inputVideo is required.' });
        return res.end();
    }

    const inputPath = inputVideo;
    const outputDir = path.dirname(inputPath);
    const baseName = path.parse(inputPath).name;
    const outputPath = path.join(outputDir, `${baseName}_captions.srt`);

    if (!fs.existsSync(inputPath)) {
        send('error', { message: `Input not found: ${inputPath}` });
        return res.end();
    }

    // ── Resolve transcribe executable ─────────────────────────────
    const bundledBin = process.env.TRANSCRIBE_BIN;
    const localBin = path.join(__dirname, '..', 'pipeline', 'transcribe_bin',
        process.platform === 'win32' ? 'transcribe.exe' : 'transcribe');
    const scriptPath = path.join(__dirname, '..', 'pipeline', 'transcribe.py');

    let command, args;

    if (bundledBin && fs.existsSync(bundledBin)) {
        command = bundledBin;
        args = [inputPath, outputPath, modelSize];
        console.log(`[captions] Using bundled binary: ${bundledBin}`);
    } else if (fs.existsSync(localBin)) {
        command = localBin;
        args = [inputPath, outputPath, modelSize];
        console.log(`[captions] Using local binary: ${localBin}`);
    } else if (fs.existsSync(scriptPath)) {
        command = process.platform === 'win32' ? 'python' : 'python3';
        args = [scriptPath, inputPath, outputPath, modelSize];
        console.log(`[captions] Using Python script: ${scriptPath}`);
    } else {
        send('error', { message: 'Transcribe binary not found. Please reinstall the app.' });
        return res.end();
    }

    send('status', { message: `Starting transcription — model: ${modelSize}` });

    const proc = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuf = '';

    proc.stdout.on('data', (chunk) => {
        stdoutBuf += chunk.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop();

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line);
                if (parsed.error) {
                    send('error', { message: parsed.error });
                } else if (parsed.done) {
                    send('done', { message: parsed.message, outputPath: parsed.outputPath });
                } else if (parsed.status) {
                    send('progress', {
                        message: parsed.status,
                        percent: parsed.percent || null,
                        currentTime: parsed.currentTime || null,
                        duration: parsed.duration || null,
                    });
                }
            } catch (_) { }
        }
    });

    proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.toLowerCase().includes('error')) {
            console.error('[captions] stderr:', text.trim());
        }
    });

    proc.on('close', (code) => {
        if (code !== 0) send('error', { message: `Transcription exited with code ${code}` });
        res.end();
    });

    proc.on('error', (err) => {
        send('error', { message: `Failed to start transcription: ${err.message}` });
        res.end();
    });
});

module.exports = router;
