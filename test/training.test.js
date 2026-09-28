import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { initDeck } from '../src/init.js';
import { managedRenderers, rendererNames, rendererAssets } from '../src/renderers.js';
import { buildSlides } from '../src/build.js';
import * as carve from '@markup-carve/carve';
import { fileSystemResolver } from '@markup-carve/carve/node';
import { extensionSpec, resolveExtensions } from '../src/extensions.js';

function temporary(t) {
    const dir = mkdtempSync(join(tmpdir(), 'carve-training-test-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
}

test('training scaffold renders its chapters and preserves edited files on repeat init', (t) => {
    const dir = temporary(t);
    initDeck(dir, { preset: 'training' });
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json')));
    assert.ok(manifest.dependencies.mermaid);
    assert.ok(manifest.dependencies.katex);
    const extensions = resolveExtensions(extensionSpec(['mermaid', 'mathBlock']), carve);
    const html = buildSlides(join(dir, 'slides'), (text) => carve.carveToHtml(text, { extensions }), {
        engine: carve, resolver: fileSystemResolver,
    });
    assert.match(html, /class="mermaid"/);
    assert.match(html, /class="math display"/);
    assert.match(html, /Take this into your next workshop/);
    assert.match(html, /layout-code/);
    writeFileSync(join(dir, 'slides/010-opening.crv'), '# My workshop');
    assert.deepEqual(initDeck(dir, { preset: 'training' }), []);
    assert.equal(readFileSync(join(dir, 'slides/010-opening.crv'), 'utf8'), '# My workshop');
});

test('invalid presets and renderer selections fail before writing a starter', (t) => {
    const dir = temporary(t);
    assert.throws(() => initDeck(dir, { preset: 'unknown' }), /Unknown preset/);
    assert.throws(() => initDeck(dir, { preset: 'training', renderers: ['katex'] }), /needs --with/);
    assert.throws(() => rendererNames(''), /requires a value/);
    assert.throws(() => rendererNames('mermaid,unknown'), /Unknown renderer/);
    assert.deepEqual(rendererNames('mermaid,mermaid,katex'), ['mermaid', 'katex']);
    assert.deepEqual(rendererAssets(join(dir, 'deck.html'), []), { scripts: [], stylesheets: [], plugin: '' });
});

test('managed renderers finish hidden diagrams and formulas before initialization resolves', async (t) => {
    const { window, document } = parseHTML('<html><body><div class="slides"><section style="display:none"><pre class="mermaid">graph LR; A-->B</pre><div class="math display">\\[ x + 1 \\]</div></section></div></body></html>');
    t.mock.method(globalThis, 'fetch', () => { throw new Error('No network allowed'); });
    const oldWindow = globalThis.window;
    const oldDocument = globalThis.document;
    globalThis.window = window;
    globalThis.document = document;
    t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument; });
    let release;
    document.fonts = { ready: new Promise((done) => { release = done; }) };
    window.mermaid = {
        initialize(options) { assert.equal(options.startOnLoad, false); },
        async render(id, source) {
            assert.match(source, /A-->B/);
            return { svg: '<svg><text>A to B</text></svg>' };
        },
    };
    window.katex = { render(source, block, options) {
        assert.equal(source.trim(), 'x + 1');
        assert.equal(options.displayMode, true);
        block.textContent = 'formula rendered';
    } };
    const ready = managedRenderers(['mermaid', 'katex']).init({ getSlidesElement: () => document.querySelector('.slides') });
    await new Promise((done) => setImmediate(done));
    assert.equal(window.carveRenderers.ready, false);
    assert.ok(document.querySelector('svg'));
    release();
    await ready;
    assert.equal(window.carveRenderers.ready, true);
    delete window.katex;
    t.mock.method(console, 'error', () => {});
    await assert.rejects(managedRenderers(['katex']).init({ getSlidesElement: () => document.querySelector('.slides') }), /npm install katex/);
    assert.match(document.querySelector('.carve-renderer-error').textContent, /KaTeX failed/);
    assert.match(window.carveRenderers.error, /KaTeX failed/);
});
