// Minimal static file server for the QUnit pages. Dev-only.
// Serves the repo root so pages can import ../app/*.js and node_modules/.
// Usage: node tests/server.js [port]   (default 8000)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.org': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.map': 'application/json'
};

export function startServer(port = 8000) {
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(ROOT, urlPath);
        if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (err, data) => {
            if (err) { res.writeHead(404).end('not found'); return; }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
                                 'Cache-Control': 'no-store' });
            res.end(data);
        });
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve(server));
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const port = Number(process.argv[2]) || 8000;
    startServer(port).then(() => console.log(`Serving ${ROOT} at http://localhost:${port}/`));
}
