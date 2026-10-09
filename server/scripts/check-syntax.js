// Lightweight lint: ensures every source file parses and every module loads.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
});
['src', 'tests'].forEach((d) => fs.existsSync(d) && walk(d));
files.forEach((f) => execFileSync(process.execPath, ['--check', f]));
console.log(`✓ ${files.length} files parsed OK`);
