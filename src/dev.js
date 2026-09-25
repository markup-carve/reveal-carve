/**
 * Development server: rebuild on save, reload the browser.
 *
 * Static file serving plus one server-sent-events endpoint. Every HTML response
 * gets a small reload listener injected, so an open deck follows the source
 * without a browser extension or a bundler.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.map': 'application/json',
    '.crv': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.woff2': 'font/woff2',
};

const RELOAD = `
<script>
(function () {
    var source = new EventSource('/__reload');
    source.onmessage = function () { window.location.reload(); };
}());
</script>
`;

/**
 * @param {object} options
 * @param {string} [options.root] Directory to serve, default cwd
 * @param {number} [options.port] Default 8800
 * @param {string[]} [options.watch] Directories to watch, default ['.']
 * @param {() => void} [options.onChange] Called before clients are told to reload
 */
export function serve(options = {}) {
    const root = resolve(options.root || process.cwd());
    const port = options.port || 8800;
    const clients = new Set();
    const log = options.log || ((message) => console.log(`[reveal-carve] ${message}`));

    const server = createServer(async (request, response) => {
        const url = new URL(request.url, `http://localhost:${port}`);

        if (url.pathname === '/__reload') {
            response.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            });
            response.write('\n');
            clients.add(response);
            request.on('close', () => clients.delete(response));

            return;
        }

        const requested = url.pathname === '/' ? '/index.html' : url.pathname;
        const path = join(root, normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, ''));

        if (!path.startsWith(root)) {
            response.writeHead(403).end('forbidden');

            return;
        }

        try {
            const info = await stat(path);
            const file = info.isDirectory() ? join(path, 'index.html') : path;
            const extension = extname(file);
            let body = await readFile(file);

            if (extension === '.html') {
                body = String(body).replace('</body>', `${RELOAD}</body>`);
            }

            response.writeHead(200, {
                'Content-Type': TYPES[extension] || 'application/octet-stream',
                'Cache-Control': 'no-store',
            });
            response.end(body);
        } catch {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
        }
    });

    let pending = null;

    const notify = (changed) => {
        clearTimeout(pending);
        pending = setTimeout(() => {
            try {
                options.onChange?.(changed);
            } catch (error) {
                log(`build failed: ${error.message}`);
            }

            for (const client of clients) {
                client.write('data: reload\n\n');
            }
        }, 80);
    };

    for (const directory of options.watch || ['.']) {
        watch(join(root, directory), { recursive: true }, (event, filename) => {
            if (!filename || filename.includes('node_modules') || filename.startsWith('.')) {
                return;
            }

            if (options.ignore?.(filename)) {
                return;
            }

            notify(filename);
        });
    }

    server.listen(port, () => log(`http://localhost:${port} - watching, Ctrl+C to stop`));

    return server;
}
