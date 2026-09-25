/**
 * A browser-shaped environment for the parts of this package that only run in
 * one: the plugin and the tab runtime. linkedom gives the DOM; the reveal deck
 * is a stand-in that records what was asked of it.
 *
 * The alternative was leaving those two files at 39% and 28% coverage while
 * they are exactly what runs in front of an audience.
 */

import { parseHTML } from 'linkedom';

export function setupDom(body = '') {
    const { document, window } = parseHTML(`<!DOCTYPE html><html><body>
<div class="reveal"><div class="slides">${body}</div></div>
</body></html>`);

    globalThis.document = document;
    globalThis.window = window;
    globalThis.CustomEvent = window.CustomEvent;
    globalThis.KeyboardEvent = window.KeyboardEvent;
    globalThis.fetch = async () => {
        throw new Error('fetch was not stubbed for this test');
    };

    return { document, window };
}

export function teardownDom() {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.CustomEvent;
    delete globalThis.KeyboardEvent;
    delete globalThis.fetch;
    delete globalThis.carve;
}

/**
 * A reveal deck double. `events` records every listener the code registers, so
 * a test can fire one without a real reveal instance.
 */
export function fakeDeck(document, config = {}) {
    const events = new Map();

    return {
        events,
        getConfig: () => config,
        getRevealElement: () => document.querySelector('.reveal'),
        on(name, handler) {
            events.set(name, handler);
        },
        emit(name, detail) {
            events.get(name)?.(detail);
        },
    };
}

/**
 * The Carve engine as the plugin expects to find it: one function, one call.
 */
export function fakeEngine(render = (text) => `<p>${text.trim()}</p>`) {
    return { carveToHtml: (text) => render(text) };
}
