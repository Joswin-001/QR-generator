const sharp = require('sharp');
const fs = require('fs');

const svg = `
<svg width="800" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="800" height="300" fill="#E23D28"/>
    <text x="400" y="150" font-family="Arial, sans-serif" font-weight="900" font-size="60" fill="#ffffff" text-anchor="middle">SCAN AND SHOP</text>
</svg>
`;

async function run() {
    try {
        await sharp(Buffer.from(svg))
            .png()
            .toFile('test_footer.png');
        console.log('Saved to test_footer.png');
    } catch (e) {
        console.error(e);
    }
}
run();
