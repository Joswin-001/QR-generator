const fs = require('fs');

async function testFetch(sku) {
    const url = `https://www.jtv.com/product/${sku}`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url);
        const html = await res.text();
        const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (match) {
            console.log(`Found image for ${sku}: ${match[1]}`);
        } else {
            console.log(`No image found for ${sku}`);
        }
    } catch (err) {
        console.error('Error fetching:', err);
    }
}

testFetch('ZDG004');
testFetch('MPL716');
