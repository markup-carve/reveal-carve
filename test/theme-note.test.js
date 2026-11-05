import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import * as carve from '@markup-carve/carve';
import { parseHTML } from 'linkedom';

const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');

// Selectors of every rule that mutes text the way the {.note} helper does.
const muting = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, , body]) => /color:\s*var\(--carve-muted\)/.test(body) && /font-size/.test(body))
    .flatMap(([, selectors]) => selectors.split(',').map((selector) => selector.trim()))
    .filter((selector) => !selector.includes('::'));

test('the {.note} helper mutes a paragraph but not a ::: note admonition', () => {
    const html = carve.carveToHtml('{.note}\nAside.\n\n::: note\nWatch this.\n:::\n', { sections: false });
    const { document } = parseHTML(`<html><body><div class="reveal">${html}</div></body></html>`);
    const paragraph = document.querySelector('.reveal > p.note');
    const admonition = document.querySelector('aside.admonition.note');

    assert.ok(paragraph && admonition, html);
    assert.ok(muting.some((selector) => paragraph.matches(selector)), muting.join(' | '));
    assert.ok(!muting.some((selector) => admonition.matches(selector)), muting.join(' | '));
});
