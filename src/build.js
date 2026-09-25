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
            const text = expand(readFileSync(path, 'utf8').trim(), path);
            // The file name, minus its ordering prefix, names the chapter for
            // `%% toc: chapters`. It is a Carve comment, so it renders to nothing.
            const title = name.replace(/\.[^.]+$/, '').replace(/^\d+[-_]?/, '').replace(/[-_]/g, ' ');

            return `%% chapter: ${title}\n\n${text}`;
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

/**
 * Append a version marker to a local URL.
 *
 * A static host serves a deck's assets under the same names forever, with a
 * cache lifetime of its own - GitHub Pages sends `max-age=600`. Without a
 * changing URL the browser keeps the old stylesheet and the old bundle for ten
 * minutes, and the only cure the reader knows is a hard refresh.
 */
function versioned(url, version) {
    if (!version || /^(https?:)?\/\//.test(url) || url.startsWith('data:')) {
        return url;
    }

    return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
}

/**
 * The light/dark switch. The choice is remembered per browser, and the first
 * visit follows the reader's own system setting rather than the deck's default.
 * Print asks for the stored theme too, so a PDF comes out in the theme on screen.
 */
export const themeToggle = (defaultDark = false) => `<button class="deck-theme-toggle" type="button" aria-label="Switch between the light and the dark theme">\u25D0</button>
<script>
(function () {
    var key = 'reveal-carve-theme';
    var stored = null;

    try { stored = localStorage.getItem(key); } catch (error) { stored = null; }

    var dark = stored
        ? stored === 'dark'
        : (window.matchMedia('(prefers-color-scheme: dark)').matches || ${defaultDark ? 'true' : 'false'});

    function apply() {
        var links = document.querySelectorAll('link[data-carve-theme]');

        for (var i = 0; i < links.length; i += 1) {
            links[i].disabled = (links[i].dataset.carveTheme === 'dark') !== dark;
        }

        document.documentElement.dataset.carveTheme = dark ? 'dark' : 'light';
    }

    apply();

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.deck-theme-toggle')) {
            return;
        }

        dark = !dark;
        apply();

        try { localStorage.setItem(key, dark ? 'dark' : 'light'); } catch (error) { /* private window */ }
    });
}());
</script>`;

function page(slides, options) {
    const {
        title = 'Presentation',
        lang = 'en',
        revealBase = 'node_modules/reveal.js/dist',
        theme = 'white',
        darkTheme = '',
        darkStylesheets = [],
        defaultDark = false,
        stylesheets = [],
        scripts = [],
        plugins = ['RevealHighlight', 'RevealNotes'],
        config = {},
        sourceName = '',
        footer = '',
        rawScripts = '',
        version = '',
    } = options;

    // A page that loads the plugin bundle needs it in the plugin list too, or
    // the callout badges and diff colours the highlighter throws away are never
    // put back. Passing `--js .../reveal-carve.js` is enough.
    const carvePlugin = scripts.some((src) => /reveal-carve(\.min)?\.js$/.test(src));
    const pluginList = carvePlugin && !plugins.some((name) => name.startsWith('RevealCarve'))
        ? ['RevealCarve()', ...plugins]
        : plugins;

    const stamp = (url) => versioned(url, version);
    const extraStyles = stylesheets
        .map((href) => `<link rel="stylesheet" data-carve-theme="light" href="${stamp(href)}">`)
        .join('\n');
    // A second set of stylesheets, switched by the toggle. `disabled` on a link
    // is what keeps the unused set from painting; both are in the page so the
    // switch costs no request.
    const darkStyles = darkTheme
        ? [`${revealBase}/theme/${darkTheme}.css`, ...darkStylesheets]
            .map((href) => `<link rel="stylesheet" data-carve-theme="dark" href="${stamp(href)}"${defaultDark ? '' : ' disabled'}>`)
            .join('\n')
        : '';
    const extraScripts = scripts.map((src) => `<script src="${stamp(src)}"></script>`).join('\n');
    const generated = sourceName ? `\n<!-- Generated from ${sourceName}. Do not edit by hand. -->` : '';

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="${stamp(`${revealBase}/reset.css`)}">
<link rel="stylesheet" href="${stamp(`${revealBase}/reveal.css`)}">
<link rel="stylesheet" data-carve-theme="light" href="${stamp(`${revealBase}/theme/${theme}.css`)}"${darkTheme && defaultDark ? ' disabled' : ''}>
<link rel="stylesheet" href="${stamp(`${revealBase}/plugin/highlight/monokai.css`)}">
${extraStyles}
${darkStyles}
</head>
<body>${generated}
<div class="reveal">
<div class="slides">

${slides}

</div>
</div>
${footer ? `<footer class="deck-footer">${footer}</footer>` : ''}
${darkTheme ? themeToggle(defaultDark) : ''}
<script src="${stamp(`${revealBase}/reveal.js`)}"></script>
<script src="${stamp(`${revealBase}/plugin/highlight.js`)}"></script>
<script src="${stamp(`${revealBase}/plugin/notes.js`)}"></script>
${extraScripts}
<script>
Reveal.initialize(Object.assign(${JSON.stringify({ ...DEFAULT_CONFIG, ...config }, null, 4)}, {
    plugins: [${pluginList.join(', ')}],
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
