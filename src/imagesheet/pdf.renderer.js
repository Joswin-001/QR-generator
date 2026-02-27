const { execFile } = require('child_process');
const path = require('path');

const PYTHON_SCRIPT = path.join(__dirname, 'pdf_render.py');

async function renderPages(pdfBuffer, opts = {}) {
  const dpi = opts.dpi || 300;

  return new Promise((resolve, reject) => {
    const child = execFile(
      'python3',
      [PYTHON_SCRIPT, String(dpi)],
      {
        encoding: 'buffer',
        maxBuffer: 100 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr ? stderr.toString() : error.message;
          return reject(new Error(`PDF rendering failed: ${msg}`));
        }
        try {
          const result = JSON.parse(stdout.toString());
          const buffers = result.map(b64 => Buffer.from(b64, 'base64'));
          resolve(buffers);
        } catch (e) {
          reject(new Error(`Failed to parse renderer output: ${e.message}`));
        }
      }
    );

    child.stdin.write(pdfBuffer);
    child.stdin.end();
  });
}

module.exports = { renderPages };
