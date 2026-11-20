/* static server for app/ (tests and local preview): node tests/serve.js [port] */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function start(port) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('not found'); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(port, '127.0.0.1', () => res(srv));
  });
}
if (require.main === module) start(+process.argv[2] || 8080).then(() => console.log('http://127.0.0.1:' + (+process.argv[2] || 8080) + '/'));
module.exports = { start };
