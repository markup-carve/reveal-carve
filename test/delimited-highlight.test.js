import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import * as carve from '@markup-carve/carve';
import { parseHTML } from 'linkedom';

import { buildPage } from '../src/build.js';

const source = '# CSV\n\n```csv\nname,value\na,b\n```\n';
const render = (text) => carve.carveToHtml(text, { sections: false });

async function revealHighlighter(window) {
    globalThis.window = window;
    globalThis.document = window.document;
    const { default: RevealHighlight } = await import('reveal.js/plugin/highlight');

    return RevealHighlight();
}

function highlightedSlide(html, hljs) {
    const { window } = parseHTML(`<html><body>${html}</body></html>`);
    const code = window.document.querySelector('code.language-csv');
    assert.ok(code, 'the slide has a CSV fence');
    hljs.highlightElement(code);
    assert.match(code.innerHTML, /hljs-attr">name<\/span><span class="hljs-operator">,<\/span>/);
    assert.match(code.innerHTML, /hljs-string">a<\/span><span class="hljs-operator">,<\/span>/);
}

test('the runtime plugin registers the languages with Reveal Highlight', async () => {
    const { window } = parseHTML('<html><head></head><body><div class="reveal"><div class="slides"></div></div></body></html>');
    const highlighter = await revealHighlighter(window);
    const { default: RevealCarve } = await import('../src/plugin.js');
    const reveal = window.document.querySelector('.reveal');
    const deck = {
        getPlugin: (name) => name === 'highlight' ? highlighter : null,
        getConfig: () => ({}),
        getRevealElement: () => reveal,
    };
    await RevealCarve().init(deck);
    for (const language of ['carve', 'csv', 'tsv']) {
        assert.ok(highlighter.hljs.getLanguage(language), language);
    }
    highlightedSlide(render(source), highlighter.hljs);
});

test('a static page registers languages before Reveal highlights its CSV slide', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'reveal-carve-delimited-'));
    const input = join(directory, 'deck.crv');
    const output = join(directory, 'deck.html');
    writeFileSync(input, source);
    buildPage({ source: input, target: output, render });
    const page = readFileSync(output, 'utf8');
    const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    let options;
    const context = {
        Reveal: { initialize: (value) => { options = value; } },
        RevealHighlight: {},
        RevealNotes: {},
    };
    context.globalThis = context;
    for (const script of scripts) {
        runInNewContext(script, context);
    }
    const { window } = parseHTML('<html><head></head><body></body></html>');
    const highlighter = await revealHighlighter(window);
    options.highlight.beforeHighlight(highlighter.hljs);
    for (const language of ['carve', 'csv', 'tsv']) {
        assert.ok(highlighter.hljs.getLanguage(language), language);
    }
    highlightedSlide(page, highlighter.hljs);
    assert.match(page, /\.hljs-operator \{ color: #fd971f; font-weight: 700; \}/);
});
