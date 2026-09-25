import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import plugin, { ensureFooter } from '../src/plugin.js';
import { fakeDeck, fakeEngine, setupDom, teardownDom } from './helpers/dom.js';

afterEach(teardownDom);

test('converts an inline deck into slides', async () => {
    const { document } = setupDom(
        '<section data-carve><textarea data-template>one\n\n---\n\ntwo</textarea></section>',
    );
    const deck = fakeDeck(document, { carve: { carve: fakeEngine() } });

    await plugin().init(deck);

    const slides = document.querySelectorAll('.slides > section');
    assert.equal(slides.length, 2);
    assert.match(slides[0].innerHTML, /<p>one<\/p>/);
});

test('fetches an external source and renders it', async () => {
    const { document } = setupDom('<section data-carve="deck.crv"></section>');
    let requested = '';

    globalThis.fetch = async (url) => {
        requested = url;

        return { ok: true, text: async () => '# Title' };
    };

    await plugin().init(fakeDeck(document, { carve: { carve: fakeEngine() } }));

    assert.equal(requested, 'deck.crv');
    assert.match(document.querySelector('.slides > section').innerHTML, /Title/);
});

test('reports a source it could not load', async () => {
    const { document } = setupDom('<section data-carve="missing.crv"></section>');
    globalThis.fetch = async () => ({ ok: false, status: 404 });

    await assert.rejects(
        () => plugin().init(fakeDeck(document, { carve: { carve: fakeEngine() } })),
        /cannot load missing\.crv \(404\)/,
    );
});

test('forwards the source section attributes onto every generated slide', async () => {
    const { document } = setupDom(
        '<section data-carve data-background="#fff" class="wide">'
        + '<textarea data-template>one\n\n---\n\ntwo</textarea></section>',
    );

    await plugin().init(fakeDeck(document, { carve: { carve: fakeEngine() } }));

    for (const slide of document.querySelectorAll('.slides > section')) {
        assert.equal(slide.getAttribute('data-background'), '#fff');
        assert.ok(slide.classList.contains('wide'));
        assert.equal(slide.getAttribute('data-carve-parsed'), 'true');
    }
});

test('does not forward its own configuration attributes', async () => {
    const { document } = setupDom(
        '<section data-carve data-separator="\\n---\\n" data-charset="utf-8">'
        + '<textarea data-template>one</textarea></section>',
    );

    await plugin().init(fakeDeck(document, { carve: { carve: fakeEngine() } }));

    const slide = document.querySelector('.slides > section');
    assert.equal(slide.hasAttribute('data-separator'), false);
    assert.equal(slide.hasAttribute('data-charset'), false);
});

test('converts a second time without touching what it already did', async () => {
    const { document } = setupDom('<section data-carve><textarea data-template>one</textarea></section>');
    const deck = fakeDeck(document, { carve: { carve: fakeEngine() } });

    await plugin().init(deck);
    await plugin().init(deck);

    assert.equal(document.querySelectorAll('.slides > section').length, 1);
});

test('asks for an engine only when there is something to render', async () => {
    const { document } = setupDom('<section><h2>Already built</h2></section>');

    await plugin().init(fakeDeck(document, {}));

    assert.equal(document.querySelectorAll('.slides > section').length, 1);
});

test('names the missing engine when a source does need one', async () => {
    const { document } = setupDom('<section data-carve><textarea data-template>x</textarea></section>');

    await assert.rejects(
        () => plugin().init(fakeDeck(document, {})),
        /no Carve engine found/,
    );
});

test('takes a plain render function instead of an engine', async () => {
    const { document } = setupDom('<section data-carve><textarea data-template>x</textarea></section>');

    await plugin().init(fakeDeck(document, { carve: { render: () => '<p>rendered</p>' } }));

    assert.match(document.querySelector('.slides > section').innerHTML, /rendered/);
});

test('adds a footer when one is configured', () => {
    const { document } = setupDom('<section></section>');
    const deck = fakeDeck(document);

    ensureFooter(deck, { footer: '<a href="x">Overview</a>' });

    const footer = document.querySelector('.deck-footer');
    assert.ok(footer);
    assert.match(footer.innerHTML, /Overview/);
});

test('adds no footer without content, and never a second one', () => {
    const { document } = setupDom('<section></section>');
    const deck = fakeDeck(document);

    ensureFooter(deck, {});
    assert.equal(document.querySelectorAll('.deck-footer').length, 0);

    ensureFooter(deck, { footer: 'a' });
    ensureFooter(deck, { footer: 'a' });
    assert.equal(document.querySelectorAll('.deck-footer').length, 1);
});

test('passes the separators from the section through to the slicer', async () => {
    const { document } = setupDom(
        '<section data-carve data-separator="\\r?\\n===\\r?\\n">'
        + '<textarea data-template>one\n\n===\n\ntwo</textarea></section>',
    );

    await plugin().init(fakeDeck(document, { carve: { carve: fakeEngine() } }));

    assert.equal(document.querySelectorAll('.slides > section').length, 2);
});
