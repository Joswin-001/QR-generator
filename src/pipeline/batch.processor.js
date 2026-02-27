const pLimit = require('p-limit');
const cliProgress = require('cli-progress');
const { processSingle } = require('./single.processor');

/**
 * Processes an array of SKUs concurrently.
 * 
 * @param {string[]} skus 
 * @param {object} opts Options equivalent to what processSingle takes + concurrency
 * @returns {Promise<Array<any>>}
 */
async function processBatch(skus, opts) {
    const limit = pLimit(opts.concurrency || 8);
    const results = [];

    const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% || {value}/{total} SKUs || Errors: {errors}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });

    if (skus.length > 0) {
        progressBar.start(skus.length, 0, { errors: 0 });
    }

    let errorCount = 0;

    const promises = skus.map(sku =>
        limit(async () => {
            const result = await processSingle(sku, opts);
            results.push(result);

            if (result.status === 'ERROR') {
                errorCount++;
            }

            progressBar.increment(1, { errors: errorCount });
        })
    );

    await Promise.all(promises);
    progressBar.stop();

    return results;
}

module.exports = {
    processBatch
};
