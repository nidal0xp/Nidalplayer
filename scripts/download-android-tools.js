const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const destDir = path.join(__dirname, '..', 'build-tools', 'android');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const btZip = path.join(destDir, 'build-tools-33.zip');
const btUrl = 'https://dl.google.com/android/repository/build-tools_r33.0.2-windows.zip';

console.log('Downloading build-tools 33.0.2 from Google...');
execSync(`curl.exe -L -o "${btZip}" "${btUrl}"`, { stdio: 'inherit' });

console.log('Extracting build-tools with tar...');
execSync(`tar.exe -xf "${btZip}" -C "${destDir}"`, { stdio: 'inherit' });

if (fs.existsSync(btZip)) fs.unlinkSync(btZip);

console.log('Android build-tools setup complete in:', destDir);
