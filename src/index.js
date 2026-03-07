require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Serve Next.js static frontend ─────────────────────────────
const frontendPath = process.env.FRONTEND_PATH
  || (process.env.ELECTRON_RUN_AS_NODE
    ? path.join(__dirname, '..', '..', 'frontend')
    : path.join(__dirname, '..', '..', 'jtv-qr-web', 'out'));

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  console.log(`[frontend] Serving from: ${frontendPath}`);
} else {
  console.warn(`[frontend] Not found: ${frontendPath}`);
}

// ── Routes ─────────────────────────────────────────────────────
const singleRoute = require('./routes/single.route');
const batchRoute = require('./routes/batch.route');
const redirectRoute = require('./routes/redirect.route');
const videoRoute = require('./routes/video.route');
const cardsRoute = require('./routes/cards.route');
const proxyRoute = require('./routes/proxy.route');
const captionsRoute = require('./routes/captions.route');
const dialogRoute = require('./routes/dialog.route');

app.use(singleRoute);
app.use(batchRoute);
app.use(redirectRoute);
app.use(videoRoute);
app.use(cardsRoute);
app.use(proxyRoute);
app.use(captionsRoute);
app.use(dialogRoute);

// ── Railway Sync Endpoint ──────────────────────────────────────
app.post('/api/batch/sync', express.json({ limit: '500mb' }), (req, res) => {
  const { batchId, skus, images, createdAt } = req.body;
  if (!batchId || !skus) {
    return res.status(400).json({ error: 'batchId and skus required' });
  }
  batchStore.save(batchId, skus, images || []);
  console.log(`[sync] Received batch ${batchId} with ${skus.length} SKUs`);
  res.json({ ok: true, batchId });
});

// ── Open folder ────────────────────────────────────────────────
const { exec } = require('child_process');
app.post('/api/open-folder', express.json(), (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'No path provided' });
  const cmd = process.platform === 'darwin'
    ? `open "${folderPath}"`
    : `explorer "${folderPath}"`;
  exec(cmd, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// ── Health check ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
  port: PORT,
}));

// ── SPA fallback ───────────────────────────────────────────────
app.get('*', (req, res) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/r/') ||
    req.path.startsWith('/health')
  ) return res.status(404).json({ error: 'Not found' });

  const indexFile = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send('Frontend not found');
  }
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fast TV Video Production Tool running on port ${PORT}`);
  console.log(`Proxy base URL: ${process.env.PROXY_BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`Frontend:       ${frontendPath}`);
  console.log(`FFmpeg:         ${process.env.FFMPEG_PATH || 'system'}`);
  console.log(`Transcribe:     ${process.env.TRANSCRIBE_BIN || 'python (system)'}`);
});

module.exports = app;
