import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { plannedSeconds, setupTimer } from '../src/timer.js';
import { fakeDeck, setupDom, teardownDom } from './helpers/dom.js';

afterEach(teardownDom);

const PLANNED = '<section data-minutes="5"></section><section data-minutes="10"></section>'
    + '<section data-minutes="3"></section>';

test('adds up the minutes planned before a slide', () => {
    const { document } = setupDom(PLANNED);
    const slides = [...document.querySelectorAll('.slides > section')];

    assert.equal(plannedSeconds(slides, 0), 300);
    assert.equal(plannedSeconds(slides, 2), 1080);
});

test('shows the plan against the clock', () => {
    const { document } = setupDom(PLANNED);
    const deck = fakeDeck(document, {});
    deck.getCurrentSlide = () => document.querySelector('.slides > section');

    const timer = setupTimer(deck, { timer: true });

    assert.ok(timer);
    assert.match(timer.element.textContent, /0 \/ 18 min\s+\+5:00/);
    timer.stop();
});

test('says when the speaker is behind', () => {
    const { document } = setupDom(PLANNED);
    const deck = fakeDeck(document, {});
    deck.getCurrentSlide = () => document.querySelector('.slides > section');

    const timer = setupTimer(deck, { timer: true });
    // Pretend the talk started twenty minutes ago.
    timer.element.dataset.state = '';
    const realNow = Date.now;
    Date.now = () => realNow() + 20 * 60 * 1000;
    timer.tick();
    Date.now = realNow;

    assert.equal(timer.element.dataset.state, 'behind');
    timer.stop();
});

test('stays away unless asked for', () => {
    const { document } = setupDom(PLANNED);

    assert.equal(setupTimer(fakeDeck(document, {}), {}), null);
    assert.equal(document.querySelectorAll('.deck-timer').length, 0);
});

test('stays away when no slide carries a plan', () => {
    const { document } = setupDom('<section></section>');

    assert.equal(setupTimer(fakeDeck(document, {}), { timer: true }), null);
});
