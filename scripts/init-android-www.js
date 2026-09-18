const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'android-tv', 'assets', 'www');
const jsDir = path.join(destDir, 'js');
const cssDir = path.join(destDir, 'css');

[destDir, jsDir, cssDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Copy hls.min.js
fs.copyFileSync(
  path.join(__dirname, '..', 'tizen-app', 'js', 'hls.min.js'),
  path.join(jsDir, 'hls.min.js')
);

// Copy logo icon
fs.copyFileSync(
  path.join(__dirname, '..', 'assets', 'logo.png'),
  path.join(destDir, 'icon.png')
);

// Copy remote.html
fs.copyFileSync(
  path.join(__dirname, '..', 'remote', 'index.html'),
  path.join(destDir, 'remote.html')
);

console.log('Android TV www assets initialized.');
