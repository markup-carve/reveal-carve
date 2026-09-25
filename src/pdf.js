/**
 * PDF export: reveal's own `?print-pdf` mode, printed by headless Chrome.
 *
 * Chrome's `--print-to-pdf` flag turned out to be unusable here. reveal builds
 * its print layout asynchronously, and the flag prints when the virtual time
 * budget runs out, whether or not that layout exists yet: the same deck printed
 * twelve pages once and a single blank page the next time, from a byte-identical
 * file, and raising the budget changed nothing.
 *
 * So this drives the browser over the DevTools protocol: navigate, wait until
 * the print layout is actually there, then print. No extra dependency - Node has
 * shipped a WebSocket client since 22.
 */

import { spawn } from 'node:child_process';
import { access, constants, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

const CANDIDATES = [
    process.env.CHROME_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function findChrome() {
    for (const candidate of CANDIDATES) {
        if (candidate.includes('/')) {
            try {
                await access(candidate, constants.X_OK);

                return candidate;
            } catch {
                continue;
            }
        }

        const found = await new Promise((done) => {
            const which = spawn('which', [candidate]);
            which.on('close', (code) => done(code === 0 ? candidate : null));
            which.on('error', () => done(null));
        });

        if (found) {
            return found;
        }
    }

    throw new Error('reveal-carve: no Chrome or Chromium found. Set CHROME_PATH to the binary.');
}

function urlFor(deck) {
    if (deck.startsWith('http')) {
        return `${deck}${deck.includes('?') ? '&' : '?'}print-pdf`;
    }

    return `file://${isAbsolute(deck) ? deck : resolve(deck)}?print-pdf`;
}

class Devtools {
    constructor(socket) {
        this.socket = socket;
        this.id = 0;
        this.pending = new Map();

        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            const waiting = this.pending.get(message.id);

            if (!waiting) {
                return;
            }

            this.pending.delete(message.id);

            if (message.error) {
                waiting.fail(new Error(message.error.message));

                return;
            }

            waiting.done(message.result);
        });
    }

    send(method, params = {}) {
        this.id += 1;
        const id = this.id;

        return new Promise((done, fail) => {
            this.pending.set(id, { done, fail });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', { expression, returnByValue: true });

        return result.result?.value;
    }
}

async function endpointFor(port, attempts = 60) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/list`);
            const page = (await response.json()).find((target) => target.type === 'page');

            if (page?.webSocketDebuggerUrl) {
                return page.webSocketDebuggerUrl;
            }
        } catch {
            // Chrome is still starting up.
        }

        await new Promise((done) => setTimeout(done, 150));
    }

    throw new Error('reveal-carve: could not reach the browser over the DevTools protocol.');
}

/**
 * @param {string} deck Path or URL of a built HTML deck
 * @param {string} target Where to write the PDF
 * @param {object} [options]
 * @param {number} [options.timeout] How long to wait for the print layout, default 20000
 * @param {number} [options.settle] Pause before the snapshot, for late diagrams, default 800
 * @returns {Promise<{target: string, pages: number}>}
 */
export async function exportPdf(deck, target, options = {}) {
    const binary = options.chrome || (await findChrome());
    const port = options.port || 9222 + Math.floor(Math.random() * 400);
    const profile = await mkdtemp(join(tmpdir(), 'reveal-carve-chrome-'));

    const chrome = spawn(binary, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${profile}`,
        `--remote-debugging-port=${port}`,
        'about:blank',
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    let socket;

    try {
        socket = new WebSocket(await endpointFor(port));
        await new Promise((done, fail) => {
            socket.addEventListener('open', done, { once: true });
            socket.addEventListener(
                'error',
                () => fail(new Error('reveal-carve: the DevTools connection failed.')),
                { once: true },
            );
        });

        const devtools = new Devtools(socket);
        await devtools.send('Page.enable');
        await devtools.send('Runtime.enable');
        await devtools.send('Page.navigate', { url: urlFor(deck) });

        const deadline = Date.now() + (options.timeout || 20000);
        let pages = 0;

        // reveal rewrites the deck into .pdf-page elements once its print layout
        // is ready. Waiting for those is the whole reason to talk to the browser
        // instead of trusting a timer.
        while (Date.now() < deadline) {
            pages = (await devtools.evaluate('document.querySelectorAll(".pdf-page").length')) || 0;

            if (pages > 0) {
                break;
            }

            await new Promise((done) => setTimeout(done, 200));
        }

        if (!pages) {
            throw new Error(
                `reveal-carve: ${deck} never produced a print layout. Open it with ?print-pdf in a `
                + 'browser to see what the deck does.',
            );
        }

        await new Promise((done) => setTimeout(done, options.settle || 800));

        const { data } = await devtools.send('Page.printToPDF', {
            printBackground: true,
            preferCSSPageSize: true,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
        });

        await writeFile(isAbsolute(target) ? target : resolve(target), Buffer.from(data, 'base64'));

        return { target, pages };
    } finally {
        socket?.close();
        chrome.kill();
    }
}
