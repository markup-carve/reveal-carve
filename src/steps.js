/**
 * One key for everything a slide can open.
 *
 * A speaker holds a clicker, not a mouse, so anything that would otherwise need
 * a click is a step on the slide instead: the panels of a tab group or a code
 * group, a folded `details`, a spoiler. Down takes the next step, up takes the
 * last one back, and once the slide has none left the key belongs to the deck
 * again. Left and right are never touched - those are how a talk moves.
 */

import { currentIndex, isChecked, select, tabsOf, VERTICAL } from './tabs.js';

const INTERACTIVE = '[role="tablist"], .tabs, .code-group, details, .spoiler';

function groupSteps(group) {
    // In fragments mode reveal's own fragment markers drive the group, and the
    // runtime selects a panel from them. Stepping it here as well would fight
    // that: the first marker would jump the group back to an earlier panel.
    if (group.querySelector('.carve-tab-step')) {
        return [];
    }

    const tabs = tabsOf(group);

    if (tabs.length > 1) {
        const at = currentIndex(group);

        return tabs.slice(1).map((tab, offset) => ({
            done: at > offset,
            take: () => select(group, offset + 1, { focus: false }),
            undo: () => select(group, offset, { focus: false }),
        }));
    }

    const radios = [...group.querySelectorAll('input[type="radio"]')];

    if (radios.length < 2) {
        return [];
    }

    const at = Math.max(0, radios.findIndex(isChecked));
    const check = (index) => {
        radios.forEach((radio, position) => {
            radio.checked = position === index;
        });
        radios[index].dispatchEvent(new CustomEvent('change', { bubbles: true }));
    };

    return radios.slice(1).map((radio, offset) => ({
        done: at > offset,
        take: () => check(offset + 1),
        undo: () => check(offset),
    }));
}

/**
 * Every step on a slide, in the order they appear in it.
 */
/**
 * Whether a node sits in a panel that is not the one on show. A step nobody can
 * see is not a step: pressing the key would open something off screen.
 */
function inHiddenPanel(node) {
    for (let el = node.parentElement; el; el = el.parentElement) {
        if (el.matches('[role="tabpanel"]')) {
            if (el.hasAttribute('hidden')) {
                return true;
            }

            continue;
        }

        if (!el.matches('.tabs-panel, .code-group-panel')) {
            continue;
        }

        const group = el.parentElement;
        const panels = [...group.children].filter((child) => child.matches('.tabs-panel, .code-group-panel'));
        const radios = [...group.querySelectorAll('input[type="radio"]')];

        // css mode: panel three belongs to radio three, the same way the
        // stylesheet pairs them.
        if (radios.length && panels.indexOf(el) !== Math.max(0, radios.findIndex(isChecked))) {
            return true;
        }
    }

    return false;
}

export function stepsOn(slide) {
    if (!slide) {
        return [];
    }

    return [...slide.querySelectorAll(INTERACTIVE)].filter((node) => !inHiddenPanel(node)).flatMap((node) => {
        if (node.matches('details')) {
            // The property and the attribute are set together: a browser keeps
            // them in step, and a DOM used for testing may reflect only one.
            return [{
                done: node.open === undefined ? node.hasAttribute('open') : node.open,
                take: () => {
                    node.open = true;
                    node.setAttribute('open', '');
                },
                undo: () => {
                    node.open = false;
                    node.removeAttribute('open');
                },
            }];
        }

        if (node.matches('.spoiler')) {
            return [{
                done: node.classList.contains('revealed'),
                take: () => node.classList.add('revealed'),
                undo: () => node.classList.remove('revealed'),
            }];
        }

        return groupSteps(node);
    });
}

/**
 * A spoiler answers to a click as well, because a slide shown on a screen
 * someone walks up to is not always driven by a keyboard.
 */
export function setupSpoilers(deck) {
    for (const spoiler of deck.getRevealElement().querySelectorAll('.spoiler')) {
        if (spoiler.dataset.carveSpoiler) {
            continue;
        }

        spoiler.dataset.carveSpoiler = 'ready';
        spoiler.addEventListener('click', () => spoiler.classList.toggle('revealed'));
    }
}

/**
 * Move the deck one step. `down` and `up` walk a vertical stack, and most decks
 * have none, so a press that changed nothing falls back to linear navigation.
 */
export function moveDeck(deck, direction) {
    const before = JSON.stringify(deck.getIndices?.() || null);

    deck[direction]?.();

    if (before !== JSON.stringify(deck.getIndices?.() || null)) {
        return;
    }

    if (direction === 'down') {
        deck.next?.();
    } else if (direction === 'up') {
        deck.prev?.();
    }
}

function editableHasFocus() {
    const focused = document.activeElement;

    // Reveal leaves arrow keys to a focused text control, and so does this. A
    // radio is an input as well, and that one is ours.
    return Boolean(focused
        && (focused.isContentEditable
            || /^(textarea|select)$/i.test(focused.tagName)
            || (/^input$/i.test(focused.tagName) && !/^(radio|checkbox|button)$/i.test(focused.type))));
}

/**
 * The document-level handler. It sits in the capture phase so it can keep a
 * press from reaching reveal, which would otherwise change slide at the same
 * time as the slide opened something.
 */
export function setupSlideSteps(deck) {
    if (deck.carveSlideSteps || typeof document === 'undefined') {
        return;
    }

    deck.carveSlideSteps = true;

    document.addEventListener('keydown', (event) => {
        const direction = VERTICAL[event.key];

        if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }

        if (deck.isOverview?.() || deck.isPaused?.() || editableHasFocus()) {
            return;
        }

        const steps = stepsOn(deck.getCurrentSlide?.() || document.querySelector('section.present'));
        const step = direction > 0
            ? steps.find((entry) => !entry.done)
            : [...steps].reverse().find((entry) => entry.done);

        if (!step) {
            // The slide had steps and they are used up. Reveal reads down as
            // vertical navigation, which does nothing at the end of a stack, so
            // the move is made here instead - that is the promise the steps make.
            if (steps.length) {
                moveDeck(deck, direction > 0 ? 'down' : 'up');
                event.preventDefault();
                event.stopPropagation();
            }

            return;
        }

        if (direction > 0) {
            step.take();
        } else {
            step.undo();
        }

        event.preventDefault();
        event.stopPropagation();
    }, true);
}
