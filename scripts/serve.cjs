// Serve only public assets: never expose local Google credentials or project files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const publicFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/config.js', ['config.js', 'text/javascript']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/sync.js', ['sync.js', 'text/javascript']],
  ['/apps-script/Inventory.js', ['apps-script/Inventory.js', 'text/javascript']]
]);
http.createServer((req, res) => {
  const file = publicFiles.get(new URL(req.url, 'http://localhost').pathname);
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, {'Content-Type': file[1]+'; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  if (req.method==='HEAD') res.end();
  else fs.createReadStream(path.join(__dirname, '..', file[0])).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log('Pilot preview: http://127.0.0.1:4173'));
