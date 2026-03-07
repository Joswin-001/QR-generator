'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

router.post('/api/video/proxy', express.json(), (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const { inputVideo } = req.body;

    if (!inputVideo) {
        send('error', { message: 'inputVideo is required.' });
        return res.end();
    }

    const inputPath = inputVideo;
    const baseName = path.parse(inputPath).name;
    const outputPath = path.join(path.dirname(inputPath), `${baseName}_proxy_480p.mp4`);

    if (!fs.existsSync(inputPath)) {
        send('error', { message: `Input not found: ${inputPath}` });
        return res.end();
    }

    send('status', { message: 'Starting proxy generation (720p)...' });

    let totalFrames = null;
    try {
        const { execSync } = require('child_process');
        const probe = JSON.parse(execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames,r_frame_rate,duration -of json "${inputPath}"`,
            { encoding: 'utf-8', timeout: 15000 }
        ));
        const stream = probe?.streams?.[0];
        if (stream?.nb_frames && parseInt(stream.nb_frames) > 0) {
            totalFrames = parseInt(stream.nb_frames);
        } else if (stream?.duration && stream?.r_frame_rate) {
            const [num, den] = stream.r_frame_rate.split('/').map(Number);
            totalFrames = Math.round(parseFloat(stream.duration) * (num / den));
        }
    } catch (_) { }

    const args = [
        '-y',
        '-i', inputPath,
        '-vf', 'scale=-2:480',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '28',
        '-b:v', '1000k',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath,
    ];

    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderrBuf = '';

    ff.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrBuf += text;

        const frameMatch = text.match(/frame=\s*(\d+)/);
        const fpsMatch = text.match(/fps=\s*([\d.]+)/);
        const sizeMatch = text.match(/size=\s*([\d]+)kB/);

        if (frameMatch) {
            const frame = parseInt(frameMatch[1]);
            const fps = fpsMatch ? parseFloat(fpsMatch[1]) : null;
            const percent = totalFrames ? Math.min(99, Math.round((frame / totalFrames) * 100)) : null;
            send('progress', {
                frame,
                fps,
                percent,
                totalFrames,
                size: sizeMatch ? parseInt(sizeMatch[1]) : null,
            });
        }
    });

    ff.on('close', (code) => {
        if (code === 0) {
            const stats = fs.statSync(outputPath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
            send('done', { message: 'Proxy video created successfully!', outputPath, sizeMB });
        } else {
            send('error', { message: `FFmpeg exited with code ${code}.\n${stderrBuf.slice(-500)}` });
        }
        res.end();
    });

    ff.on('error', (err) => {
        send('error', { message: `Failed to spawn FFmpeg: ${err.message}` });
        res.end();
    });
});

module.exports = router;
