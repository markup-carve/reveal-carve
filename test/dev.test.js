/**
 * The development server and the deck scaffold.
 *
 * Both run on a presenter's machine minutes before a talk, and neither is
 * covered by the DOM tests: a server that stops reloading, or a scaffold that
 * does not lint, is found at the worst possible moment.
 */

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { serve } from '../src/dev.js';
import { initDeck } from '../src/init.js';
import { KNOWN_DIRECTIVES } from '../src/lint.js';

const root = mkdtempSync(join(tmpdir(), 'reveal-carve-dev-'));

writeFileSync(join(root, 'index.html'), '<html><body>deck</body></html>', 'utf8');
writeFileSync(join(root, 'deck.crv'), '# Slide\n', 'utf8');

const port = 8900 + Math.floor(Math.random() * 90);
const server = serve({ root, port, watch: ['.'], log: () => {} });

await new Promise((done) => server.once('listening', done));

after(() => server.close());

const get = (path) => fetch(`http://127.0.0.1:${port}${path}`);

test('serves the index and injects the reload listener', async () => {
    const response = await get('/');
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(body, /EventSource\('\/__reload'\)/);
});

test('serves a deck source as text, and does not touch it', async () => {
    const response = await get('/deck.crv');

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/plain/);
    assert.equal(await response.text(), '# Slide\n');
});

test('answers a missing file with 404 rather than a stack trace', async () => {
    const response = await get('/nothing.html');

    assert.equal(response.status, 404);
});

test('refuses to serve a path outside the root', async () => {
    const response = await get('/../../etc/passwd');

    assert.ok(response.status === 403 || response.status === 404, `got ${response.status}`);
});

test('tells an open page to reload when a file changes', async () => {
    // node:http rather than fetch: the reload stream never ends, and a fetch
    // body left open keeps the test runner alive after the assertions pass.
    const { get: httpGet } = await import('node:http');

    const reload = await new Promise((done) => {
        httpGet({ host: '127.0.0.1', port, path: '/__reload' }, done);
    });

    assert.equal(reload.headers['content-type'], 'text/event-stream');

    const said = new Promise((done) => {
        let seen = '';

        reload.on('data', (chunk) => {
            seen += chunk.toString();

            if (seen.includes('data: reload')) {
                done(true);
            }
        });

        setTimeout(() => done(false), 4000);
    });

    writeFileSync(join(root, 'deck.crv'), '# Slide\n\n---\n\n# Another\n', 'utf8');

    const told = await said;

    reload.destroy();
    assert.equal(told, true, 'the page was never told to reload');
});

test('the scaffold writes a deck that lints and builds', async () => {
    const target = mkdtempSync(join(tmpdir(), 'reveal-carve-init-'));
    const written = initDeck(target);

    assert.deepEqual(written, [
        'slides/010-opening.crv',
        'slides/020-chapter.crv',
        'slides/partials/thanks.crv',
        'README.md',
    ]);

    const opening = readFileSync(join(target, 'slides/010-opening.crv'), 'utf8');

    for (const directive of opening.matchAll(/^%%\s*([a-z]+)/gm)) {
        assert.ok(
            KNOWN_DIRECTIVES.includes(directive[1]),
            `the scaffold uses %% ${directive[1]}, which the linter does not know`,
        );
    }

    const { buildSlides } = await import('../src/build.js');
    const carve = await import('@markup-carve/carve');
    const { fileSystemResolver } = await import('@markup-carve/carve/node');
    const slides = buildSlides(join(target, 'slides'), (text) => carve.carveToHtml(text, { sections: false }), {
        engine: carve,
        resolver: fileSystemResolver,
    });

    assert.match(slides, /<h2[^>]*>Thank you<\/h2>/, 'the included partial did not reach the deck');
    assert.equal(/\{\{/.test(slides), false, 'an include was left unexpanded');
});

test('writes nothing over an existing file', () => {
    const target = mkdtempSync(join(tmpdir(), 'reveal-carve-init-'));

    mkdirSync(join(target, 'slides'), { recursive: true });
    writeFileSync(join(target, 'slides/010-opening.crv'), 'mine\n', 'utf8');

    const written = initDeck(target);

    assert.equal(written.includes('slides/010-opening.crv'), false);
    assert.equal(readFileSync(join(target, 'slides/010-opening.crv'), 'utf8'), 'mine\n');
});
