const QRCode = require('qrcode');
const sharp = require('../sharp.helper')();

/**
 * Generates a QR code as a PNG buffer.
 * 
 * @param {string} url 
 * @param {object} opts 
 * @returns {Promise<Buffer>}
 */
async function toBuffer(url, opts = {}) {
    const margin = opts.margin !== undefined ? opts.margin : 2;
    const width = opts.width || 512;

    return QRCode.toBuffer(url, {
        type: 'png',
        margin,
        width,
        errorCorrectionLevel: 'H' // High error correction, better for logos
    });
}

/**
 * Generates a QR code as an SVG string.
 * 
 * @param {string} url 
 * @param {object} opts 
 * @returns {Promise<string>}
 */
async function toSvg(url, opts = {}) {
    const margin = opts.margin !== undefined ? opts.margin : 2;
    const width = opts.width || 512;

    return QRCode.toString(url, {
        type: 'svg',
        margin,
        width,
        errorCorrectionLevel: 'H'
    });
}

/**
 * Composites a logo onto a QR code PNG buffer.
 * 
 * @param {Buffer} qrBuffer 
 * @param {string} logoPath 
 * @returns {Promise<Buffer>}
 */
async function withLogo(qrBuffer, logoPath) {
    try {
        const qrImage = sharp(qrBuffer);
        const metadata = await qrImage.metadata();

        // Logo width will be roughly 1/4th of the QR code width
        const logoSize = Math.floor(metadata.width * 0.25);

        const logoBuffer = await sharp(logoPath)
            .resize(logoSize, logoSize, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for the logo
            })
            .toBuffer();

        return qrImage
            .composite([{
                input: logoBuffer,
                gravity: 'center'
            }])
            .png()
            .toBuffer();
    } catch (error) {
        throw new Error(`Failed to composite logo: ${error.message}`);
    }
}

/**
 * Creates a cohesive product label with the SKU, image, QR code, and footer.
 * Dimensions: 800x1200
 * 
 * @param {string} url - The URL the QR code resolves to
 * @param {string} sku - The original SKU string
 * @param {Buffer | null} imgBuffer - The fetched JTV product image buffer
 * @returns {Promise<Buffer>} The composite PNG label buffer
 */
async function toLabel(url, sku, imgBuffer) {
    try {
        const LABEL_WIDTH = 800;
        const LABEL_HEIGHT = 1350; // Increased to give the QR code room to breathe

        // 1. Generate the base QR Code (Slightly smaller)
        const qrBuffer = await toBuffer(url, { margin: 1, width: 480 });

        // 2. Build the SVG background template
        const svgTemplate = `
        <svg width="${LABEL_WIDTH}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <!-- Background -->
            <rect x="0" y="0" width="${LABEL_WIDTH}" height="${LABEL_HEIGHT}" fill="#ffffff" rx="40" ry="40"/>
            
            <!-- Cyan Header -->
            <rect x="0" y="0" width="${LABEL_WIDTH}" height="180" fill="#20B2AA" rx="40" ry="40"/>
            <rect x="0" y="90" width="${LABEL_WIDTH}" height="90" fill="#20B2AA"/>
            
            <!-- Red Footer -->
            <rect x="0" y="1190" width="${LABEL_WIDTH}" height="160" fill="#E23D28" rx="40" ry="40"/>
            <rect x="0" y="1190" width="${LABEL_WIDTH}" height="80" fill="#E23D28"/>

            <!-- Text Elements Layer -->
            <text x="400" y="115" font-family="Arial, sans-serif" font-weight="900" font-size="70" fill="#111111" text-anchor="middle" letter-spacing="4">
                ${sku.toUpperCase()}
            </text>

            <text x="400" y="1295" font-family="Arial, sans-serif" font-weight="900" font-size="60" fill="#ffffff" text-anchor="middle" letter-spacing="2">
                SCAN AND SHOP
            </text>
        </svg>
        `;

        // 3. Prepare the composite layers
        const composites = [
            // The generated QR Code (Centered)
            {
                input: qrBuffer,
                top: 660,
                left: 160 // (800 - 480) / 2
            }
        ];

        // 4. If we retrieved a product image, overlay it
        if (imgBuffer) {
            const productImg = await sharp(imgBuffer)
                .resize(600, 420, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .toBuffer();

            composites.push({
                input: productImg,
                top: 200, // Below the header
                left: 100
            });
        }

        // 5. Build the final image using the SVG as the base canvas
        return sharp(Buffer.from(svgTemplate))
            .composite(composites)
            .png()
            .toBuffer();

    } catch (error) {
        throw new Error(`Failed to generate custom label: ${error.message}`);
    }
}

module.exports = {
    toBuffer,
    toSvg,
    withLogo,
    toLabel
};
