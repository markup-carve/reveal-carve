/**
 * reveal.js plugin: write slides in Carve.
 *
 * Mirrors the built-in Markdown plugin. A section carrying `data-carve` is
 * replaced by the slides its Carve source describes, either inline:
 *
 *     <section data-carve>
 *         <textarea data-template>
 *             # Title
 *         </textarea>
 *     </section>
 *
 * or from a file:
 *
 *     <section data-carve="slides/deck.crv"></section>
 *
 * The Carve engine is taken from `window.carve` (the browser bundle shipped by
 * `@markup-carve/carve`) unless one is passed in through the plugin options.
 */

import { renderDeck, DEFAULTS } from './slice.js';
import { missingRenderers, resolveExtensions } from './extensions.js';
import { setupTabs } from './tabs.js';
import { setupTimer } from './timer.js';

function dedent(text) {
    const lines = text.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
    const indents = lines
        .filter((line) => line.trim())
        .map((line) => line.match(/^\s*/)[0].length);
    const shortest = indents.length ? Math.min(...indents) : 0;

    return lines.map((line) => line.slice(shortest)).join('\n');
}

function readOptions(section, config) {
    return {
        separator: section.getAttribute('data-separator') || config.separator || DEFAULTS.separator,
        verticalSeparator:
            section.getAttribute('data-separator-vertical')
            || config.verticalSeparator
            || DEFAULTS.verticalSeparator,
        notesDirective:
            section.getAttribute('data-separator-notes')
            || config.notesDirective
            || DEFAULTS.notesDirective,
        classDirective: config.classDirective || DEFAULTS.classDirective,
        attrDirective: config.attrDirective || DEFAULTS.attrDirective,
        fragmentDirective: config.fragmentDirective || DEFAULTS.fragmentDirective,
        animateLists: section.hasAttribute('data-animate-lists') || Boolean(config.animateLists),
        splitAtHeading: Number(section.getAttribute('data-split-at-heading'))
            || config.splitAtHeading
            || DEFAULTS.splitAtHeading,
        elements: config.elements,
        moveCodeAttributes: config.moveCodeAttributes,
        throwOnError: config.throwOnError,
        onError: config.onError,
    };
}

async function sourceOf(section) {
    const file = section.getAttribute('data-carve');

    if (file) {
        const response = await fetch(file, {
            headers: { Accept: 'text/plain' },
        });

        if (!response.ok) {
            throw new Error(`reveal-carve: cannot load ${file} (${response.status})`);
        }

        const charset = section.getAttribute('data-charset');

        if (charset) {
            return new TextDecoder(charset).decode(await response.arrayBuffer());
        }

        return await response.text();
    }

    const template = section.querySelector('[data-template]');
    const raw = template ? template.textContent : section.textContent;

    return dedent(raw || '');
}

function rendererFrom(config) {
    if (typeof config.render === 'function') {
        return config.render;
    }

    const engine = config.carve || (typeof window !== 'undefined' ? window.carve : undefined);

    if (!engine || typeof engine.carveToHtml !== 'function') {
        throw new Error(
            'reveal-carve: no Carve engine found. Load the @markup-carve/carve browser '
            + 'bundle before this plugin, or pass { carve } / { render } in the plugin options.',
        );
    }

    // Carve wraps headings in <section id>, which reveal reads as a vertical
    // slide. The engine can leave that wrapper off, which is cleaner than
    // stripping it afterwards; unwrapSections stays as a net for engines or
    // custom renderers that ignore the option.
    const renderOptions = { sections: false, ...(config.carveOptions || {}) };
    const extensions = resolveExtensions(config.extensions, engine);

    if (extensions.length) {
        renderOptions.extensions = [...(renderOptions.extensions || []), ...extensions];
    }

    const pending = missingRenderers(config.extensions);

    if (pending.length) {
        console.info(
            `[reveal-carve] ${pending.join(', ')} need their own renderer on the page.`,
        );
    }

    return (text) => engine.carveToHtml(text, renderOptions);
}

// Attributes that configure this plugin rather than the slide, so they are not
// forwarded onto the generated sections.
const OWN_ATTRIBUTES = /^data-(carve|separator|separator-vertical|separator-notes|charset)$/i;

function forwardAttributes(from, to) {
    for (const attribute of from.attributes) {
        if (OWN_ATTRIBUTES.test(attribute.name) || to.hasAttribute(attribute.name)) {
            continue;
        }

        if (attribute.name === 'class') {
            to.classList.add(...attribute.value.split(/\s+/).filter(Boolean));
            continue;
        }

        to.setAttribute(attribute.name, attribute.value);
    }
}

