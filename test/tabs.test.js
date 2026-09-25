import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { setupTabs } from '../src/tabs.js';
import { fakeDeck, setupDom, teardownDom } from './helpers/dom.js';

afterEach(teardownDom);

// The shape Carve's tabs extension emits in aria mode.
const TABS = `<section><div class="tabs" role="tablist" aria-label="Tabs">
<button type="button" role="tab" id="t1" aria-selected="true" aria-controls="p1" class="tabs-label">One</button>
<button type="button" role="tab" id="t2" aria-selected="false" aria-controls="p2" class="tabs-label" tabindex="-1">Two</button>
<button type="button" role="tab" id="t3" aria-selected="false" aria-controls="p3" class="tabs-label" tabindex="-1">Three</button>
<div role="tabpanel" id="p1" class="tabs-panel">one</div>
<div role="tabpanel" id="p2" class="tabs-panel" hidden>two</div>
<div role="tabpanel" id="p3" class="tabs-panel" hidden>three</div>
</div></section>`;

function press(element, key) {
    let defaultPrevented = false;
    let propagationStopped = false;

    const event = {
        key,
        preventDefault() {
            defaultPrevented = true;
        },
        stopPropagation() {
            propagationStopped = true;
        },
    };

    element.dispatchEvent(Object.assign(new globalThis.window.Event('keydown', { bubbles: true }), event));

    return { defaultPrevented, propagationStopped };
}

function selection(document) {
    return [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('aria-selected'));
}

test('does nothing unless tabs are switched on', () => {
    const { document } = setupDom(TABS);

    setupTabs(fakeDeck(document), {});

    assert.equal(document.querySelector('.tabs').dataset.carveTabs, undefined);
});

test('wires a tab group once', () => {
    const { document } = setupDom(TABS);
    const deck = fakeDeck(document);

    setupTabs(deck, { tabs: true });
    setupTabs(deck, { tabs: true });

    assert.equal(document.querySelector('.tabs').dataset.carveTabs, 'ready');
});

test('a click selects its tab and shows only its panel', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    document.querySelectorAll('[role="tab"]')[1].dispatchEvent(
        new globalThis.window.Event('click', { bubbles: true }),
    );

    assert.deepEqual(selection(document), ['false', 'true', 'false']);
    assert.deepEqual(
        [...document.querySelectorAll('[role="tabpanel"]')].map((panel) => panel.hidden),
        [true, false, true],
    );
});

test('arrow down moves to the next tab', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    press(document.querySelectorAll('[role="tab"]')[0], 'ArrowDown');

    assert.deepEqual(selection(document), ['false', 'true', 'false']);
});

test('the ends do not wrap: the key goes back to the deck there', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });
    const tabs = [...document.querySelectorAll('[role="tab"]')];

    const send = (tab, key) => {
        const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
        event.key = key;
        tab.dispatchEvent(event);

        return event;
    };

    // First tab, up: nothing to select, so reveal gets the press.
    const up = send(tabs[0], 'ArrowUp');
    assert.equal(up.defaultPrevented, false);
    assert.deepEqual(selection(document), ['true', 'false', 'false']);

    press(tabs[0], 'End');
    assert.deepEqual(selection(document), ['false', 'false', 'true']);

    // Last tab, down: the same, in the other direction.
    const down = send(tabs[2], 'ArrowDown');
    assert.equal(down.defaultPrevented, false);
    assert.deepEqual(selection(document), ['false', 'false', 'true']);
});

test('home and end jump to the ends', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });
    const tabs = [...document.querySelectorAll('[role="tab"]')];

    press(tabs[0], 'End');
    assert.deepEqual(selection(document), ['false', 'false', 'true']);

    press(tabs[2], 'Home');
    assert.deepEqual(selection(document), ['true', 'false', 'false']);
});

test('home on the first tab is the deck\'s key, not the strip\'s', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
    event.key = 'Home';
    document.querySelectorAll('[role="tab"]')[0].dispatchEvent(event);

    assert.equal(event.defaultPrevented, false);
});

test('a handled key is kept away from reveal', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    const tab = document.querySelector('[role="tab"]');
    let stopped = false;
    let prevented = false;

    tab.addEventListener('keydown', (event) => {
        // The runtime's own listener runs first and marks the event.
        stopped = event.cancelBubble === true || event.__stopped === true;
        prevented = event.defaultPrevented;
    });

    const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
    event.key = 'ArrowDown';
    tab.dispatchEvent(event);

    assert.equal(prevented || stopped || event.defaultPrevented, true, 'reveal would also change slide');
});

test('left and right stay with the deck, so a speaker can leave the slide', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    for (const key of ['ArrowLeft', 'ArrowRight']) {
        const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
        event.key = key;
        document.querySelector('[role="tab"]').dispatchEvent(event);

        assert.equal(event.defaultPrevented, false, key);
        assert.deepEqual(selection(document), ['true', 'false', 'false'], key);
    }
});

