const { describe, it } = require('node:test');
const assert = require('node:assert');
const qrGenerator = require('../src/core/qr.generator');

describe('qr.generator', () => {
    it('should generate a PNG buffer', async () => {
        const buffer = await qrGenerator.toBuffer('https://example.com');
        assert.ok(buffer instanceof Buffer);
        // Rough check for PNG magic numbers
        assert.strictEqual(buffer.slice(0, 4).toString('hex'), '89504e47');
    });

    it('should generate an SVG string', async () => {
        const svg = await qrGenerator.toSvg('https://example.com');
        assert.strictEqual(typeof svg, 'string');
        assert.strictEqual(svg.startsWith('<svg'), true);
    });
});
