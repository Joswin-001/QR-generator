#!/usr/bin/env node
/**
 * Standalone PDF-to-PNG rendering subprocess.
 * Reads a PDF buffer from stdin, renders each page using pdfjs-dist (legacy ESM)
 * + @napi-rs/canvas, and writes an array of base64 PNGs to stdout.
 *
 * Runs OUTSIDE of Next.js so pdfjs-dist worker resolution is not an issue.
 */

const { createCanvas, DOMMatrix: NapiDOMMatrix } = require('@napi-rs/canvas');

// Polyfill DOMMatrix for pdfjs-dist in Node.js
if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = NapiDOMMatrix;
}

class NodeCanvasFactory {
    create(width, height) {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        return { canvas, context };
    }
    reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
    }
}

async function main() {
    const dpi = parseInt(process.argv[2]) || 300;
    const scale = dpi / 72;

    // Read PDF from stdin
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Use dynamic import for ESM-only legacy build
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Point to the actual worker file (empty string is treated as "not set" in v5)
    const path = require('path');
    const url = require('url');
    const workerPath = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'legacy', 'build', 'pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = url.pathToFileURL(workerPath).href;

    const canvasFactory = new NodeCanvasFactory();

    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBuffer),
        disableFontFace: true,
        useSystemFonts: true,
        canvasFactory, // CRITICAL: pass our factory here so pdfjs never uses its internal one
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    const results = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvasAndContext = canvasFactory.create(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height)
        );

        await page.render({
            canvasContext: canvasAndContext.context,
            viewport,
            canvasFactory, // KEY: tells pdfjs how to create canvases in Node.js
        }).promise;

        const pngBuffer = canvasAndContext.canvas.toBuffer('image/png');
        results.push(pngBuffer.toString('base64'));

        canvasFactory.destroy(canvasAndContext);
        page.cleanup();
    }

    process.stdout.write(JSON.stringify(results));
}

main().catch(err => {
    process.stderr.write(err.stack || err.message);
    process.exit(1);
});