/**
 * Colour the lines of a `{.diff}` block after highlighting.
 *
 * The lines are marked while rendering too, but highlight.js rebuilds the
 * element and throws those spans away, so the work is done again here - once
 * reveal reports ready, which is after every plugin has had its turn.
 */
export function markDiffs(deck) {
    const blocks = [...deck.getRevealElement().querySelectorAll('pre.diff code')];

    if (!blocks.length) {
        return;
    }

    const paint = () => {
        for (const block of blocks) {
            if (block.querySelector('.diff-add, .diff-del')) {
                continue;
            }

            const lines = block.innerHTML.replace(/\n$/, '').split('\n');
            const probe = document.createElement('div');

            block.innerHTML = lines
                .map((line) => {
                    probe.innerHTML = line;
                    const text = probe.textContent.trimStart();
                    const kind = text.startsWith('+') ? 'add' : text.startsWith('-') ? 'del' : '';

                    return kind ? `<span class="diff-${kind}">${line}</span>` : line;
                })
                .join('\n');
        }
    };

    deck.on?.('ready', paint);
    paint();
}

/**
 * Keep callout markers through syntax highlighting.
 *
 * reveal's highlight plugin hands each block to highlight.js, which rebuilds the
 * element from its text - so the `<b class="callout">` Carve put inside the code
 * comes back as a bare number and loses its badge. The markers are remembered
 * before that happens and written back on `ready`, which is after every plugin,
 * including the highlighter, has run.
 */
export function protectCallouts(deck) {
    const blocks = new Set(
        [...deck.getRevealElement().querySelectorAll('code .callout')]
            .map((marker) => marker.closest('code')),
    );

    if (!blocks.size) {
        return;
    }

    const remembered = [...blocks].map((block) => ({
        block,
        markers: [...block.querySelectorAll('.callout')].map((marker) => ({
            number: marker.textContent.trim(),
            html: marker.outerHTML,
        })),
    }));

    const restore = () => {
        for (const { block, markers } of remembered) {
            if (block.querySelector('.callout')) {
                continue;
            }

            let html = block.innerHTML;

            for (const marker of markers) {
                // The highlighter usually wraps the number as a literal, so the
                // wrapped form is tried first; the bare one covers a language
                // whose grammar leaves it alone. Both are anchored to the end of
                // the line, which is what keeps a number inside the code safe.
                const wrapped = new RegExp(
                    `<span class="hljs-number">${marker.number}</span>(\\s*)$`,
                    'm',
                );
                const bare = new RegExp(`(^|[^\\w"'>])${marker.number}(\\s*)$`, 'm');

                html = wrapped.test(html)
                    ? html.replace(wrapped, `${marker.html}$1`)
                    : html.replace(bare, `$1${marker.html}$2`);
            }

            block.innerHTML = html;
        }
    };

    deck.on?.('ready', restore);
    restore();
}

/**
 * An optional deck footer, configured as `carve: { footer: '<a ...>' }`.
 * It sits outside `.slides`, so it survives every transition. There is no
 * default content: what belongs down there is the deck author's business.
 */
export function ensureFooter(deck, config) {
    if (!config.footer) {
        return;
    }

    const element = deck.getRevealElement();
    const parent = element.parentNode || document.body;

    if (parent.querySelector(':scope > .deck-footer')) {
        return;
    }

    const footer = document.createElement('footer');
    footer.className = config.footerClass || 'deck-footer';
    footer.innerHTML = config.footer;
    parent.insertBefore(footer, element.nextSibling);
}

async function convert(deck) {
    const config = deck.getConfig().carve || {};
    const sections = deck
        .getRevealElement()
        .querySelectorAll('[data-carve]:not([data-carve-parsed])');

    // The engine is only needed when there is Carve to render. A deck built
    // ahead of time can still load this plugin for the footer and the tabs.
    const render = sections.length ? rendererFrom(config) : null;

    for (const section of sections) {
        const source = await sourceOf(section);
        const html = renderDeck(source, render, readOptions(section, config)).join('\n');
        const replacement = document.createElement('div');
        replacement.innerHTML = html;

        const generated = [...replacement.children];

        for (const slide of generated) {
            forwardAttributes(section, slide);
            slide.setAttribute('data-carve-parsed', 'true');
        }

        section.replaceWith(...generated);
    }

    ensureFooter(deck, config);
    setupTabs(deck, config);
    setupTimer(deck, config);
    protectCallouts(deck);
    markDiffs(deck);
}

const plugin = () => ({
    id: 'carve',

    init(deck) {
        return convert(deck);
    },

    // Exposed through Reveal.getPlugin('carve') so slides added later can be
    // converted with the same settings.
    convert,
    renderDeck,
});

export default plugin;
export { plugin as RevealCarve, convert, renderDeck };
