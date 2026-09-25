import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSlide, renderDeck, renderSlide, unwrapSections } from '../src/slice.js';

// A stand-in for the Carve engine: enough structure to assert on, no dependency.
const render = (text) => `<section id="x"><p>${text.trim()}</p></section>`;

test('strips the section wrappers Carve puts around headings', () => {
    assert.equal(unwrapSections('<section id="a"><h2>T</h2></section>'), '<h2>T</h2>');
});

test('reads the class directive and keeps it out of the body', () => {
    const slide = parseSlide('%% class: center title\n\n# Hello\n');

    assert.equal(slide.className, 'center title');
    assert.equal(slide.body, '# Hello');
});

test('splits speaker notes off the body', () => {
    const slide = parseSlide('Body text\n\n%% notes\n\nSay this out loud\n');

    assert.equal(slide.body, 'Body text');
    assert.equal(slide.notes, 'Say this out loud');
});

test('carries raw attributes onto the section', () => {
    const html = renderSlide('%% attr: data-background="#fff"\n\nHello\n', render);

    assert.match(html, /<section data-background="#fff">/);
});

test('renders notes into an aside', () => {
    const html = renderSlide('Body\n\n%% notes\n\nNote\n', render);

    assert.match(html, /<aside class="notes">\s*<p>Note<\/p>\s*<\/aside>/);
});

test('splits a document into slides', () => {
    const slides = renderDeck('One\n\n---\n\nTwo\n\n---\n\nThree\n', render);

    assert.equal(slides.length, 3);
    assert.match(slides[1], /<p>Two<\/p>/);
});

test('nests a vertical stack in one outer section', () => {
    const slides = renderDeck('Top\n\n--\n\nBelow\n', render);

    assert.equal(slides.length, 1);
    assert.equal(slides[0].match(/<section>/g).length, 3);
});

test('leaves a three-dash separator out of the vertical split', () => {
    const slides = renderDeck('One\n\n---\n\nTwo\n', render);

    assert.equal(slides.length, 2);
    assert.ok(!slides[0].includes('Two'));
});

test('honors custom separators', () => {
    const slides = renderDeck('One\n\n===\n\nTwo\n', render, { separator: '\\r?\\n===\\r?\\n' });

    assert.equal(slides.length, 2);
});

test('a slide without directives still renders', () => {
    const html = renderSlide('Just text\n', render);

    assert.equal(html, '<section>\n<p>Just text</p>\n</section>');
});