test('the strip announces itself as vertical, since that is where its keys are', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    assert.equal(document.querySelector('[role="tablist"]').getAttribute('aria-orientation'), 'vertical');
});

test('the selected tab is the only one in the tab order', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    press(document.querySelectorAll('[role="tab"]')[0], 'ArrowDown');

    // Read the attribute, not the property: linkedom does not reflect tabIndex,
    // and the attribute is what a browser and a screen reader go by anyway.
    assert.deepEqual(
        [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('tabindex')),
        ['-1', '0', '-1'],
    );
});

test('fragment mode adds one step per extra tab', () => {
    const { document } = setupDom(TABS);
    const deck = fakeDeck(document);

    setupTabs(deck, { tabs: 'fragments' });

    assert.equal(document.querySelectorAll('.carve-tab-step').length, 2);
    assert.ok(deck.events.has('fragmentshown'));
});

test('showing a fragment selects the matching tab', () => {
    const { document } = setupDom(TABS);
    const deck = fakeDeck(document);
    setupTabs(deck, { tabs: 'fragments' });

    const steps = document.querySelectorAll('.carve-tab-step');
    steps[0].classList.add('visible');
    deck.emit('fragmentshown', { fragment: steps[0] });

    assert.deepEqual(selection(document), ['false', 'true', 'false']);
});

test('hiding every fragment goes back to the first tab', () => {
    const { document } = setupDom(TABS);
    const deck = fakeDeck(document);
    setupTabs(deck, { tabs: 'fragments' });

    const steps = document.querySelectorAll('.carve-tab-step');
    steps[0].classList.add('visible');
    deck.emit('fragmentshown', { fragment: steps[0] });
    steps[0].classList.remove('visible');
    deck.emit('fragmenthidden', { fragment: steps[0] });

    assert.deepEqual(selection(document), ['true', 'false', 'false']);
});

test('a lone tab gets no fragment steps', () => {
    const { document } = setupDom(
        '<section><div class="tabs" role="tablist">'
        + '<button role="tab" aria-selected="true">One</button>'
        + '<div role="tabpanel">one</div></div></section>',
    );

    setupTabs(fakeDeck(document), { tabs: 'fragments' });

    assert.equal(document.querySelectorAll('.carve-tab-step').length, 0);
});

// The shape Carve emits in css mode, and for every code group: radio inputs.
const RADIOS = `<section><div class="code-group">
<input type="radio" class="code-group-radio" name="g" id="g1" checked>
<label class="code-group-label" for="g1">One</label>
<input type="radio" class="code-group-radio" name="g" id="g2">
<label class="code-group-label" for="g2">Two</label>
<div class="code-group-panel">one</div>
<div class="code-group-panel">two</div>
</div></section>`;

function navigatingDeck(document) {
    const deck = fakeDeck(document);
    const moves = [];

    deck.left = () => moves.push('left');
    deck.right = () => moves.push('right');
    deck.up = () => moves.push('up');
    deck.down = () => moves.push('down');
    deck.moves = moves;

    return deck;
}

function sendKey(document, element, key) {
    const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
    event.key = key;
    element.dispatchEvent(event);

    return event;
}

test('a code group steps with up and down, and stops at its ends', () => {
    const { document } = setupDom(RADIOS);
    const deck = navigatingDeck(document);

    setupTabs(deck, {});

    const radios = [...document.querySelectorAll('input[type="radio"]')];
    const checked = () => radios.map((radio) => radio.checked);

    sendKey(document, radios[0], 'ArrowDown');
    assert.deepEqual(checked(), [false, true]);
    assert.deepEqual(deck.moves, []);

    // Past the last panel the key is navigation again, because reveal never
    // sees a key press aimed at an input.
    sendKey(document, radios[1], 'ArrowDown');
    assert.deepEqual(checked(), [false, true]);
    assert.deepEqual(deck.moves, ['down']);

    sendKey(document, radios[1], 'ArrowUp');
    assert.deepEqual(checked(), [true, false]);
});

test('left and right move the deck from inside a code group', () => {
    const { document } = setupDom(RADIOS);
    const deck = navigatingDeck(document);

    setupTabs(deck, {});

    const radio = document.querySelector('input[type="radio"]');
    const right = sendKey(document, radio, 'ArrowRight');
    const left = sendKey(document, radio, 'ArrowLeft');

    assert.deepEqual(deck.moves, ['right', 'left']);
    // The browser would otherwise switch the radio as well.
    assert.equal(right.defaultPrevented, true);
    assert.equal(left.defaultPrevented, true);
});

