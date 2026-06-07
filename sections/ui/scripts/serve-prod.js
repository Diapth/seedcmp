import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.PORT || process.argv[2] || 5173);
const PUBLIC_DIR = path.resolve('dist/build/h5');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let safePath = req.url.split('?')[0];
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }
  
  const filePath = path.join(PUBLIC_DIR, safePath);
  console.log(`[REQUEST] ${req.url} -> trying filePath: ${filePath}`);
  
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log(`[FALLBACK] File not found: ${filePath}, falling back to index.html`);
      // Return index.html for SPA router fallback
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    console.log(`[SERVE] Serving ${filePath} with Content-Type: ${contentType}`);
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
});
