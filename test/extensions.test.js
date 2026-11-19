import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    canonicalName,
    DEFAULT_EXTENSIONS,
    extensionSpec,
    missingRenderers,
    parseExtensionArgument,
    resolveExtensions,
} from '../src/extensions.js';
import { deckMinutes, headingOf, parseSlide, renderDeck, renderSlide } from '../src/slice.js';

const render = (text) => `<p>${text.trim()}</p>`;

const engine = {
    mermaid: (options) => ({ name: 'mermaid', options }),
    smartQuotes: (options) => ({ name: 'smartQuotes', options }),
    tableOfContents: (options) => ({ name: 'tableOfContents', options }),
};

test('resolves extension names against the engine', () => {
    const [first] = resolveExtensions(['mermaid'], engine);

    assert.equal(first.name, 'mermaid');
});

test('maps friendly aliases to engine names', () => {
    assert.equal(canonicalName('toc'), 'tableOfContents');
    assert.equal(canonicalName('smart-quotes'), 'smartQuotes');
});

test('refuses an unknown extension by name', () => {
    assert.throws(() => resolveExtensions(['nonsense'], engine), /unknown Carve extension/);
});

test('parses a bare CLI extension name', () => {
    assert.equal(parseExtensionArgument('mermaid'), 'mermaid');
});

test('parses a locale shorthand for smart quotes', () => {
    assert.deepEqual(parseExtensionArgument('smartQuotes:de'), {
        name: 'smartQuotes',
        options: { locale: 'de' },
    });
});

test('parses JSON options', () => {
    assert.deepEqual(parseExtensionArgument('tableOfContents:{"maxLevel":2}'), {
        name: 'tableOfContents',
        options: { maxLevel: 2 },
    });
});

test('names the extensions that still need a renderer on the page', () => {
    assert.deepEqual(missingRenderers(['mermaid', 'smartQuotes']), ['mermaid']);
});

test('the animate directive marks the slide for auto-animate', () => {
    assert.match(renderSlide('%% animate\n\nBody\n', render), /<section data-auto-animate>/);
});

test('the minutes directive lands on the section', () => {
    assert.match(renderSlide('%% minutes: 7\n\nBody\n', render), /data-minutes="7"/);
});

test('minutes do not leak into the slide body', () => {
    assert.equal(parseSlide('%% minutes: 7\n\nBody\n').body, 'Body');
});

test('reads the first heading of a slide', () => {
    assert.equal(headingOf('## Chapter two\n\ntext\n'), 'Chapter two');
});

test('sums the planned minutes of a deck', () => {
    const plan = deckMinutes('%% minutes: 20\n\n## A\n\n---\n\n%% minutes: 40\n\n## B\n');

    assert.equal(plan.total, 60);
    assert.equal(plan.planned, 2);
});

test('a toc slide lists the other slides', () => {
    const slides = renderDeck('%% toc\n\n## Agenda\n\n---\n\n## First\n\n---\n\n## Second\n', render);

    assert.match(slides[0], /First/);
    assert.match(slides[0], /Second/);
    assert.ok(!slides[1].includes('Agenda'));
});

test('a toc slide carries the planned minutes alongside each entry', () => {
    const slides = renderDeck('%% toc\n\n## Agenda\n\n---\n\n%% minutes: 15\n\n## First\n', render);

    assert.match(slides[0], /First \[15 min\]/);
});

test('a deck without headings leaves a toc slide untouched', () => {
    const slides = renderDeck('%% toc\n\n## Agenda\n', render);

    assert.match(slides[0], /Agenda/);
});


const nameOf = (entry) => (typeof entry === 'string' ? entry : entry.name);

test('a deck that asks for nothing still gets the markup-only extensions', () => {
    assert.deepEqual(extensionSpec().map(nameOf), DEFAULT_EXTENSIONS);
});

test('nothing that needs a script on the page is on by default', () => {
    const defaults = new Set(DEFAULT_EXTENSIONS);

    for (const name of ['mermaid', 'chart', 'mathBlock', 'vegaLite', 'graphviz', 'smartQuotes', 'imgFence']) {
        assert.equal(defaults.has(name), false, `${name} is on by default`);
    }
});

test('what the deck asks for wins over the default spelling of it', () => {
    const spec = extensionSpec([{ name: 'tabs', options: { mode: 'aria' } }]);
    const tabs = spec.filter((entry) => nameOf(entry) === 'tabs');

    assert.equal(tabs.length, 1);
    assert.deepEqual(tabs[0].options, { mode: 'aria' });
});

test('a default can be turned off by name, alias included', () => {
    const spec = extensionSpec([], ['spoiler', 'code-group']).map(nameOf);

    assert.equal(spec.includes('spoiler'), false);
    assert.equal(spec.includes('codeGroup'), false);
    assert.equal(spec.includes('tabs'), true);
});

test('core only means core only', () => {
    assert.deepEqual(extensionSpec(false), []);
    assert.deepEqual(extensionSpec(false, []), []);
});

test('a default the engine does not carry is skipped, not fatal', () => {
    // An engine with none of them: an older Carve, or a trimmed browser build.
    assert.deepEqual(resolveExtensions(extensionSpec(), engine), []);
    assert.throws(() => resolveExtensions(extensionSpec(['nonsense']), engine), /unknown Carve extension/);
});

test('the renderer warning counts the defaults too, not only what was asked for', () => {
    assert.deepEqual(missingRenderers(extensionSpec(['mermaid'])), ['mermaid']);
    assert.deepEqual(missingRenderers(extensionSpec()), []);
});

test('a 0.1 extension with no Carve 0.2 port fails by name, and is left out as a default', async () => {
    const { carve } = await import('./helpers/engine.js');

    assert.throws(() => resolveExtensions(['spoiler'], carve), /"spoiler" is not available in Carve 0.2 yet \(markup-carve\/carve-js#5070\)/);
    assert.deepEqual(resolveExtensions([{ name: 'spoiler', optional: true }], carve), []);
});

test('the 0.2 bundles render through the engine, document transforms included', async () => {
    const { carve } = await import('./helpers/engine.js');
    const { carveRenderer } = await import('../src/extensions.js');
    const render = carveRenderer(carve, resolveExtensions(['tabs', 'codeGroup', 'codeCallouts'], carve), { sections: false });

    assert.match(render(':::: tabs\n::: tab "A"\nx\n:::\n::::\n'), /<label for="tabs-1-0">A<\/label>/);
    assert.match(render('::: code-group\n```sh [npm]\nnpm i\n```\n:::\n'), /class="code-group"/);
});

test('without the Carve 0.2 Markdown writer, a handout says what it waits for', async () => {
    const { carve } = await import('./helpers/engine.js');
    const { findMarkdownWriter, markdownWriter } = await import('../src/markdown.js');

    if (await findMarkdownWriter(carve)) {
        return;
    }

    await assert.rejects(() => markdownWriter(carve), (error) => error.code === 'writer-unavailable' && /carve-js#5076/.test(error.message));
});
