const { describe, it } = require('node:test');
const assert = require('node:assert');
const { readSkus } = require('../src/io/csv.reader');
const fs = require('fs/promises');
const path = require('path');

describe('csv.reader', () => {
    const testDir = path.join(__dirname, 'temp');

    it('should read a single column CSV without header', async () => {
        const csvContent = 'ZDG004\nYBH432-8\nABC123\n';
        const filePath = path.join(testDir, 'single.csv');
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(filePath, csvContent);

        const skus = await readSkus(filePath);
        assert.deepStrictEqual(skus, ['ZDG004', 'YBH432-8', 'ABC123']);
    });

    it('should read a CSV with headers', async () => {
        const csvContent = 'id,SKU,price\n1,ZDG004,10.00\n2,YBH432-8,20.00\n';
        const filePath = path.join(testDir, 'header.csv');
        await fs.writeFile(filePath, csvContent);

        const skus = await readSkus(filePath);
        assert.deepStrictEqual(skus, ['ZDG004', 'YBH432-8']);

        // Cleanup
        await fs.rm(testDir, { recursive: true, force: true });
    });
});
