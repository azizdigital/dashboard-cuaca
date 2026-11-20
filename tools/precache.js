/* writes app/precache.js: the app's own files + a version from their content (a new version on every change) */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..', 'app');
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f), rel = path.relative(root, p).split(path.sep).join('/');
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (!/^(sw\.js|precache\.js)$/.test(rel) && !/\.(map|md)$/.test(rel)) files.push(rel);
  }
})(root);
files.sort();
const h = crypto.createHash('sha256');
files.forEach(f => h.update(f).update(fs.readFileSync(path.join(root, f))));
const version = h.digest('hex').slice(0, 12);
fs.writeFileSync(path.join(root, 'precache.js'), 'self.PRECACHE = ' + JSON.stringify({ version, files: ['./'].concat(files) }, null, 1) + ';\n');
console.log('precache', version, files.length, 'files');
