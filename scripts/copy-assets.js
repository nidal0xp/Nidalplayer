const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'logo.png');
const destDir = path.join(__dirname, '..', 'android-tv', 'res', 'drawable');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

fs.copyFileSync(src, path.join(destDir, 'ic_launcher.png'));
fs.copyFileSync(src, path.join(destDir, 'tv_banner.png'));
console.log('Drawables copied successfully.');
