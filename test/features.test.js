import assert from 'node:assert/strict';
import { test } from 'node:test';

import { animateListItems, errorSlide, keepInlineCodeMarkup, moveCodeAttributes, renderDeck, renderSlide, splitAtHeading, unwrapSections } from '../src/slice.js';
import { IncludeError, expandIncludes, hasIncludes } from '../src/include.js';
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

test('expands an include through the engine and reports the dependency', () => {
    const engine = {
        parse: (text) => ({ text }),
        renderCarve: (doc) => doc.text.replace('{{ part.crv }}', 'included text'),
        expandIncludes: (doc, source) => ({
            doc,
            dependencies: [{ id: '/deck/part.crv', resolved: true }],
            warnings: [],
        }),
    };

    const out = expandIncludes('before\n{{ part.crv }}\nafter\n', {
        from: '/deck/main.crv',
        engine,
        resolver: () => () => ({ source: 'included text' }),
    });

    assert.match(out.source, /included text/);
    assert.deepEqual(out.dependencies, [{ id: '/deck/part.crv', resolved: true }]);
});

test('reports an include the engine could not resolve', () => {
    const engine = {
        parse: (text) => ({ text }),
        renderCarve: (doc) => doc.text,
        expandIncludes: () => ({
            doc: {},
            dependencies: [{ id: 'gone.crv', resolved: false }],
            warnings: [],
        }),
    };

    assert.throws(
        () => expandIncludes('{{ gone.crv }}\n', {
            from: '/deck/main.crv',
            engine,
            resolver: () => () => null,
        }),
        /could not be resolved: gone.crv/,
    );
});

test('refuses to guess when the engine cannot expand includes', () => {
    assert.throws(
        () => expandIncludes('{{ a.crv }}\n', { from: '/x.crv', engine: {}, resolver: () => {} }),
        /cannot expand includes/,
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

test('a footnote definition follows the slide that references it', () => {
    const slides = renderDeck('A[^1]\n\n---\n\nB\n\n[^1]: The note\n', (text) => text, {});

    assert.match(slides[0], /\[\^1\]: The note/);
    assert.ok(!slides[1].includes('The note'));
});

test('an unreferenced footnote definition is dropped rather than shown alone', () => {
    const slides = renderDeck('A\n\n[^unused]: Nobody points here\n', (text) => text, {});

    assert.ok(!slides.join('').includes('Nobody points here'));
});

test('footnote handling can be switched off', () => {
    const slides = renderDeck('A[^1]\n\n[^1]: The note\n', (text) => text, { footnotes: false });

    assert.match(slides[0], /\[\^1\]: The note/);
});

test('the plugin works on a prebuilt page, with no engine present', async () => {
    const { default: plugin } = await import('../src/plugin.js');
    const calls = [];
    const element = {
        querySelectorAll: () => [],
        parentNode: {
            querySelector: () => null,
            insertBefore: () => calls.push('footer'),
        },
        nextSibling: null,
    };
    const deck = {
        getConfig: () => ({ carve: {} }),
        getRevealElement: () => element,
    };

    // No window.carve anywhere: this used to throw before the first slide showed.
    await plugin().init(deck);

    assert.deepEqual(calls, []);
});

test('endnotes survive unwrapping, as an aside', () => {
    const html = unwrapSections(
        '<section id="T"><h2>T</h2><p>a</p></section>'
        + '<section role="doc-endnotes" aria-label="Footnotes"><ol><li>n</li></ol></section>',
    );

    // A section here would be positioned absolutely by reveal and land on top
    // of the slide's own content.
    assert.ok(!html.includes('<section'));
    assert.match(html, /<aside role="doc-endnotes" aria-label="Footnotes"><ol><li>n<\/li><\/ol><\/aside>/);
    assert.match(html, /<h2>T<\/h2>/);
});

test('a slide with no endnotes is unwrapped cleanly', () => {
    assert.equal(unwrapSections('<section id="T"><h2>T</h2></section>'), '<h2>T</h2>');
});

test('a code block with callouts opts out of the highlighter escaping', () => {
    const html = keepInlineCodeMarkup(
        '<pre><code class="language-php">x <b class="callout" data-callout="1">1</b></code></pre>',
    );

    assert.match(html, /<code data-noescape class="language-php">/);
});

test('a plain code block is left alone', () => {
    const input = '<pre><code class="language-php">x</code></pre>';

    assert.equal(keepInlineCodeMarkup(input), input);
});

test('a version marker is appended to local assets only', () => {
    const html = buildPageHtml({
        version: 'abc123',
        stylesheets: ['local.css', 'https://cdn.example.com/remote.css'],
    });

    assert.match(html, /local\.css\?v=abc123/);
    assert.match(html, /reveal\.css\?v=abc123/);
    assert.ok(!html.includes('remote.css?v='));
});

test('without a version the urls are untouched', () => {
    const html = buildPageHtml({ stylesheets: ['local.css'] });

    assert.ok(!html.includes('?v='));
});

test('a static-mode panel keeps its class as a div', () => {
    const html = unwrapSections(
        '<section class="tabs-panel"><h3 class="tabs-label">A</h3><p>a</p></section>',
    );

    assert.equal(html, '<div class="tabs-panel"><h3 class="tabs-label">A</h3><p>a</p></div>');
});

test('nested heading wrappers inside a kept section are still unwrapped', () => {
    const html = unwrapSections(
        '<section class="tabs-panel"><section id="A"><h3>A</h3></section></section>',
    );

    assert.equal(html, '<div class="tabs-panel"><h3>A</h3></div>');
});
