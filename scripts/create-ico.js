const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, '..', 'assets', 'logo.png');
const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');

const pngBuffer = fs.readFileSync(pngPath);

// Windows ICO header for PNG embedded icon (256x256)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // Type 1 = ICO
header.writeUInt16LE(1, 4); // Number of images = 1

const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(0, 0); // Width 256 = 0
dirEntry.writeUInt8(0, 1); // Height 256 = 0
dirEntry.writeUInt8(0, 2); // Colors
dirEntry.writeUInt8(0, 3); // Reserved
dirEntry.writeUInt16LE(1, 4); // Color planes
dirEntry.writeUInt16LE(32, 6); // Bits per pixel
dirEntry.writeUInt32LE(pngBuffer.length, 8); // Image size
dirEntry.writeUInt32LE(6 + 16, 12); // Image offset (22)

const icoBuffer = Buffer.concat([header, dirEntry, pngBuffer]);
fs.writeFileSync(icoPath, icoBuffer);
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), icoBuffer);

console.log('Valid icon.ico generated successfully, size:', icoBuffer.length);
