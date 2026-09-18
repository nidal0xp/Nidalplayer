const fs = require('fs');
const path = require('path');

// Ensure assets & build directories exist
const assetsDir = path.join(__dirname, '..', 'assets');
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

const srcLogo = path.join('C:', 'Users', 'nidal', '.gemini', 'antigravity', 'brain', 'cb51dc74-e37f-4550-87c4-6679178966ef', 'np_logo_pure_orange_1787079205130.jpg');
const srcSidebar = path.join('C:', 'Users', 'nidal', '.gemini', 'antigravity', 'brain', 'cb51dc74-e37f-4550-87c4-6679178966ef', 'installer_sidebar_orange_1787079751567.jpg');
const srcHeader = path.join('C:', 'Users', 'nidal', '.gemini', 'antigravity', 'brain', 'cb51dc74-e37f-4550-87c4-6679178966ef', 'installer_header_orange_1787079784072.jpg');

fs.copyFileSync(srcLogo, path.join(assetsDir, 'logo.png'));
fs.copyFileSync(srcLogo, path.join(assetsDir, 'logo.jpg'));
fs.copyFileSync(srcLogo, path.join(buildDir, 'icon.png'));
fs.copyFileSync(srcSidebar, path.join(buildDir, 'installerSidebar.bmp'));
fs.copyFileSync(srcSidebar, path.join(buildDir, 'uninstallerSidebar.bmp'));
fs.copyFileSync(srcHeader, path.join(buildDir, 'installerHeader.bmp'));

console.log('Installer assets prepared successfully.');
