import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseHTML } from 'linkedom';

import { markDiffs } from '../src/plugin.js';

function deckOf(html) {
    const { document } = parseHTML(`<div class="reveal">${html}</div>`);
    globalThis.document = document;
    const reveal = document.querySelector('.reveal');

    return { reveal, deck: { getRevealElement: () => reveal } };
}

test('marks the lines of a plain and a captioned diff fence', () => {
    const { reveal } = deckOf(`
        <pre class="diff"><code class="language-php">-a
+b</code></pre>
        <figure id="lst-a" class="diff"><pre><code class="language-php">-c
+d</code></pre><figcaption>Listing 1: x</figcaption></figure>`);
    markDiffs({ getRevealElement: () => reveal });

    const codes = [...reveal.querySelectorAll('code')];
    assert.equal(codes.length, 2);
    for (const code of codes) {
        assert.equal(code.querySelectorAll('.diff-del').length, 1);
        assert.equal(code.querySelectorAll('.diff-add').length, 1);
    }
});

test('leaves fences without the whole diff class alone', () => {
    const { reveal, deck } = deckOf(`
        <figure class="diffs"><pre><code>-a</code></pre></figure>
        <pre class="side-diff"><code>+b</code></pre>
        <figure class="diff"><div><pre><code>-c</code></pre></div></figure>`);
    markDiffs(deck);

    assert.equal(reveal.querySelectorAll('.diff-add, .diff-del').length, 0);
});
