/**
 * The light/dark switch, run the way a browser runs it.
 *
 * It ships as a string of script inside every deck built with a dark theme, so
 * nothing else in the suite executes it. The behaviour that matters is small
 * and easy to break: which stylesheets end up disabled, and what is stored.
 */

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import vm from 'node:vm';

import { themeToggle } from '../src/build.js';
import { setupDom, teardownDom } from './helpers/dom.js';

afterEach(teardownDom);

function runToggle({ stored = null, prefersDark = false, defaultDark = false } = {}) {
    const { document, window } = setupDom();
    const store = new Map(stored ? [['reveal-carve-theme', stored]] : []);

    document.head.innerHTML = [
        '<link data-carve-theme="light" href="light.css">',
        '<link data-carve-theme="dark" href="dark.css">',
    ].join('');

    window.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
    };
    window.matchMedia = () => ({ matches: prefersDark });
    globalThis.localStorage = window.localStorage;
    globalThis.matchMedia = window.matchMedia;

    const markup = themeToggle(defaultDark);
    const script = markup.slice(markup.indexOf('<script>') + 8, markup.lastIndexOf('</script>'));

    document.body.insertAdjacentHTML('beforeend', markup.slice(0, markup.indexOf('<script>')));

    vm.runInNewContext(script, { document, window, localStorage: window.localStorage, matchMedia: window.matchMedia });

    const state = () => ({
        theme: document.documentElement.dataset.carveTheme,
        light: document.querySelector('link[data-carve-theme="light"]').disabled,
        dark: document.querySelector('link[data-carve-theme="dark"]').disabled,
        stored: store.get('reveal-carve-theme'),
    });

    return { document, state, click: () => document.querySelector('.deck-theme-toggle').click() };
}

test('a first visit follows the system setting', () => {
    assert.equal(runToggle({ prefersDark: true }).state().theme, 'dark');
    assert.equal(runToggle({ prefersDark: false }).state().theme, 'light');
});

test('a stored choice wins over the system setting', () => {
    assert.equal(runToggle({ stored: 'light', prefersDark: true }).state().theme, 'light');
    assert.equal(runToggle({ stored: 'dark', prefersDark: false }).state().theme, 'dark');
});

test('the deck default applies when nothing else says otherwise', () => {
    assert.equal(runToggle({ defaultDark: true }).state().theme, 'dark');
});

test('exactly one set of stylesheets is enabled, and the click swaps them', () => {
    const toggle = runToggle();

    assert.deepEqual(
        { light: toggle.state().light, dark: toggle.state().dark },
        { light: false, dark: true },
    );

    toggle.click();

    assert.deepEqual(
        { light: toggle.state().light, dark: toggle.state().dark, stored: toggle.state().stored },
        { light: true, dark: false, stored: 'dark' },
    );

    toggle.click();
    assert.equal(toggle.state().stored, 'light');
});

test('the button says what it does, for a reader who cannot see it', () => {
    const { document } = runToggle();
    const button = document.querySelector('.deck-theme-toggle');

    assert.equal(button.getAttribute('type'), 'button');
    assert.match(button.getAttribute('aria-label'), /light and the dark/);
});
