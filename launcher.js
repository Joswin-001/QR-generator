'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');

// ── Resolve paths relative to the PKG executable ──────────────
const isPackaged = typeof process.pkg !== 'undefined';

const baseDir = isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..');

// FFmpeg bundled next to the exe
if (isPackaged) {
    process.env.FFMPEG_PATH = path.join(baseDir, 'bin', 'ffmpeg.exe');
    process.env.FFPROBE_PATH = path.join(baseDir, 'bin', 'ffprobe.exe');
    process.env.TRANSCRIBE_BIN = path.join(baseDir, 'transcribe', 'transcribe.exe');
}

// Frontend static files
process.env.FRONTEND_PATH = isPackaged
    ? path.join(baseDir, 'frontend')
    : path.join(__dirname, '..', 'jtv-qr-web', 'out');

process.env.PROXY_BASE_URL = 'https://qr-generator-production-d028.up.railway.app';
process.env.NODE_ENV = 'production';

// ── Start the Express server ───────────────────────────────────
require('./src/index.js');

// ── Open browser after server is ready ────────────────────────
const PORT = process.env.PORT || 3001;

function waitAndOpen(retries = 20) {
    http.get(`http://localhost:${PORT}/health`, (res) => {
        if (res.statusCode === 200) {
            console.log(`\n✓ Fast TV Video Production Tool running at http://localhost:${PORT}`);
            console.log('  Opening browser...\n');
            // Open in default browser
            const cmd = process.platform === 'win32'
                ? `start http://localhost:${PORT}`
                : `open http://localhost:${PORT}`;
            exec(cmd);
        } else {
            retry();
        }
    }).on('error', () => {
        if (retries > 0) setTimeout(() => waitAndOpen(retries - 1), 500);
    });
}

setTimeout(() => waitAndOpen(), 1000);

// ── Keep process alive + handle exit ──────────────────────────
process.on('SIGINT', () => { console.log('\nShutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\nShutting down...'); process.exit(0); });

console.log(`\n Fast TV Video Production Tool`);
console.log(` Starting on port ${PORT}...`);
console.log(` Press Ctrl+C to stop\n`);
