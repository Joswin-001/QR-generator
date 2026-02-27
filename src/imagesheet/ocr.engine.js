const Tesseract = require('tesseract.js');
const sharp = require('sharp');

/**
 * Preprocesses an image buffer to maximize OCR accuracy on bold grid text.
 * @param {Buffer} imageBuffer 
 * @returns {Promise<Buffer>}
 */
async function preprocessImage(imageBuffer) {
    return sharp(imageBuffer)
        .greyscale()
        .normalize() // Stretch contrast to max
        .linear(1.3, -(128 * 0.3)) // Apply strong contrast enhancement (x1.3)
        .sharpen({ sigma: 1.5, m1: 1.5, m2: 1.5 }) // Sharpness enhancement (x1.5)
        .png()
        .toBuffer();
}

/**
 * Extracts raw text from an image buffer using Tesseract OCR.
 * 
 * @param {Buffer} imageBuffer - PNG buffer of the rendered PDF page
 * @returns {Promise<string>} - Raw OCR text output
 */
async function extractText(imageBuffer) {
    try {
        const optimizedBuffer = await preprocessImage(imageBuffer);

        // Run pure JS OCR
        // PSM 6: Assume a single uniform block of text (good for grid layouts)
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });
        
        const { data: { text } } = await worker.recognize(optimizedBuffer);
        
        await worker.terminate();
        return text;
    } catch (error) {
        throw new Error(`OCR processing failed: ${error.message}`);
    }
}

module.exports = {
    extractText
};
