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
 * Arrow up and down are left alone on purpose: reveal uses them for vertical
 * slide stacks, and stealing them breaks navigation on exactly the slide where a
 * speaker needs it.
 */

const HORIZONTAL = { ArrowLeft: -1, ArrowRight: 1 };

function panelsOf(group) {
    return [...group.querySelectorAll(':scope > [role="tabpanel"]')];
}

function tabsOf(group) {
    return [...group.querySelectorAll(':scope > [role="tab"]')];
}

function select(group, index, { focus = true } = {}) {
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

function currentIndex(group) {
    return Math.max(0, tabsOf(group).findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
}

function wire(group) {
    const tabs = tabsOf(group);

    if (!tabs.length || group.dataset.carveTabs) {
        return;
    }

    group.dataset.carveTabs = 'ready';

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(group, index, { focus: false }));

        tab.addEventListener('keydown', (event) => {
            const step = HORIZONTAL[event.key];

            if (step) {
                select(group, currentIndex(group) + step);
            } else if (event.key === 'Home') {
                select(group, 0);
            } else if (event.key === 'End') {
                select(group, tabs.length - 1);
            } else {
                return;
            }

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
 * @param {object} deck The reveal instance
 * @param {object} config The plugin's `carve` config block
 */
export function setupTabs(deck, config = {}) {
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