test('a code group is wired even when the aria runtime is off', () => {
    const { document } = setupDom(RADIOS);

    setupTabs(fakeDeck(document), {});

    assert.equal(document.querySelector('.code-group').dataset.carveRadioKeys, 'ready');
});

function deckWithSlide(document) {
    const deck = fakeDeck(document);
    const slide = document.querySelector('section');

    deck.getCurrentSlide = () => slide;

    return deck;
}

function documentKey(key, extra = {}) {
    const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
    event.key = key;
    Object.assign(event, extra);
    document.dispatchEvent(event);

    return event;
}

test('up and down switch the group on the slide without anything being focused', () => {
    const { document } = setupDom(TABS);

    setupTabs(deckWithSlide(document), { tabs: true });

    const down = documentKey('ArrowDown');

    assert.deepEqual(selection(document), ['false', 'true', 'false']);
    assert.equal(down.defaultPrevented, true, 'reveal would change slide too');

    documentKey('ArrowUp');
    assert.deepEqual(selection(document), ['true', 'false', 'false']);
});

test('at the end of the group the key moves the deck, not the group', () => {
    const { document } = setupDom(TABS);
    const deck = deckWithSlide(document);
    const moves = [];

    deck.getIndices = () => ({ h: 0, v: 0 });
    deck.down = () => {};
    deck.up = () => {};
    deck.next = () => moves.push('next');
    deck.prev = () => moves.push('prev');

    setupTabs(deck, { tabs: true });

    // Nothing selected before the first tab, so up is navigation right away.
    documentKey('ArrowUp');
    assert.deepEqual(moves, ['prev']);
    assert.deepEqual(selection(document), ['true', 'false', 'false']);

    documentKey('ArrowDown');
    documentKey('ArrowDown');
    assert.deepEqual(selection(document), ['false', 'false', 'true']);
    assert.deepEqual(moves, ['prev'], 'the deck moved while tabs were left');

    documentKey('ArrowDown');
    assert.deepEqual(moves, ['prev', 'next']);
});

test('a code group is driven by the same keys', () => {
    const { document } = setupDom(RADIOS);

    setupTabs(deckWithSlide(document), {});

    documentKey('ArrowDown');

    assert.deepEqual(
        [...document.querySelectorAll('input[type="radio"]')].map((radio) => radio.checked),
        [false, true],
    );
});

test('a slide without a group leaves the keys alone', () => {
    const { document } = setupDom('<section><h2>Plain</h2></section>');

    setupTabs(deckWithSlide(document), { tabs: true });

    assert.equal(documentKey('ArrowDown').defaultPrevented, false);
});

test('a modified key press is not a tab switch', () => {
    const { document } = setupDom(TABS);

    setupTabs(deckWithSlide(document), { tabs: true });

    assert.equal(documentKey('ArrowDown', { shiftKey: true }).defaultPrevented, false);
    assert.deepEqual(selection(document), ['true', 'false', 'false']);
});

test('the overview is reveal\'s, not the group\'s', () => {
    const { document } = setupDom(TABS);
    const deck = deckWithSlide(document);

    deck.isOverview = () => true;
    setupTabs(deck, { tabs: true });

    assert.equal(documentKey('ArrowDown').defaultPrevented, false);
});

test('a focused text field keeps its arrow keys', () => {
    const { document } = setupDom(`${TABS}`);
    const deck = deckWithSlide(document);

    setupTabs(deck, { tabs: true });

    const field = document.createElement('input');
    field.type = 'text';
    document.querySelector('section').appendChild(field);
    // linkedom has no focus tracking of its own, so the state is set directly.
    Object.defineProperty(document, 'activeElement', { value: field, configurable: true });

    assert.equal(documentKey('ArrowDown').defaultPrevented, false);
    assert.deepEqual(selection(document), ['true', 'false', 'false']);
});

test('past the last panel a deck with no vertical stack still moves on', () => {
    const { document } = setupDom(RADIOS);
    const deck = navigatingDeck(document);
    const indices = { h: 1, v: 0 };

    // What reveal does on a deck without vertical slides: down changes nothing.
    deck.getIndices = () => indices;
    deck.down = () => {};
    deck.next = () => deck.moves.push('next');

    setupTabs(deck, {});

    const radios = [...document.querySelectorAll('input[type="radio"]')];
    radios[0].checked = false;
    radios[1].checked = true;

    sendKey(document, radios[1], 'ArrowDown');

    assert.deepEqual(deck.moves, ['next']);
});

test('the deck is not moved twice by one key press', () => {
    const { document } = setupDom(RADIOS);
    const deck = navigatingDeck(document);

    setupTabs(deck, {});

    const radios = [...document.querySelectorAll('input[type="radio"]')];
    const event = sendKey(document, radios[0], 'ArrowLeft');

    assert.deepEqual(deck.moves, ['left']);
    assert.equal(event.cancelBubble === true || event.defaultPrevented, true);
});
