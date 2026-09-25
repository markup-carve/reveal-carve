import assert from 'node:assert/strict';
import { test } from 'node:test';

import { animateListItems, errorSlide, moveCodeAttributes, renderDeck, renderSlide, splitAtHeading } from '../src/slice.js';
import { IncludeError, hasIncludes, resolveIncludes } from '../src/include.js';
import { KNOWN_DIRECTIVES, lintSource } from '../src/lint.js';
import { buildHandout } from '../src/handout.js';
import { buildPage } from '../src/build.js';

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// buildPage writes a file, so the page assertions go through a temp directory.
function buildPageHtml(options) {
    const dir = mkdtempSync(join(tmpdir(), 'reveal-carve-'));
    const source = join(dir, 'deck.crv');
    const target = join(dir, 'deck.html');
    writeFileSync(source, '# Title\n', 'utf8');
    buildPage({ source, target, render, ...options });

    return readFileSync(target, 'utf8');
}

const render = (text) => `<p>${text.trim()}</p>`;

test('moves reveal code attributes from pre to code', () => {
    const html = moveCodeAttributes('<pre data-line-numbers="1|2"><code class="language-php">x</code></pre>');

    assert.equal(html, '<pre><code data-line-numbers="1|2" class="language-php">x</code></pre>');
});

test('leaves a pre without reveal attributes alone', () => {
    const input = '<pre class="x"><code>y</code></pre>';

    assert.equal(moveCodeAttributes(input), input);
});

test('animates the items of a list marked with the plural class', () => {
    const html = animateListItems('<ul class="fragments"><li>a</li><li>b</li></ul>');

    assert.equal(html, '<ul><li class="fragment">a</li><li class="fragment">b</li></ul>');
});

test('leaves a singular fragment list as one step', () => {
    const input = '<ul class="fragment"><li>a</li><li>b</li></ul>';

    assert.equal(animateListItems(input, { all: true }), input);
});

test('leaves an unmarked list alone', () => {
    const input = '<ul><li>a</li></ul>';

    assert.equal(animateListItems(input), input);
});

test('the fragments directive animates every list on that slide', () => {
    const listRender = () => '<ul><li>a</li><li>b</li></ul>';
    const html = renderSlide('%% fragments\n\n- a\n- b\n', listRender);

    assert.equal(html.match(/class="fragment"/g).length, 2);
});

test('a failing render becomes a visible error slide', () => {
    const boom = () => {
        throw new Error('unbalanced container');
    };
    const html = renderSlide('broken', boom);

    assert.match(html, /class="carve-error"/);
    assert.match(html, /unbalanced container/);
});

test('strict mode rethrows instead of rendering an error slide', () => {
    const boom = () => {
        throw new Error('nope');
    };

    assert.throws(() => renderSlide('x', boom, { throwOnError: true }), /nope/);
});

test('error slides escape the offending source', () => {
    const html = errorSlide(new Error('bad'), '<script>alert(1)</script>');

    assert.ok(!html.includes('<script>'));
    assert.match(html, /&lt;script&gt;/);
});

test('splits at a heading level when asked', () => {
    const chunks = splitAtHeading('## One\n\ntext\n\n## Two\n\nmore\n', 2);

    assert.equal(chunks.length, 2);
    assert.match(chunks[1], /^## Two/);
});

test('deck rendering honors splitAtHeading', () => {
    const slides = renderDeck('## One\n\n## Two\n', render, { splitAtHeading: 2 });

    assert.equal(slides.length, 2);
});

test('resolves an include relative to the including file', () => {
    const files = { '/deck/part.crv': 'included text' };
    const read = (path) => {
        if (!files[path]) {
            throw new Error('missing');
        }

        return files[path];
    };

    const out = resolveIncludes('before\n{{ part.crv }}\nafter\n', {
        from: '/deck/main.crv',
        read,
    });

    assert.match(out, /included text/);
});

test('refuses an include outside the root', () => {
    assert.throws(
        () => resolveIncludes('{{ ../secret.crv }}\n', { from: '/deck/main.crv', read: () => 'x' }),
        IncludeError,
    );
});

test('refuses an include cycle', () => {
    const read = () => '{{ main.crv }}';

    assert.throws(
        () => resolveIncludes('{{ main.crv }}\n', { from: '/deck/main.crv', read }),
        /cycle/,
    );
});

test('reports a missing include by name', () => {
    assert.throws(
        () => resolveIncludes('{{ gone.crv }}\n', {
            from: '/deck/main.crv',
            read: () => {
                throw new Error('ENOENT');
            },
        }),
        /include not found: gone.crv/,
    );
});

test('detects whether a source has includes at all', () => {
    assert.equal(hasIncludes('{{ a.crv }}'), true);
    assert.equal(hasIncludes('plain text'), false);
});

test('lints a mistyped directive, which is otherwise a silent comment', () => {
    const findings = lintSource('%% notez\n\nbody\n');

    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'unknown-directive');
});

test('accepts every documented directive', () => {
    for (const name of KNOWN_DIRECTIVES) {
        assert.equal(lintSource(`%% ${name}: value\n\nbody\n`).length, 0, name);
    }
});

test('flags a slide carrying too much prose', () => {
    const wall = `## Heading\n\n${'word '.repeat(120)}`;
    const codes = lintSource(wall).map((finding) => finding.code);

    assert.ok(codes.includes('slide-too-long'));
});

test('builds a handout with the spoken notes quoted', () => {
    const markdown = buildHandout('# Title\n\n%% notes\n\nSaid out loud\n', (text) => text.trim());

    assert.match(markdown, /# Title/);
    assert.match(markdown, /> Said out loud/);
});

test('handout can leave the notes out', () => {
    const markdown = buildHandout('# Title\n\n%% notes\n\nSecret\n', (text) => text.trim(), {
        notes: false,
    });

    assert.ok(!markdown.includes('Secret'));
});

test('the built page carries a footer only when one is configured', () => {
    const withFooter = buildPageHtml({ footer: '<a href="x">Overview</a>' });
    const without = buildPageHtml({});

    assert.match(withFooter, /<footer class="deck-footer"><a href="x">Overview<\/a><\/footer>/);
    assert.ok(!without.includes('deck-footer'));
});

test('a built page gets the same reveal defaults as a hand-written one', () => {
    const html = buildPageHtml({});

    assert.match(html, /"hash": true/);
    assert.match(html, /"slideNumber": "c\/t"/);
});

test('the deck author can override a default', () => {
    const html = buildPageHtml({ config: { slideNumber: false, transition: 'none' } });

    assert.match(html, /"slideNumber": false/);
    assert.match(html, /"transition": "none"/);
});
