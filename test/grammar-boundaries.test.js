import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as carve from '@markup-carve/carve';
import { parseHTML } from 'linkedom';

import { registerCarveLanguages } from '../src/highlight.js';

async function highlighter() {
    const { window } = parseHTML('<html><head></head><body><div class="reveal"><div class="slides"></div></div></body></html>');
    globalThis.window = window;
    globalThis.document = window.document;
    const { default: RevealHighlight } = await import('reveal.js/plugin/highlight');
    const hljs = RevealHighlight().hljs;
    registerCarveLanguages(hljs);
    return hljs;
}

function highlighted(source, hljs) {
    const html = carve.carveToHtml('```carve\n' + source + '```\n', { sections: false });
    const { window } = parseHTML(`<html><head></head><body>${html}</body></html>`);
    const code = window.document.querySelector('code.language-carve');
    assert.ok(code);
    hljs.highlightElement(code);
    assert.equal(code.textContent, source);
    return code;
}

test('Reveal highlighting keeps lazy markers, lists and footnote descriptions distinct', async () => {
    const hljs = await highlighter();
    assert.equal(highlighted('a\n: \n', hljs).querySelector('.hljs-bullet, .hljs-title'), null);
    assert.equal(highlighted('a\n\n- x\n', hljs).querySelector('.hljs-bullet')?.textContent, '-');
    const footnote = highlighted('[^a]:\n    :: term\n    : desc\n', hljs);
    assert.match(footnote.querySelector('.hljs-title')?.textContent ?? '', /:: term/);
    assert.equal(footnote.querySelector('.hljs-punctuation')?.textContent, '    :');
});
