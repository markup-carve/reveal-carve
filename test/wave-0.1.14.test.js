/**
 * Readings from the carve 0.1.14 spec wave that reach a deck. They need the
 * engine and grammar releases after carve 0.1.15 and carve-grammars 0.1.22.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as carve from '@markup-carve/carve';
import { parseHTML } from 'linkedom';

import { registerCarveLanguages } from '../src/highlight.js';
import { importMarkdownDeck } from '../src/import.js';
import { renderDeck } from '../src/slice.js';

const render = (text) => carve.carveToHtml(text, { sections: false });

test('import writes braced table alignment, admonitions for GitHub alerts and Carve comments', () => {
    const markdown = [
        '## Prices',
        '',
        '> [!NOTE]',
        '> Watch this.',
        '',
        '<!-- speaker aside -->',
        '',
        '| Item | Price |',
        '|:--|--:|',
        '| Tea | 2 |',
        '',
    ].join('\n');
    const { source } = importMarkdownDeck(markdown, { engine: carve });

    assert.match(source, /^::: note\nWatch this\.\n:::$/m);
    assert.match(source, /^%% speaker aside$/m);
    assert.match(source, /^\|=\{<\} Item \|=\{>\} Price \|$/m);
    assert.doesNotMatch(source, /\|=[<>~]/);
});

test('a slide renders braced cell alignment', () => {
    const [slide] = renderDeck('|={<} Item |={>} Price |\n| Tea |{~} 2 |\n', render);

    assert.match(slide, /<th scope="col" style="text-align: left;">Item<\/th>/);
    assert.match(slide, /<th scope="col" style="text-align: right;">Price<\/th>/);
    assert.match(slide, /<td style="text-align: center;">2<\/td>/);
});

test('deck highlighting scopes braced alignment like the glued markers', async () => {
    const { window } = parseHTML('<html><head></head><body><div class="reveal"><div class="slides"></div></div></body></html>');
    globalThis.window = window;
    globalThis.document = window.document;
    const { default: RevealHighlight } = await import('reveal.js/plugin/highlight');
    const hljs = RevealHighlight().hljs;
    registerCarveLanguages(hljs);

    for (const source of ['|={>} Qty |= Name |\n', '|{>} 12 | x |\n']) {
        const { document: code } = parseHTML(`<code>${hljs.highlight(source, { language: 'carve' }).value}</code>`);

        assert.equal(code.querySelector('.hljs-table-alignment')?.textContent, '>', source);
    }
});
