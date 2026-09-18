const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const resDir = path.join(__dirname, '..', 'android-tv', 'res', 'drawable');
if (!fs.existsSync(resDir)) fs.mkdirSync(resDir, { recursive: true });

const srcIcon = path.join(__dirname, '..', 'assets', 'logo.png');

async function buildDrawables() {
  // 1. ic_launcher.png (192x192)
  await sharp(srcIcon)
    .resize(192, 192, { fit: 'cover' })
    .toFile(path.join(resDir, 'ic_launcher.png'));

  // 2. tv_banner.png (320x180 Android TV Banner)
  await sharp(srcIcon)
    .resize(320, 180, { fit: 'contain', background: { r: 8, g: 10, b: 14, alpha: 1 } })
    .toFile(path.join(resDir, 'tv_banner.png'));

  console.log('Android TV drawables ready in:', resDir);
}

buildDrawables().catch(console.error);
