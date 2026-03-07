const path = require('path');
const isPackaged = typeof process.pkg !== 'undefined';

function requireSharp() {
    if (isPackaged) {
        // Force require from the real filesystem next to the executable
        // bypasses the pkg virtual file system compiler
        const exeDir = path.dirname(process.execPath);
        const sharpPath = path.join(exeDir, 'node_modules', 'sharp');
        // Hide the require from PKG's AST parser using eval
        const req = eval('require');
        return req(sharpPath);
    } else {
        return require('sharp');
    }
}

module.exports = requireSharp;
