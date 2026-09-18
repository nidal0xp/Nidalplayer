const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const packScript = path.join(rootDir, 'scripts', 'pack_apk.py');

console.log('Running APK build via pack_apk.py with strict UNIX path normalization...');
execSync(`python "${packScript}"`, { stdio: 'inherit' });