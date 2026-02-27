const { describe, it } = require('node:test');
const assert = require('node:assert');
const { extractStyleNumber, resolve } = require('../src/core/sku.resolver');

describe('sku.resolver', () => {
    describe('extractStyleNumber', () => {
        it('should return original SKU if no dash', () => {
            assert.strictEqual(extractStyleNumber('ZDG004'), 'ZDG004');
        });

        it('should strip numeric suffix', () => {
            assert.strictEqual(extractStyleNumber('ZDG004-8'), 'ZDG004');
            assert.strictEqual(extractStyleNumber('YBH432-10'), 'YBH432');
        });

        it('should preserve non-numeric suffix', () => {
            assert.strictEqual(extractStyleNumber('ZDG004-8A'), 'ZDG004-8A');
            assert.strictEqual(extractStyleNumber('ZDG004-XYZ'), 'ZDG004-XYZ');
        });

        it('should handle undefined or empty correctly', () => {
            assert.strictEqual(extractStyleNumber(''), '');
            assert.strictEqual(extractStyleNumber(undefined), '');
        });
    });

    describe('resolve', () => {
        it('should resolve a clean SKU', () => {
            const result = resolve('ZDG004-8');
            assert.strictEqual(result.styleNumber, 'ZDG004');
            assert.strictEqual(result.originalSku, 'ZDG004-8');
            assert.strictEqual(result.url, 'https://www.jtv.com/product/ZDG004');
        });
    });
});
