/**
 * Carve extensions for a deck.
 *
 * Carve's richer features - diagrams, math, tabs, glossaries, locale-aware
 * typography - are opt-in extensions of the engine rather than core syntax. This
 * turns names into engine factories, so a deck enables them by name in one place
 * and the same spelling works in the browser and in the build step.
 */

/**
 * Extensions that produce markup a page must then activate with a renderer of
 * its own (Mermaid, Vega and friends ship their own JavaScript).
 */
export const NEEDS_RENDERER = new Set([
    'mermaid',
    'chart',
    'vegaLite',
    'd2',
    'graphviz',
    'plantuml',
    'wavedrom',
    'abc',
    'mathBlock',
]);

/**
 * On unless a deck says otherwise.
 *
 * These need nothing from the page - the stylesheet that ships with the plugin
 * already dresses all of them - and their off-state is the confusing one: a tab
 * group renders as stacked paragraphs with the labels as prose, which reads as
 * broken markup and reports no error. Measured on the demo decks, turning them
 * on costs no render time, and the browser bundle carries them either way.
 *
 * Deliberately not here: anything that needs its own script on the page
 * (mermaid, chart, math and the other diagram fences), because their off-state
 * is a readable code block and their on-state without the script is not;
 * `smartQuotes`, which needs a locale nobody can guess; and `imgFence`, which
 * changes what a fence is rather than how it looks.
 */
export const DEFAULT_EXTENSIONS = [
    'tabs',
    'codeGroup',
    'details',
    'spoiler',
    'listTable',
    'colorSwatch',
    'semanticSpan',
    'codeCallouts',
];

/**
 * Aliases for the names a deck author is likely to write.
 */
const ALIASES = {
    math: 'mathBlock',
    toc: 'tableOfContents',
    'smart-quotes': 'smartQuotes',
    smartquotes: 'smartQuotes',
    'code-group': 'codeGroup',
    'list-table': 'listTable',
    'heading-permalinks': 'headingPermalinks',
    'heading-numbers': 'headingNumbers',
    'external-links': 'externalLinks',
    'color-swatch': 'colorSwatch',
    'vega-lite': 'vegaLite',
    'table-of-contents': 'tableOfContents',
};

export function canonicalName(name) {
    return ALIASES[name] || ALIASES[name.toLowerCase()] || name;
}

/**
 * The names a deck ends up with: the defaults, plus whatever it asked for, minus
 * whatever it turned off. `false` for the whole spec means core Carve only.
 *
 * @param {Array<string|Function|{name: string, options?: object}>|false} [spec]
 * @param {string[]} [without] Names to leave out, from `--no-extension`
 */
export function extensionSpec(spec, without = []) {
    if (spec === false) {
        return [];
    }

    const asked = spec || [];
    const nameOf = (entry) => canonicalName(typeof entry === 'string' ? entry : entry?.name || '');
    const chosen = new Set(asked.map(nameOf));
    const off = new Set(without.map((name) => canonicalName(name)));
    // A default is optional: an older engine, or a trimmed browser build, may
    // not carry it, and that is not a reason to fail a deck nobody asked to use
    // it. A name the deck asked for by hand still fails loudly.
    const defaults = DEFAULT_EXTENSIONS
        .filter((name) => !chosen.has(name) && !off.has(name))
        .map((name) => ({ name, optional: true }));

    return [...defaults, ...asked.filter((entry) => !off.has(nameOf(entry)))];
}

/**
 * @param {Array<string|Function|{name: string, options?: object}>} spec
 * @param {object} engine The Carve module or browser global
 * @returns {Array<object>} extension instances for `carveToHtml`
 */
export function resolveExtensions(spec, engine) {
    if (!spec || !spec.length) {
        return [];
    }

    return spec.map((entry) => {
        if (typeof entry === 'function') {
            return entry();
        }

        if (entry && typeof entry === 'object' && !entry.name) {
            return entry;
        }

        const name = canonicalName(typeof entry === 'string' ? entry : entry.name);
        const options = typeof entry === 'object' ? entry.options || {} : {};
        const factory = engine?.[name];

        if (typeof factory !== 'function') {
            if (entry?.optional) {
                return null;
            }

            throw new Error(
                `reveal-carve: unknown Carve extension "${name}". `
                + 'Check the name against the engine\'s exports.',
            );
        }

        return factory(options);
    }).filter(Boolean);
}

/**
 * Parse a CLI spelling: `mermaid`, `smartQuotes:de`, or `tableOfContents:{"maxLevel":2}`.
 */
export function parseExtensionArgument(argument) {
    const separator = argument.indexOf(':');

    if (separator === -1) {
        return argument;
    }

    const name = argument.slice(0, separator);
    const rest = argument.slice(separator + 1);

    if (rest.startsWith('{')) {
        return { name, options: JSON.parse(rest) };
    }

    // A bare value is the option the extension is usually configured with.
    const key = canonicalName(name) === 'smartQuotes' ? 'locale' : 'value';

    return { name, options: { [key]: rest } };
}

/**
 * Scripts a page needs for the extensions it enabled, so the build step can warn
 * rather than produce a deck with a blank rectangle where a diagram belongs.
 */
export function missingRenderers(spec) {
    return (spec || [])
        .map((entry) => canonicalName(typeof entry === 'string' ? entry : entry?.name || ''))
        .filter((name) => NEEDS_RENDERER.has(name));
}
