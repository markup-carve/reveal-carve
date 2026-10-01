#!/usr/bin/env node
/**
 * Measure the highlight in a real browser, in both deck variants.
 *
 * A stylesheet test that reads CSS text cannot see a contrast failure: the
 * declaration that broke `=highlight=` on a dark deck was present and correct
 * in isolation, and only the cascade made the ink unreadable. So this boots the
 * same headless browser `check-decks.mjs` uses, loads the two variants over the
 * reveal themes they ship against, and reads computed colors back.
 *
 *   node scripts/check-contrast.mjs
 *
 * Exits 1 on any finding, so CI can run it.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Normal-text AAA rather than the 4.5 floor. A slide is read across a room off
// a projector that lifts the black point, so the margin the floor leaves for a
// document is spent before the first row.
const THRESHOLD = 7;

const root = resolve(import.meta.dirname, '..');

const VARIANTS = [
    { name: 'light', revealTheme: 'white', carve: 'src/theme.css', foreign: '#ffffff' },
    { name: 'dark', revealTheme: 'black', carve: 'src/theme-dark.css', foreign: '#111111' },
];

const SAMPLE = `<section>
<p id="prose">Plain prose on the slide.</p>
<p><mark id="plain">a highlight</mark></p>
<p><mark id="nested">highlight with <ins id="nested-ins">an insert</ins> and <del id="nested-del">a cut</del> and <a id="nested-link" href="#x">a link</a></mark></p>
</section>`;

const page = (variant) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>contrast</title>
<link rel="stylesheet" href="/reveal/reset.css">
<link rel="stylesheet" href="/reveal/reveal.css">
<link rel="stylesheet" href="/reveal/theme/${variant.revealTheme}.css">
<link rel="stylesheet" href="/carve/${variant.carve}">
</head>
<body>
<div class="reveal"><div class="slides">${SAMPLE}</div></div>
</body>
</html>
`;

// Read computed colors back, and read them again with the deck's own prose ink
// forced to a foreign value. The second reading is what catches an ink that is
// inherited rather than owned: a ratio on its own can pass by luck when the
// surrounding theme happens to supply a dark enough color.
const PROBE = `
(() => {
    const read = () => {
        const of = (id) => {
            const node = document.getElementById(id);
            const style = getComputedStyle(node);

            return { color: style.color, background: style.backgroundColor };
        };

        return {
            prose: of('prose'),
            plain: of('plain'),
            nested: of('nested'),
            ins: of('nested-ins'),
            del: of('nested-del'),
            link: of('nested-link'),
            slide: getComputedStyle(document.querySelector('.reveal .slides section')).backgroundColor,
            body: getComputedStyle(document.body).backgroundColor,
        };
    };

    const before = read();

    document.querySelector('.reveal').style.setProperty('--r-main-color', FOREIGN);
    document.querySelectorAll('.reveal, .reveal .slides section, #prose, #plain, #nested')
        .forEach((node) => { node.style.color = ''; });
    document.querySelector('.reveal').style.color = FOREIGN;

    const after = read();

    return { before, after };
})()
`;

function channels(color) {
    const parts = (color.match(/[\d.]+/g) || []).map(Number);

    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function luminance(color) {
    const { r, g, b } = channels(color);
    const channel = (value) => {
        const v = value / 255;

        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(foreground, background) {
    const high = Math.max(luminance(foreground), luminance(background));
    const low = Math.min(luminance(foreground), luminance(background));

    return (high + 0.05) / (low + 0.05);
}

function endpoint(debugPort) {
    return (async () => {
        for (let attempt = 0; attempt < 60; attempt += 1) {
            try {
                const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
                const target = targets.find((entry) => entry.type === 'page');

                if (target) {
                    return target.webSocketDebuggerUrl;
                }
            } catch {
                // still starting
            }

            await new Promise((done) => setTimeout(done, 150));
        }

        throw new Error('check-contrast: no browser.');
    })();
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

        if (result.exceptionDetails) {
            throw new Error(result.exceptionDetails.text);
        }

        return result.result?.value;
    }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

const port = 9900 + Math.floor(Math.random() * 90);
const httpPort = port + 1;

const server = createServer((request, response) => {
    const path = request.url.split('?')[0];
    const variant = VARIANTS.find((entry) => path === `/${entry.name}.html`);

    if (variant) {
        response.writeHead(200, { 'Content-Type': TYPES['.html'] });
        response.end(page(variant));

        return;
    }

    const file = path.startsWith('/reveal/')
        ? join(root, 'node_modules/reveal.js/dist', path.slice('/reveal/'.length))
        : join(root, path.slice('/carve/'.length));
    const stream = createReadStream(file);

    stream.on('error', () => response.writeHead(404).end());
    stream.on('open', () => {
        response.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
        stream.pipe(response);
    });
});

await new Promise((done) => server.listen(httpPort, done));

const profile = await mkdtemp(join(tmpdir(), 'reveal-carve-contrast-'));
const chrome = spawn('google-chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
], { stdio: 'ignore' });

const findings = [];

try {
    const socket = new WebSocket(await endpoint(port));
    await new Promise((done) => socket.addEventListener('open', done, { once: true }));

    const devtools = new Devtools(socket);
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');

    for (const variant of VARIANTS) {
        await devtools.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/${variant.name}.html` });
        await new Promise((done) => setTimeout(done, 600));

        const measured = await devtools.evaluate(
            PROBE.replace(/FOREIGN/g, JSON.stringify(variant.foreign)),
        );
        const report = (assertion, detail) => findings.push({ variant: variant.name, assertion, detail });
        const { before, after } = measured;
        const wash = before.plain.background;
        const contrast = ratio(before.plain.color, wash);

        console.log(`${variant.name}: highlight ${before.plain.color} on ${wash} = ${contrast.toFixed(2)}:1`);
        console.log(`${variant.name}: deck prose ${before.prose.color}, wash against slide ${ratio(wash, before.body).toFixed(2)}:1`);

        if (channels(wash).a < 1) {
            report('the highlight owns an opaque wash', `background-color is ${wash}`);
        }

        if (contrast < THRESHOLD) {
            report(
                `the highlight clears ${THRESHOLD}:1`,
                `${before.plain.color} on ${wash} is ${contrast.toFixed(2)}:1`,
            );
        }

        // The invariant, not the number: moving the deck's own prose ink must
        // not move the highlight's.
        if (after.prose.color === before.prose.color) {
            report(
                'the probe actually moved the deck prose ink',
                `prose stayed ${before.prose.color}, so the independence reading below proves nothing`,
            );
        }

        if (after.plain.color !== before.plain.color) {
            report(
                'the highlight ink does not follow the deck prose ink',
                `became ${after.plain.color} when the deck ink moved to ${variant.foreign}`,
            );
        }

        for (const part of ['ins', 'del', 'link']) {
            if (before[part].color !== before.plain.color) {
                report(
                    `a nested ${part} takes the highlight ink`,
                    `${before[part].color} against the highlight's ${before.plain.color}`,
                );
            }
        }
    }

    socket.close();
} finally {
    chrome.kill('SIGKILL');
    server.close();
    await new Promise((done) => {
        const timer = setTimeout(done, 1000);

        chrome.once('exit', () => {
            clearTimeout(timer);
            done();
        });
    });
    await rm(profile, { recursive: true, force: true }).catch(() => {});
}

for (const finding of findings) {
    console.log(`  ${finding.variant}: FAILED "${finding.assertion}": ${finding.detail}`);
}

console.log(findings.length ? `check-contrast: ${findings.length} finding(s)` : 'check-contrast: clean');
process.exit(findings.length ? 1 : 0);
