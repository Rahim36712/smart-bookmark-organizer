// Local UI preview using disposable mock bookmarks. Never connects to Chrome data.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/ui/dashboard.html' : pathname));
    if (!file.startsWith(root + path.sep) || !types[path.extname(file)]) { res.writeHead(404).end(); return; }
    let body = fs.readFileSync(file);
    if (file.endsWith('.html')) body = body.toString().replace('<script type="module"', '<script type="module" src="/tests/preview-fixture.js"></script>\n<script type="module"');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(8765, '127.0.0.1', () => console.log('Disposable UI preview: http://127.0.0.1:8765/ui/dashboard.html'));
