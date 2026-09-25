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

    const renderOptions = config.carveOptions || {};

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

async function convert(deck) {
    const config = deck.getConfig().carve || {};
    const render = rendererFrom(config);
    const sections = deck
        .getRevealElement()
        .querySelectorAll('[data-carve]:not([data-carve-parsed])');

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
