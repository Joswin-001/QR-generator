const sharp = require('sharp');
const fs = require('fs');

const svg1 = `
<svg width="800" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="800" height="300" fill="#E23D28"/>
    <text x="400" y="150" font-family="sans-serif" font-weight="bold" font-size="60" fill="#ffffff" text-anchor="middle">SCAN AND SHOP</text>
</svg>
`;

async function run() {
    try {
        const buf = await sharp(Buffer.from(svg1)).png().toBuffer();
        // check if file size is very small (blank) or larger (has text)
        const blankSvg = `
        <svg width="800" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="800" height="300" fill="#E23D28"/>
        </svg>
        `;
        const blankBuf = await sharp(Buffer.from(blankSvg)).png().toBuffer();
        
        console.log('Text Buffer Size:', buf.length);
        console.log('Blank Buffer Size:', blankBuf.length);
    } catch (e) {
        console.error(e);
    }
}
run();
