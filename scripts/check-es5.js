const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'tizen-app', 'js');
const files = fs.readdirSync(dir);

files.forEach(f => {
  if (!f.endsWith('.js')) return;
  const content = fs.readFileSync(path.join(dir, f), 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('?.') || line.includes('??')) {
      console.log(`[SYNTAX ERROR RISK on Tizen 4.0] ${f}:${idx+1} -> ${line.trim()}`);
    }
  });
});
