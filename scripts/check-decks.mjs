#!/usr/bin/env node
/**
 * Open every built deck in a browser and check what a reader would see.
 *
 * This exists because eyeballing one deck and assuming the rest match is how a
 * broken agenda reached the published site: the deck that was checked had no
 * numbered headings, the one that was not did, and a heading like "1. Code"
 * turned into an empty bullet with a nested list beside it.
 *
 *   node scripts/check-decks.mjs [siteDir]
 *
 * Exits 1 on any finding, so CI can run it.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, readdirSync } from 'node:fs';
import { extname } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const site = resolve(process.argv[2] || 'site');
const port = 9500 + Math.floor(Math.random() * 400);

// What a slide must never show. Each entry is checked against the rendered DOM.
const CHECKS = `
(() => {
    const findings = [];
    const slides = [...document.querySelectorAll('.slides section')]
        .filter((slide) => !slide.querySelector('section'));

    const title = (slide) => (slide.querySelector('h1, h2, h3') || {}).textContent || '(untitled)';

    slides.forEach((slide, index) => {
        const report = (issue, detail) => findings.push({ index, title: title(slide), issue, detail });

        // Carve syntax that reached the screen as text. Code and the notes
        // under a slide quote that syntax on purpose, so they are skipped:
        // without this the check flags every slide that documents a directive.
        const prose = [...slide.querySelectorAll('p, li, td, th, h1, h2, h3')]
            .filter((node) => !node.closest('code, pre, .note'))
            .map((node) => {
                const clone = node.cloneNode(true);
                clone.querySelectorAll('code, pre').forEach((code) => code.remove());

                return clone.textContent;
            })
            .join('\\n');

        const raw = prose.match(/\\{\\.[a-z-]+\\}|^:::|^%% [a-z]+|:color\\[|:spoiler\\[/m);
        if (raw) {
            report('unrendered markup', raw[0]);
        }

        // A list item whose entire content is another list: the text that
        // should have been the entry was parsed away as a marker. This is what
        // "1. Code" did to an agenda bullet.
        slide.querySelectorAll('li').forEach((item) => {
            const nested = item.firstElementChild;
            const isList = nested && /^(UL|OL)$/.test(nested.tagName);
            const ownText = item.textContent.replace(nested ? nested.textContent : '', '').trim();

            if (isList && item.children.length === 1 && !ownText) {
                report('list item holds only a nested list', nested.textContent.trim().slice(0, 40));
            }
        });

        // A diagram or chart whose renderer never ran.
        slide.querySelectorAll('.mermaid, .chart, .math').forEach((holder) => {
            const drawn = holder.querySelector('svg, canvas, .katex');

            if (!drawn) {
                report('renderer did not draw', holder.className);
            }
        });

        slide.querySelectorAll('[data-carve-error]').forEach(() => report('error slide', ''));

        if (slide.scrollHeight > 800) {
            report('slide overflows', slide.scrollHeight + 'px');
        }
    });

    return { slides: slides.length, findings };
})()
`;

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
            message.error ? waiting.fail(new Error(message.error.message)) : waiting.done(message.result);
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
        const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });

        return result.result?.value;
    }
}

async function endpoint(debugPort) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
            const page = targets.find((target) => target.type === 'page');

            if (page) {
                return page.webSocketDebuggerUrl;
            }
        } catch {
            // still starting
        }

        await new Promise((done) => setTimeout(done, 150));
    }

    throw new Error('check-decks: no browser.');
}

const decks = readdirSync(site).filter((name) => name.endsWith('.html') && name !== 'index.html');

if (!decks.length) {
    console.error(`check-decks: no decks in ${site}. Run the site build first.`);
    process.exit(1);
}

// The runtime deck fetches its source, and file:// refuses that, so the check
// serves the directory the way the published site does.
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.crv': 'text/plain; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
};

const httpPort = port + 1;
const server = createServer((request, response) => {
    const path = join(site, decodeURIComponent(request.url.split('?')[0]));
    const stream = createReadStream(path);

    stream.on('error', () => response.writeHead(404).end());
    stream.on('open', () => {
        response.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
        stream.pipe(response);
    });
});

await new Promise((done) => server.listen(httpPort, done));

const profile = await mkdtemp(join(tmpdir(), 'reveal-carve-check-'));
const chrome = spawn('google-chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
], { stdio: 'ignore' });

let failed = false;

try {
    const socket = new WebSocket(await endpoint(port));
    await new Promise((done) => socket.addEventListener('open', done, { once: true }));

    const devtools = new Devtools(socket);
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');

    for (const deck of decks) {
        await devtools.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/${deck}` });
        await new Promise((done) => setTimeout(done, 2500));

        const result = await devtools.evaluate(CHECKS);
        const findings = result?.findings || [];

        if (!findings.length) {
            console.log(`${deck}: ${result?.slides ?? 0} slides, clean`);
            continue;
        }

        failed = true;
        console.log(`${deck}: ${findings.length} finding(s)`);

        for (const finding of findings) {
            console.log(`  slide ${finding.index + 1} "${finding.title}": ${finding.issue} ${finding.detail}`);
        }
    }

    socket.close();
} finally {
    chrome.kill();
    server.close();
}

process.exit(failed ? 1 : 0);
