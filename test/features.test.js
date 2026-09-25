import assert from 'node:assert/strict';
import { test } from 'node:test';

import { animateListItems, errorSlide, flattenDiagramFences, keepInlineCodeMarkup, moveCodeAttributes, restoreDataFences, renderDeck, renderSlide, splitAtHeading, unwrapSections } from '../src/slice.js';
import { IncludeError, expandIncludes, hasIncludes } from '../src/include.js';
import { KNOWN_DIRECTIVES, formatFindings, lintSource } from '../src/lint.js';
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

test('handout fills a toc slide with the agenda, since nothing else will', () => {
    const source = [
        '# Deck',
        '',
        '---',
        '',
        '%% toc',
        '',
        '## Agenda',
        '',
        '---',
        '',
        '%% minutes: 5',
        '',
        '## 1. Numbered section',
        '',
        'Body.',
        '',
    ].join('\n');

    const markdown = buildHandout(source, (text) => text.trim());

    assert.match(markdown, /## Agenda/);
    assert.match(markdown, /- Deck/);
    // The marker is escaped, or the entry opens an ordered list inside the bullet.
    assert.match(markdown, /- 1\\\. Numbered section \(5 min\)/);
    assert.equal(markdown.includes('- Agenda'), false, 'the agenda listed itself');
});

test('handout agenda follows %% toc: chapters when the deck does', () => {
    const source = [
        '%% toc: chapters',
        '',
        '## Agenda',
        '',
        '---',
        '',
        '%% chapter: Intro',
        '',
        '%% minutes: 10',
        '',
        '## First',
        '',
        '---',
        '',
        '%% minutes: 5',
        '',
        '## Still intro',
        '',
        '---',
        '',
        '%% chapter: ORM',
        '',
        '%% minutes: 20',
        '',
        '## Queries',
        '',
    ].join('\n');

    const markdown = buildHandout(source, (text) => text.trim());

    assert.match(markdown, /- Intro \(15 min\)/);
    assert.match(markdown, /- ORM \(20 min\)/);
    assert.equal(markdown.includes('- First'), false, 'chapter mode listed a slide heading');
});

test('lint flags a code line too wide for a slide, and only inside a fence', () => {
    const wide = 'x'.repeat(120);
    const inFence = lintSource(`# Slide\n\n${'FENCE'}php\n${wide}\n${'FENCE'}\n`.replace(/FENCE/g, '```'));
    const inProse = lintSource(`# Slide\n\nA sentence with [brackets] and ${wide}\n`);

    assert.equal(inFence.some((finding) => finding.code === 'code-too-wide'), true);
    assert.equal(inProse.some((finding) => finding.code === 'code-too-wide'), false);
});

test('lint flags a slide with no heading and a wall of text', () => {
    const findings = lintSource(`${'word '.repeat(120)}\n`);
    const codes = findings.map((finding) => finding.code);

    assert.ok(codes.includes('slide-without-heading'), codes.join(','));
    assert.ok(codes.includes('slide-too-long'), codes.join(','));
});

test('findings are formatted with the file, the level and the code', () => {
    assert.equal(formatFindings('deck.crv', []), 'deck.crv: ok');

    const text = formatFindings('deck.crv', lintSource('%% notez\n\nbody\n'));

    assert.match(text, /^deck\.crv:\d+: warning: .*\[unknown-directive\]$/);
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

test('a static-mode diagram fence is handed to its renderer as text', () => {
    const html = flattenDiagramFences(
        '<pre class="mermaid"><code class="language-mermaid">graph LR\n  A --&gt; B\n</code></pre>',
    );

    assert.equal(html, '<pre class="mermaid">graph LR\n  A --> B</pre>');
});

test('an ordinary code block is not touched', () => {
    const input = '<pre><code class="language-php">$a &gt; 1;</code></pre>';

    assert.equal(flattenDiagramFences(input), input);
});

test('a slide with a spoiler is repeated with it open', () => {
    const slides = renderDeck('body', () => '<p><span class="spoiler">x</span></p>', {
        revealSpoilers: true,
    });

    assert.equal(slides.length, 1);
    assert.equal(slides[0].match(/<section/g).length, 2);
    assert.match(slides[0], /<section class="spoilers-open">/);
});

test('a slide without a spoiler is left alone', () => {
    const slides = renderDeck('body', () => '<p>x</p>', { revealSpoilers: true });

    assert.equal(slides[0].match(/<section/g).length, 1);
});

test('spoiler repetition is off unless asked for', () => {
    const slides = renderDeck('body', () => '<p><span class="spoiler">x</span></p>', {});

    assert.equal(slides[0].match(/<section/g).length, 1);
});

test('a static-mode chart fence becomes a json holder again', () => {
    const html = restoreDataFences(
        '<pre class="chart"><code class="language-chart">{&quot;type&quot;:&quot;bar&quot;}</code></pre>',
    );

    assert.match(html, /<div class="chart" role="img" aria-label="chart">/);
    assert.match(html, /<script type="application\/json">\{"type":"bar"\}<\/script>/);
});

test('a long agenda is split across slides, each with the heading', () => {
    const many = Array.from({ length: 20 }, (_, i) => `## Slide ${i + 1}`).join('\n\n---\n\n');
    const slides = renderDeck(`%% toc\n\n## Agenda\n\n---\n\n${many}\n`, (text) => text, {
        tocPerSlide: 8,
    });

    const agenda = slides.filter((slide) => slide.includes('Agenda'));

    assert.equal(agenda.length, 3);
    assert.match(agenda[1], /## Agenda/);
});

test('a short agenda stays on one slide and skips the columns', () => {
    const slides = renderDeck('%% toc\n\n## Agenda\n\n---\n\n## One\n\n---\n\n## Two\n', (t) => t);

    assert.equal(slides.filter((slide) => slide.includes('Agenda')).length, 1);
    assert.ok(!slides[0].includes('columns-2'));
});

test('the agenda asks for two columns as a class, not an attribute', () => {
    const many = Array.from({ length: 10 }, (_, i) => `## S${i}`).join('\n\n---\n\n');
    const slides = renderDeck(`%% toc\n\n## Agenda\n\n---\n\n${many}\n`, (text) => text);

    assert.match(slides[0], /\{\.toc-list \.columns-2\}/);
});


test('a numbered heading does not open a list inside the agenda bullet', () => {
    const slides = renderDeck(
        '%% toc\n\n## Agenda\n\n---\n\n## 1. Code\n\n---\n\n## 2. Layout\n',
        (text) => text,
    );

    assert.ok(slides[0].includes('- 1\\. Code'));
    assert.ok(slides[0].includes('- 2\\. Layout'));
});

test('a heading starting with a dash is escaped too', () => {
    const slides = renderDeck('%% toc\n\n## Agenda\n\n---\n\n## - odd title\n', (text) => text);

    assert.ok(slides[0].includes('- \\- odd title'));
});
