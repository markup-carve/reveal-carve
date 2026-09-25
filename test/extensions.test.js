import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    canonicalName,
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
