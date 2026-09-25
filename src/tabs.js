/**
 * Tab behavior for decks.
 *
 * Carve's `tabs` extension has two output modes. In `css` mode it emits radio
 * inputs and labels, which switch with no JavaScript at all - that is the right
 * default for a deck. In `aria` mode it emits `role="tablist"` with buttons and
 * hidden panels, which is the accessible shape but needs a script to drive it.
 * This is that script.
 *
 * Key handling is the part that needs care: reveal listens for arrow keys on the
 * document, so a tab strip that reacts to them has to stop the event, or the
 * deck changes slide at the same time as the tab. Measured on reveal.js 6.0.2 -
 * focus inside a button does not keep the key away from reveal.
 *
 * Up and down switch the tab; left and right are left alone, because those are
 * the keys a speaker uses to walk the deck and they have to keep working on
 * every slide, including this one. The strip is marked as a vertical tablist so
 * a screen reader announces the keys it actually has.
 *
 * The ends do not wrap. On the last tab, down belongs to the deck again, and on
 * the first one so does up - otherwise a speaker who keeps pressing the key is
 * stuck in a circle on one slide.
 */

import { moveDeck, setupSlideSteps, setupSpoilers } from './steps.js';

export const VERTICAL = { ArrowUp: -1, ArrowDown: 1 };

export function panelsOf(group) {
    return [...group.querySelectorAll(':scope > [role="tabpanel"]')];
}

export function tabsOf(group) {
    return [...group.querySelectorAll(':scope > [role="tab"]')];
}

export function select(group, index, { focus = true } = {}) {
    const tabs = tabsOf(group);
    const panels = panelsOf(group);
    const target = (index + tabs.length) % tabs.length;

    tabs.forEach((tab, position) => {
        const selected = position === target;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel, position) => {
        panel.hidden = position !== target;
    });

    if (focus) {
        tabs[target].focus();
    }

    group.dispatchEvent(new CustomEvent('carve:tabchange', { detail: { index: target } }));
}

export function currentIndex(group) {
    return Math.max(0, tabsOf(group).findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
}

function wire(group) {
    const tabs = tabsOf(group);

    if (!tabs.length || group.dataset.carveTabs) {
        return;
    }

    group.dataset.carveTabs = 'ready';
    group.setAttribute('aria-orientation', 'vertical');

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(group, index, { focus: false }));

        tab.addEventListener('keydown', (event) => {
            const step = VERTICAL[event.key];
            const here = currentIndex(group);
            let target = null;

            if (step) {
                target = here + step;
            } else if (event.key === 'Home') {
                target = 0;
            } else if (event.key === 'End') {
                target = tabs.length - 1;
            } else {
                return;
            }

            // Past either end, or already there: the key is the deck's.
            if (target < 0 || target >= tabs.length || target === here) {
                return;
            }

            select(group, target);

            // Otherwise reveal changes slide on the same key press.
            event.preventDefault();
            event.stopPropagation();
        });
    });
}

/**
 * Turn each tab group into a reveal fragment sequence: stepping forward shows
 * the next tab, and only once the last one is up does the deck move on. For a
 * talk this beats clicking, because the deck keeps its one-key rhythm.
 */
function asFragments(deck, group) {
    const tabs = tabsOf(group);

    if (tabs.length < 2) {
        return;
    }

    const slide = group.closest('section');

    tabs.slice(1).forEach((tab, offset) => {
        const marker = document.createElement('span');
        marker.className = 'fragment carve-tab-step';
        marker.dataset.tabIndex = String(offset + 1);
        marker.setAttribute('aria-hidden', 'true');
        group.appendChild(marker);
    });

    const sync = () => {
        const shown = [...group.querySelectorAll('.carve-tab-step.visible')];
        const index = shown.length
            ? Number(shown[shown.length - 1].dataset.tabIndex)
            : 0;
        select(group, index, { focus: false });
    };

    deck.on('fragmentshown', (event) => {
        if (slide.contains(event.fragment)) {
            sync();
        }
    });

    deck.on('fragmenthidden', (event) => {
        if (slide.contains(event.fragment)) {
            sync();
        }
    });
}

/**
 * Carve's css mode, and every code group, are radio inputs. A browser moves a
 * radio selection with all four arrow keys and wraps at the ends, so on a slide
 * the left and right keys switched the panel *and* moved the deck, and up and
 * down circled forever.
 *
 * Same rule as the aria strip: up and down switch, the ends do not wrap, and
 * left and right belong to the deck. Reveal cannot be left to handle those
 * itself here - it ignores every key press whose target is an `input`, which a
 * radio is - so the navigation is called directly.
 */
export function isChecked(radio) {
    // The property is what a browser updates; the attribute is what the markup
    // arrives with, and some DOM implementations never reflect one onto the other.
    return radio.checked === undefined ? radio.hasAttribute('checked') : radio.checked;
}

export function setupRadioGroups(deck) {
    const groups = deck.getRevealElement().querySelectorAll('.tabs, .code-group');

    for (const group of groups) {
        const radios = [...group.querySelectorAll('input[type="radio"]')];

        if (radios.length < 2 || group.dataset.carveRadioKeys) {
            continue;
        }

        group.dataset.carveRadioKeys = 'ready';

        const navigate = {
            ArrowLeft: () => moveDeck(deck, 'left'),
            ArrowRight: () => moveDeck(deck, 'right'),
            ArrowUp: () => moveDeck(deck, 'up'),
            ArrowDown: () => moveDeck(deck, 'down'),
        };

        group.addEventListener('keydown', (event) => {
            const step = VERTICAL[event.key];

            if (!step && !navigate[event.key]) {
                return;
            }

            // The native radio move is always wrong here: sideways it steals the
            // deck's keys, and up or down it wraps around the group forever.
            event.preventDefault();

            const here = radios.findIndex(isChecked);
            const target = step === undefined ? -1 : here + step;

            if (target < 0 || target >= radios.length) {
                navigate[event.key]();
                // The deck was moved here, by hand. Reveal must not move it a
                // second time on the way back up.
                event.stopPropagation();

                return;
            }

            // Setting the one is enough in a browser; the others are cleared
            // explicitly so the group is right whatever the DOM is.
            radios.forEach((radio, position) => {
                radio.checked = position === target;
            });
            radios[target].focus();
            radios[target].dispatchEvent(new CustomEvent('change', { bubbles: true }));
            event.stopPropagation();
        });
    }
}

/**
 * @param {object} deck The reveal instance
 * @param {object} config The plugin's `carve` config block
 */
export function setupTabs(deck, config = {}) {
    setupRadioGroups(deck);
    setupSpoilers(deck);
    setupSlideSteps(deck);

    if (!config.tabs) {
        return;
    }

    const groups = deck.getRevealElement().querySelectorAll('[role="tablist"]');

    for (const group of groups) {
        wire(group);

        if (config.tabs === 'fragments') {
            asFragments(deck, group);
        }
    }
}
