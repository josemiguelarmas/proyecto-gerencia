const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { handleApiRequest } = require('./routes');
const { startJobs, stopJobs } = require('./jobs');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const PORT = process.env.PORT || 3000;

// F5: cabeceras de seguridad en todas las respuestas. La CSP permite solo scripts propios;
// los estilos en línea siguen permitidos porque las vistas los usan, y las fuentes vienen de
// Google Fonts. Las fotos del catálogo pueden venir de cualquier URL https (importación CSV).
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

function setSecurityHeaders(res) {
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => res.setHeader(name, value));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let filePath = path.join(FRONTEND_DIR, relativePath);

  // Normalization check against path traversal
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access denied');
  }

  // If path doesn't exist, check if it's an SPA route and serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(FRONTEND_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Error loading file');
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  setSecurityHeaders(res);
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    handleApiRequest(req, res, pathname);
  } else if (pathname === '/docs/ejemplo_catalogo.csv') {
    // HU-05: plantilla de importación descargable desde el panel admin
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ejemplo_catalogo.csv"' });
    fs.createReadStream(path.join(__dirname, '..', 'docs', 'ejemplo_catalogo.csv')).pipe(res);
  } else {
    serveStatic(req, res, pathname);
  }
});

function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      startJobs();
      console.log(`[The Clothes Box] Backend Full-Stack corriendo en http://localhost:${server.address().port}`);
      resolve(server);
    });
  });
}

server.on('close', stopJobs);

if (require.main === module) {
  const env = require('./config/env');
  try {
    env.assertValid();
  } catch (err) {
    console.error(`[The Clothes Box] ${err.message}`);
    process.exit(1);
  }
  startServer(env.PORT);
}

module.exports = {
  server,
  startServer
};
