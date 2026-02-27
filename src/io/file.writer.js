const fs = require('fs/promises');
const path = require('path');

/**
 * Ensures the target output directory exists.
 * 
 * @param {string} dirPath 
 */
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

/**
 * Saves a PNG Buffer to the output directory.
 * 
 * @param {string} filename 
 * @param {Buffer} buffer 
 * @param {string} outputDir 
 * @returns {Promise<string>} The absolute path to the saved file
 */
async function writePng(filename, buffer, outputDir) {
    await ensureDir(outputDir);
    const filePath = path.join(outputDir, `${filename}.png`);
    await fs.writeFile(filePath, buffer);
    return filePath;
}

/**
 * Saves an SVG string to the output directory.
 * 
 * @param {string} filename 
 * @param {string} svgContent 
 * @param {string} outputDir 
 * @returns {Promise<string>} The absolute path to the saved file
 */
async function writeSvg(filename, svgContent, outputDir) {
    await ensureDir(outputDir);
    const filePath = path.join(outputDir, `${filename}.svg`);
    await fs.writeFile(filePath, svgContent, 'utf8');
    return filePath;
}

module.exports = {
    ensureDir,
    writePng,
    writeSvg
};
