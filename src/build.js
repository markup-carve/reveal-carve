/**
 * Node build step: turn Carve sources into slide markup or a whole page.
 *
 * Use this when the deck should be a static file (for handing out, for a PDF
 * export, or for a site that must not run a renderer in the browser). The
 * runtime plugin in `plugin.js` covers the other case.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { renderDeck } from './slice.js';

/**
 * Read a deck source: either one `.crv` file, or a directory holding one file
 * per chapter. Chapters are ordered by file name and joined with the slide
 * separator, so the order is readable from the directory listing.
 */
export function readSource(source, options = {}) {
    const extension = options.extension || '.crv';

    if (!statSync(source).isDirectory()) {
        return readFileSync(source, 'utf8');
    }

    const chapters = readdirSync(source)
        .filter((name) => name.endsWith(extension))
        .sort();

    if (!chapters.length) {
        throw new Error(`no ${extension} files in ${source}`);
    }

    return chapters
        .map((name) => readFileSync(join(source, name), 'utf8').trim())
        .join('\n\n---\n\n');
}

/**
 * Render a deck source to the markup that belongs inside `.reveal .slides`.
 */
export function buildSlides(source, render, options = {}) {
    return renderDeck(readSource(source, options), render, options).join('\n\n');
}

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
<script src="${revealBase}/reveal.js"></script>
<script src="${revealBase}/plugin/highlight.js"></script>
<script src="${revealBase}/plugin/notes.js"></script>
${extraScripts}
<script>
Reveal.initialize(Object.assign(${JSON.stringify(config, null, 4)}, {
    plugins: [${plugins.join(', ')}],
}));
</script>
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
