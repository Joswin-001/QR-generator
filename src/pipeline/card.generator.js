'use strict';

const axios = require('axios/dist/node/axios.cjs');
const sharp = require('../sharp.helper')();
const QRCode = require('qrcode');

const CARD_W = 500;
const HEADER_H = 80;
const IMAGE_H = 400;
const QR_AREA_H = 380;
const FOOTER_H = 80;
const CARD_H = HEADER_H + IMAGE_H + QR_AREA_H + FOOTER_H; // 940

const QR_SIZE = 300;
const QR_TOP = HEADER_H + IMAGE_H + (QR_AREA_H - QR_SIZE) / 2;

const CORNER_RADIUS = 32; // px — rounded corner radius

const TEAL = '#00B5AD';
const RED = '#E8431A';
const WHITE = '#FFFFFF';
const BLACK = '#111111';

const CDN_BASE = 'https://images.jtv.com/jewelry/JTV-{sku}-1-medium.jpg';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://www.jtv.com/',
};

/**
 * Creates a rounded-rectangle PNG mask buffer using sharp + SVG.
 * White = opaque (keep), Black = transparent (cut).
 */
async function makeRoundedMask(w, h, r) {
    const svg = Buffer.from(`
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/>
    </svg>
  `);
    return sharp(svg).png().toBuffer();
}

async function generateCard(sku) {
    const imageUrl = CDN_BASE.replace('{sku}', sku.toUpperCase());
    const qrUrl = `https://www.jtv.com/product/${sku.toUpperCase()}`;

    try {
        // 1. Fetch product image from JTV CDN
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 12000,
            headers: HEADERS,
        });

        if (response.status !== 200) {
            console.warn(`[card.generator] ✗ ${sku} — HTTP ${response.status}`);
            return null;
        }

        // 2. Resize product image to 500x400 (contain, white bg)
        const productImage = await sharp(Buffer.from(response.data))
            .resize(CARD_W, IMAGE_H, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            })
            .png()
            .toBuffer();

        // 3. Generate QR code PNG
        const qrBuffer = await QRCode.toBuffer(qrUrl, {
            type: 'png',
            width: QR_SIZE,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
        });

        // 4. Build SVG layers
        const headerBuf = await sharp(Buffer.from(`
      <svg width="${CARD_W}" height="${HEADER_H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${CARD_W}" height="${HEADER_H}" fill="${TEAL}"/>
        <text
          x="${CARD_W / 2}" y="${HEADER_H / 2 + 11}"
          font-family="Arial Black, Arial, Helvetica, sans-serif"
          font-size="36" font-weight="900"
          fill="${BLACK}" text-anchor="middle" letter-spacing="3"
        >${sku.toUpperCase()}</text>
      </svg>
    `)).png().toBuffer();

        const qrBgBuf = await sharp(Buffer.from(`
      <svg width="${CARD_W}" height="${QR_AREA_H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${CARD_W}" height="${QR_AREA_H}" fill="${WHITE}"/>
      </svg>
    `)).png().toBuffer();

        const footerBuf = await sharp(Buffer.from(`
      <svg width="${CARD_W}" height="${FOOTER_H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${CARD_W}" height="${FOOTER_H}" fill="${RED}"/>
        <text
          x="${CARD_W / 2}" y="${FOOTER_H / 2 + 11}"
          font-family="Arial Black, Arial, Helvetica, sans-serif"
          font-size="28" font-weight="900"
          fill="${WHITE}" text-anchor="middle" letter-spacing="4"
        >SCAN AND SHOP</text>
      </svg>
    `)).png().toBuffer();

        // 5. Composite all layers onto canvas
        const flatCard = await sharp({
            create: {
                width: CARD_W,
                height: CARD_H,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
        })
            .composite([
                { input: headerBuf, top: 0, left: 0 },
                { input: productImage, top: HEADER_H, left: 0 },
                { input: qrBgBuf, top: HEADER_H + IMAGE_H, left: 0 },
                { input: qrBuffer, top: Math.round(QR_TOP), left: Math.round((CARD_W - QR_SIZE) / 2) },
                { input: footerBuf, top: HEADER_H + IMAGE_H + QR_AREA_H, left: 0 },
            ])
            .png()
            .toBuffer();

        // 6. Apply rounded corner mask
        const mask = await makeRoundedMask(CARD_W, CARD_H, CORNER_RADIUS);

        const card = await sharp(flatCard)
            .composite([{ input: mask, blend: 'dest-in' }])
            .png()
            .toBuffer();

        console.log(`[card.generator] ✓ ${sku} — ${Math.round(card.length / 1024)}KB`);
        return card;

    } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
            console.warn(`[card.generator] ✗ ${sku} — not found on CDN (404)`);
        } else {
            console.warn(`[card.generator] ✗ ${sku} — ${err.message}`);
        }
        return null;
    }
}

async function generateCards(skus, concurrency = 4) {
    let active = 0;
    const queue = [];
    const next = () => {
        if (active >= concurrency || queue.length === 0) return;
        active++;
        const { fn, resolve, reject } = queue.shift();
        fn().then(resolve).catch(reject).finally(() => { active--; next(); });
    };
    const limit = (fn) => new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
    });

    const results = new Map();

    await Promise.all(
        skus.map(sku =>
            limit(async () => {
                const buf = await generateCard(sku);
                if (buf) results.set(sku, buf);
            })
        )
    );

    console.log(`[card.generator] Done: ${results.size}/${skus.length} cards generated`);
    return results;
}

module.exports = { generateCard, generateCards };
