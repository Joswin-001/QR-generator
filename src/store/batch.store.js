const fs = require('fs');
const path = require('path');

// On Railway, use /tmp for writable storage
const PERSIST_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/batches.json'
  : path.join(__dirname, '../../data/batches.json');

const store = new Map();

function ensureDataDir() {
  const dir = path.dirname(PERSIST_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadFromDisk() {
  try {
    ensureDataDir();
    if (!fs.existsSync(PERSIST_PATH)) return;
    const raw = fs.readFileSync(PERSIST_PATH, 'utf8');
    const entries = JSON.parse(raw);
    for (const [id, entry] of Object.entries(entries)) {
      store.set(id, entry);
    }
    console.log(`[batch.store] Loaded ${store.size} batch(es) from disk`);
  } catch (e) {
    console.warn('[batch.store] Could not load persisted data:', e.message);
  }
}

function saveToDisk() {
  try {
    ensureDataDir();
    const obj = Object.fromEntries(store.entries());
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('[batch.store] Could not persist data:', e.message);
  }
}

function save(batchId, skus) {
  store.set(batchId, {
    skus,
    createdAt: new Date().toISOString(),
  });
  saveToDisk();
}

function get(batchId) {
  return store.get(batchId);
}

function list() {
  return Object.fromEntries(store.entries());
}

function remove(batchId) {
  store.delete(batchId);
  saveToDisk();
}

loadFromDisk();

module.exports = { save, get, list, remove };
