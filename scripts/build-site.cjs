const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '_site');
// Only export public assets. Server code, source CSVs and credentials stay out.
if (path.dirname(output) !== root || path.basename(output) !== '_site') throw new Error('Invalid output directory');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
for (const entry of ['index.html', 'css', 'js', 'images']) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
console.log('Static site exported to _site/');
