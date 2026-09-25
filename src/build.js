/**
 * Node build step: turn Carve sources into slide markup or a whole page.
 *
 * Use this when the deck should be a static file (for handing out, for a PDF
 * export, or for a site that must not run a renderer in the browser). The
 * runtime plugin in `plugin.js` covers the other case.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { expandIncludes, hasIncludes } from './include.js';
import { renderDeck } from './slice.js';

/**
 * Read a deck source: either one `.crv` file, or a directory holding one file
 * per chapter. Chapters are ordered by file name and joined with the slide
 * separator, so the order is readable from the directory listing.
 */
export function readSource(source, options = {}) {
    const extension = options.extension || '.crv';
    const dependencies = options.dependencies;
    const expand = (text, from) => {
        if (options.includes === false || !hasIncludes(text)) {
            return text;
        }

        if (!options.engine || !options.resolver) {
            throw new Error(
                'reveal-carve: includes need the engine and a resolver. Pass { engine, resolver } '
                + 'or --no-includes.',
            );
        }

        const expanded = expandIncludes(text, {
            from: resolve(from),
            root: options.includeRoot ? resolve(options.includeRoot) : undefined,
            engine: options.engine,
            resolver: options.resolver,
        });

        // The engine reports what a deck was actually built from, which is what
        // watch mode should follow.
        for (const dependency of expanded.dependencies) {
            dependencies?.add(dependency.id);
        }

        return expanded.source;
    };

    if (!statSync(source).isDirectory()) {
        return expand(readFileSync(source, 'utf8'), source);
    }

    const chapters = readdirSync(source)
        .filter((name) => name.endsWith(extension))
        .sort();

    if (!chapters.length) {
        throw new Error(`no ${extension} files in ${source}`);
    }

    return chapters
        .map((name) => {
            const path = join(source, name);

            return expand(readFileSync(path, 'utf8').trim(), path);
        })
        .join('\n\n---\n\n');
}

/**
 * Render a deck source to the markup that belongs inside `.reveal .slides`.
 */
export function buildSlides(source, render, options = {}) {
    return renderDeck(readSource(source, options), render, options).join('\n\n');
}

/**
 * What a deck should do out of the box. A built page used to initialize reveal
 * with nothing at all, so it silently lost the slide counter and deep links that
 * a hand-written page has. Anything here is overridable through `config`.
 */
export const DEFAULT_CONFIG = {
    hash: true,
    slideNumber: 'c/t',
};

function page(slides, options) {
    const {
        title = 'Presentation',
        lang = 'en',
        revealBase = 'node_modules/reveal.js/dist',
        theme = 'white',
        stylesheets = [],
        scripts = [],
        plugins = ['RevealHighlight', 'RevealNotes'],
        config = {},
        sourceName = '',
        footer = '',
        rawScripts = '',
    } = options;

    const extraStyles = stylesheets
        .map((href) => `<link rel="stylesheet" href="${href}">`)
        .join('\n');
    const extraScripts = scripts.map((src) => `<script src="${src}"></script>`).join('\n');
    const generated = sourceName ? `\n<!-- Generated from ${sourceName}. Do not edit by hand. -->` : '';

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${revealBase}/reset.css">
<link rel="stylesheet" href="${revealBase}/reveal.css">
<link rel="stylesheet" href="${revealBase}/theme/${theme}.css">
<link rel="stylesheet" href="${revealBase}/plugin/highlight/monokai.css">
${extraStyles}
</head>
<body>${generated}
<div class="reveal">
<div class="slides">

${slides}

</div>
</div>
${footer ? `<footer class="deck-footer">${footer}</footer>` : ''}
<script src="${revealBase}/reveal.js"></script>
<script src="${revealBase}/plugin/highlight.js"></script>
<script src="${revealBase}/plugin/notes.js"></script>
${extraScripts}
<script>
Reveal.initialize(Object.assign(${JSON.stringify({ ...DEFAULT_CONFIG, ...config }, null, 4)}, {
    plugins: [${plugins.join(', ')}],
}));
</script>
${rawScripts}
</body>
</html>
`;
}

/**
 * Render a deck source to a complete HTML page and write it to `target`.
 * Returns the number of top-level slides.
 */
export function buildPage({ source, target, render, ...options }) {
    const text = readSource(source, options);
    const slides = renderDeck(text, render, options);

    writeFileSync(
        target,
        page(slides.join('\n\n'), { ...options, sourceName: basename(source) }),
        'utf8',
    );

    return slides.length;
}
