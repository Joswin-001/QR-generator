const { fromBuffer } = require('pdf2pic');

async function renderPages(pdfBuffer, opts = {}) {
  const dpi = opts.dpi || 300;

  const converter = fromBuffer(pdfBuffer, {
    density: dpi,
    format: 'png',
    width: 2550,
    height: 3300,
    saveFilename: 'page',
    savePath: '/tmp',
  });

  const pages = await converter.bulk(-1, { responseType: 'buffer' });
  return pages.map(page => page.buffer);
}

module.exports = { renderPages };
