const { execFile } = require('child_process');
const path = require('path');

/**
 * Converts a PDF buffer into an array of high-resolution PNG image buffers.
 * Uses a child process to completely bypass Next.js Turbopack bundler interference
 * with pdfjs-dist's internal worker resolution.
 * 
 * @param {Buffer} pdfBuffer - The raw PDF file buffer
 * @param {object} opts - Render options
 * @param {number} opts.dpi - Render resolution DPI target (default: 300)
 * @returns {Promise<Buffer[]>} - Array of PNG buffers, one for each page
 */
async function renderPages(pdfBuffer, opts = {}) {
    const scriptPath = path.join(__dirname, 'pdf.render.worker.js');
    const dpi = opts.dpi || 300;

    return new Promise((resolve, reject) => {
        const child = execFile('node', [scriptPath, String(dpi)], {
            encoding: 'buffer',
            maxBuffer: 100 * 1024 * 1024, // 100MB for large PDFs
        }, (error, stdout, stderr) => {
            if (error) {
                const errMsg = stderr ? stderr.toString() : error.message;
                return reject(new Error(`PDF rendering subprocess failed: ${errMsg}`));
            }

            try {
                // The child process outputs a JSON array of base64-encoded PNG buffers
                const result = JSON.parse(stdout.toString());
                const buffers = result.map(b64 => Buffer.from(b64, 'base64'));
                resolve(buffers);
            } catch (parseErr) {
                reject(new Error(`Failed to parse renderer output: ${parseErr.message}`));
            }
        });

        // Send PDF buffer to the child process via stdin
        child.stdin.write(pdfBuffer);
        child.stdin.end();
    });
}

module.exports = {
    renderPages
};
