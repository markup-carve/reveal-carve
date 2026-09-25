/**
 * The steps a slide offers, and the one key that walks them.
 *
 * This is what a speaker with a clicker actually presses, so the order and the
 * hand-back to the deck are worth pinning down: a step that stops working means
 * a slide that cannot be opened in front of an audience.
 */

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { moveDeck, setupSlideSteps, setupSpoilers, stepsOn } from '../src/steps.js';
import { fakeDeck, setupDom, teardownDom } from './helpers/dom.js';

afterEach(teardownDom);

const SLIDE = `<section>
<details><summary>More</summary><p>The long version.</p></details>
<p>Answer: <span class="spoiler">42</span></p>
<div class="code-group">
<input type="radio" class="code-group-radio" name="g" id="g1" checked>
<label class="code-group-label" for="g1">One</label>
<input type="radio" class="code-group-radio" name="g" id="g2">
<label class="code-group-label" for="g2">Two</label>
<div class="code-group-panel">one</div>
<div class="code-group-panel">two</div>
</div>
</section>`;

function deckOn(document) {
    const deck = fakeDeck(document);
    const slide = document.querySelector('section');

    deck.getCurrentSlide = () => slide;
    deck.moves = [];
    deck.getIndices = () => ({ h: 0, v: 0 });
    deck.next = () => deck.moves.push('next');
    deck.prev = () => deck.moves.push('prev');

    return deck;
}

function key(name) {
    const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
    event.key = name;
    document.dispatchEvent(event);

    return event;
}

test('a slide lists its steps in the order they are written', () => {
    const { document } = setupDom(SLIDE);
    const steps = stepsOn(document.querySelector('section'));

    // details, spoiler, and one step for the code group's second panel.
    assert.equal(steps.length, 3);
    assert.deepEqual(steps.map((step) => step.done), [false, false, false]);
});

test('down takes the next step and leaves the deck alone', () => {
    const { document } = setupDom(SLIDE);
    const deck = deckOn(document);

    setupSlideSteps(deck);

    assert.equal(key('ArrowDown').defaultPrevented, true);
    assert.equal(document.querySelector('details').open, true);

    key('ArrowDown');
    assert.equal(document.querySelector('.spoiler').classList.contains('revealed'), true);

    key('ArrowDown');
    assert.equal(
        [...document.querySelectorAll('input[type="radio"]')].map((radio) => radio.checked)[1],
        true,
    );

    assert.deepEqual(deck.moves, [], 'the deck moved while the slide still had steps');
});

test('once the steps are taken the deck moves on', () => {
    const { document } = setupDom(SLIDE);
    const deck = deckOn(document);

    deck.down = () => {};
    setupSlideSteps(deck);
    key('ArrowDown');
    key('ArrowDown');
    key('ArrowDown');

    assert.deepEqual(deck.moves, []);

    key('ArrowDown');

    // Reveal reads down as vertical navigation and does nothing at the end of a
    // stack, so the move is made here.
    assert.deepEqual(deck.moves, ['next']);
});

test('up takes the last step back, in reverse order', () => {
    const { document } = setupDom(SLIDE);
    const deck = deckOn(document);

    setupSlideSteps(deck);
    key('ArrowDown');
    key('ArrowDown');

    key('ArrowUp');
    assert.equal(document.querySelector('.spoiler').classList.contains('revealed'), false);

    key('ArrowUp');
    assert.equal(document.querySelector('details').open, false);

    // Nothing left to undo: the key goes back to walking the deck.
    deck.up = () => {};
    key('ArrowUp');
    assert.deepEqual(deck.moves, ['prev']);
});

test('a spoiler still answers to a click', () => {
    const { document } = setupDom(SLIDE);

    setupSpoilers(fakeDeck(document));

    const spoiler = document.querySelector('.spoiler');
    spoiler.dispatchEvent(new globalThis.window.Event('click', { bubbles: true }));

    assert.equal(spoiler.classList.contains('revealed'), true);
});

test('a deck with no vertical stack falls back to linear navigation', () => {
    const { document } = setupDom(SLIDE);
    const deck = deckOn(document);

    deck.down = () => {};
    moveDeck(deck, 'down');
    assert.deepEqual(deck.moves, ['next']);

    deck.up = () => {};
    moveDeck(deck, 'up');
    assert.deepEqual(deck.moves, ['next', 'prev']);
});

test('a deck that did move is not moved twice', () => {
    const { document } = setupDom(SLIDE);
    const deck = deckOn(document);
    let v = 0;

    deck.getIndices = () => ({ h: 0, v });
    deck.down = () => { v += 1; };

    moveDeck(deck, 'down');

    assert.deepEqual(deck.moves, []);
});

test('a step inside a panel nobody can see is not offered', () => {
    const { document } = setupDom(`<section><div class="tabs" role="tablist">
<button type="button" role="tab" aria-selected="true" class="tabs-label">One</button>
<button type="button" role="tab" aria-selected="false" class="tabs-label">Two</button>
<div role="tabpanel" class="tabs-panel">shown</div>
<div role="tabpanel" class="tabs-panel" hidden><details><summary>Later</summary><p>Hidden.</p></details></div>
</div></section>`);

    // One step for the second tab, and none for the details in the panel that
    // is not on show.
    assert.equal(stepsOn(document.querySelector('section')).length, 1);
});

test('a group driven by reveal fragments is left to reveal', () => {
    const { document } = setupDom(`<section><div class="tabs" role="tablist">
<button type="button" role="tab" aria-selected="true" class="tabs-label">One</button>
<button type="button" role="tab" aria-selected="false" class="tabs-label">Two</button>
<div role="tabpanel" class="tabs-panel">one</div>
<div role="tabpanel" class="tabs-panel" hidden>two</div>
<span class="fragment carve-tab-step" data-tab-index="1"></span>
</div></section>`);

    assert.deepEqual(stepsOn(document.querySelector('section')), []);
});
