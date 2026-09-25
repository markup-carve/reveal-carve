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

test('arrow right moves to the next tab', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    press(document.querySelectorAll('[role="tab"]')[0], 'ArrowRight');

    assert.deepEqual(selection(document), ['false', 'true', 'false']);
});

test('arrow left wraps around to the last tab', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    press(document.querySelectorAll('[role="tab"]')[0], 'ArrowLeft');

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
    event.key = 'ArrowRight';
    tab.dispatchEvent(event);

    assert.equal(prevented || stopped || event.defaultPrevented, true, 'reveal would also change slide');
});

test('an unrelated key is left to reveal', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    const event = new globalThis.window.Event('keydown', { bubbles: true, cancelable: true });
    event.key = 'ArrowDown';
    document.querySelector('[role="tab"]').dispatchEvent(event);

    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(selection(document), ['true', 'false', 'false']);
});

test('the selected tab is the only one in the tab order', () => {
    const { document } = setupDom(TABS);
    setupTabs(fakeDeck(document), { tabs: true });

    press(document.querySelectorAll('[role="tab"]')[0], 'ArrowRight');

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
