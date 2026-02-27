require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const singleRoute = require('./routes/single.route');
const batchRoute = require('./routes/batch.route');
const redirectRoute = require('./routes/redirect.route');

app.use(singleRoute);
app.use(batchRoute);
app.use(redirectRoute);

app.get('/health', (req, res) => res.json({ 
  status: 'ok',
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development'
}));

// Railway injects PORT automatically — must bind to 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log(`JTV Code Forge running on port ${PORT}`);
  console.log(`Proxy base URL: ${process.env.PROXY_BASE_URL || `http://localhost:${PORT}`}`);
});

module.exports = app;
