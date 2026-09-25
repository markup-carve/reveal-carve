#!/usr/bin/env node
// Builds the published demo site: the feature deck in both flavors (rendered in
// the browser and pre-rendered), the chapter deck, and the handout export.
//
// Runs locally exactly as it runs in CI, so the published page is never a
// surprise: node scripts/build-site.mjs [outDir]

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as carve from '@markup-carve/carve';
import { fileSystemResolver } from '@markup-carve/carve/node';

import { buildPage, readSource } from '../src/build.js';
import { buildHandout } from '../src/handout.js';
import { exportPdf } from '../src/pdf.js';
import { resolveExtensions } from '../src/extensions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'site');

// The published demo turns on the extensions it shows off. One list, used by
// the build step and handed to the runtime page as names, so the same source
// cannot render differently in the two paths.
const EXTENSIONS = [
    'mermaid',
    'chart',
    'mathBlock',
    { name: 'imgFence', options: { language: 'svg' } },
    'details',
    { name: 'tabs', options: { mode: 'aria' } },
    'listTable',
    'spoiler',
    'colorSwatch',
    'semanticSpan',
    'codeCallouts',
    { name: 'smartQuotes', options: { locale: 'en' } },
];

const extensions = resolveExtensions(EXTENSIONS, carve);
const render = (text) => carve.carveToHtml(text, { sections: false, extensions });

// Includes are resolved by the engine, with its own root containment.
const includes = { engine: carve, resolver: fileSystemResolver };

// Mermaid draws what Carve emits. The demo site pulls it from a CDN; an offline
// deck vendors it instead.
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
// startOnLoad is wrong for the runtime path: the plugin inserts the slides after
// the document has loaded, so Mermaid would find nothing. Run it on reveal's
// ready event instead, which fires after every plugin's init has resolved.
const MERMAID_INIT = `<script type="module">
import mermaid from '${MERMAID.replace('.min.js', '.esm.min.mjs')}';
mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
Reveal.on('ready', function () { mermaid.run(); });
</script>`;

// The renderers the diagram, chart and math extensions hand their markup to.
const RENDERERS = `${MERMAID_INIT}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script>
// Same reason as Mermaid: wait for reveal, not for the document.
Reveal.on('ready', function () {
    document.querySelectorAll('.chart').forEach(function (holder) {
        var data = holder.querySelector('script[type="application/json"]');
        if (!data || holder.querySelector('canvas')) { return; }
        var canvas = document.createElement('canvas');
        holder.appendChild(canvas);
        new Chart(canvas, JSON.parse(data.textContent));
    });

    document.querySelectorAll('.spoiler').forEach(function (spoiler) {
        spoiler.addEventListener('click', function () { spoiler.classList.toggle('revealed'); });
    });

    // mathBlock emits \\[ … \\], which is what KaTeX's auto-render looks for.
    if (window.renderMathInElement) {
        renderMathInElement(document.body, {
            delimiters: [
                { left: '\\\\[', right: '\\\\]', display: true },
                { left: '$$', right: '$$', display: true },
            ],
        });
    }
});
</script>`;

const REPO = 'https://github.com/markup-carve/reveal-carve';

// Every published deck says where it came from and what it was built with.
const footerFor = (sourcePath) => [
    '<a href="index.html">Overview</a>',
    `<span>Built with <a href="https://markup-carve.github.io/carve/">Carve</a></span>`,
    `<a href="${REPO}">reveal-carve on GitHub</a>`,
    `<a href="${REPO}/blob/main/${sourcePath}">Slide source</a>`,
].join('\n');


mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'vendor'), { recursive: true });

// Vendor the two runtime dependencies so the site is self-contained.
cpSync(join(root, 'node_modules/reveal.js/dist'), join(out, 'vendor/reveal'), { recursive: true });
cpSync(
    join(root, 'node_modules/@markup-carve/carve/dist/carve.iife.min.js'),
    join(out, 'vendor/carve.iife.min.js'),
);
cpSync(join(root, 'dist'), join(out, 'vendor/reveal-carve'), { recursive: true });
cpSync(join(root, 'demo/deck.crv'), join(out, 'deck.crv'));

// 1. The feature deck, pre-rendered by the build step.
const slides = buildPage({
    source: join(root, 'demo/deck.crv'),
    target: join(out, 'features.html'),
    render,
    title: 'reveal-carve - features',
    revealBase: 'vendor/reveal',
    stylesheets: ['vendor/reveal-carve/reveal-carve.css'],
    footer: footerFor('demo/deck.crv'),
    rawScripts: RENDERERS,
});

// 2. The same source, rendered in the browser by the plugin.
writeFileSync(
    join(out, 'runtime.html'),
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>reveal-carve - rendered in the browser</title>
<link rel="stylesheet" href="vendor/reveal/reset.css">
<link rel="stylesheet" href="vendor/reveal/reveal.css">
<link rel="stylesheet" href="vendor/reveal/theme/white.css">
<link rel="stylesheet" href="vendor/reveal/plugin/highlight/monokai.css">
<link rel="stylesheet" href="vendor/reveal-carve/reveal-carve.css">
</head>
<body>
<div class="reveal">
<div class="slides">
<section data-carve="deck.crv"></section>
</div>
</div>
<footer class="deck-footer">
${footerFor('demo/deck.crv')}
</footer>
<script src="vendor/carve.iife.min.js"></script>
<script src="vendor/reveal/reveal.js"></script>
<script src="vendor/reveal/plugin/highlight.js"></script>
<script src="vendor/reveal/plugin/notes.js"></script>
<script src="vendor/reveal-carve/reveal-carve.js"></script>
<script>
Reveal.initialize({
    hash: true,
    slideNumber: 'c/t',
    carve: { extensions: ${JSON.stringify(EXTENSIONS)}, tabs: true },
    plugins: [RevealCarve, RevealHighlight, RevealNotes],
});
</script>
${RENDERERS}
</body>
</html>
`,
    'utf8',
);

// 3. The showcase: every Carve construct a deck can use, with its renderer.
const showcase = buildPage({
    source: join(root, 'demo/showcase.crv'),
    target: join(out, 'showcase.html'),
    render,
    title: 'reveal-carve - everything on a slide',
    revealBase: 'vendor/reveal',
    stylesheets: ['vendor/reveal-carve/reveal-carve.css'],
    footer: footerFor('demo/showcase.crv'),
    rawScripts: RENDERERS,
});

// 4. The language deck: the rest of the constructs, plus element mapping.
const language = buildPage({
    source: join(root, 'demo/language.crv'),
    target: join(out, 'language.html'),
    render,
    title: 'reveal-carve - the rest of the language',
    revealBase: 'vendor/reveal',
    stylesheets: ['vendor/reveal-carve/reveal-carve.css'],
    footer: footerFor('demo/language.crv'),
    rawScripts: RENDERERS,
    elements: { card: 'figure' },
    // The built page loads the plugin too, for the tab runtime: the aria output
    // is the accessible shape and needs a script to drive it.
    scripts: ['vendor/reveal-carve/reveal-carve.js'],
    plugins: ['RevealCarve()', 'RevealHighlight', 'RevealNotes'],
    config: { hash: true, slideNumber: 'c/t', carve: { tabs: true } },
});

// 5. The chapter deck, including a shared slide from demo/partials.
const chapters = buildPage({
    source: join(root, 'demo/decks'),
    target: join(out, 'chapters.html'),
    render,
    title: 'reveal-carve - chapters and includes',
    revealBase: 'vendor/reveal',
    stylesheets: ['vendor/reveal-carve/reveal-carve.css'],
    includeRoot: join(root, 'demo'),
    ...includes,
    footer: footerFor('demo/decks'),
});

// 6. The handout export of the chapter deck.
writeFileSync(
    join(out, 'handout.md'),
    buildHandout(
        readSource(join(root, 'demo/decks'), { includeRoot: join(root, 'demo'), ...includes }),
        (text) => carve.carveToMarkdown(text),
    ),
    'utf8',
);

// The PDF of the feature deck, printed the way the CLI does it. Skipped when no
// Chrome is around, because the site is still complete without it.
let pdf = true;

try {
    await exportPdf(join(out, 'features.html'), join(out, 'features.pdf'));
} catch (error) {
    pdf = false;
    console.warn(`[build-site] no PDF: ${error.message}`);
}

const source = readFileSync(join(root, 'demo/deck.crv'), 'utf8');
const sourceLines = source.split('\n').length;

writeFileSync(
    join(out, 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>reveal-carve</title>
<style>
    :root { --accent: #d33c43; --muted: #6b7280; }
    * { box-sizing: border-box; }
    body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; margin: 0; padding: 3rem 1.5rem;
           background: #f6f7f9; color: #1f2937; line-height: 1.55; }
    main { max-width: 760px; margin: 0 auto; }
    h1 { border-bottom: 6px solid var(--accent); display: inline-block; padding-bottom: .2rem; margin-bottom: .3rem; }
    p.lead { color: var(--muted); margin-top: 0; font-size: 1.1rem; }
    h2 { margin-top: 2.5rem; font-size: .95rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: .75rem; }
    a.card { display: block; background: #fff; border: 1px solid #e3e5e9; border-left: 5px solid var(--accent);
             border-radius: 6px; padding: 1rem 1.2rem; text-decoration: none; color: inherit; }
    a.card:hover { border-color: var(--accent); }
    a.card strong { display: block; font-size: 1.05rem; }
    a.card span { color: var(--muted); font-size: .92rem; }
    pre { background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: .85rem; }
    code { font-family: "JetBrains Mono", monospace; }
    footer { margin-top: 3rem; color: var(--muted); font-size: .88rem; }
    footer a { color: var(--accent); }
</style>
</head>
<body>
<main>
    <h1>reveal-carve</h1>
    <p class="lead">Write reveal.js presentations in Carve markup.</p>

    <h2>See it</h2>
    <ul>
        <li><a class="card" href="features.html"><strong>Feature deck</strong><span>${slides} slides from ${sourceLines} lines of Carve: stepwise code highlighting, two-column comparisons, fragments, speaker notes</span></a></li>
        <li><a class="card" href="runtime.html"><strong>The same deck, rendered in your browser</strong><span>No build step: the plugin fetches deck.crv and renders it on load</span></a></li>
        <li><a class="card" href="showcase.html"><strong>Everything on a slide</strong><span>${showcase} slides: Mermaid diagrams, a Chart.js chart, KaTeX math, inline SVG, footnotes, task lists, admonitions, semantic spans</span></a></li>
        <li><a class="card" href="language.html"><strong>The rest of the language</strong><span>${language} slides: tabs, folded details, a table of block content, spoilers, code callouts, auto-animate, and a container rendered as a real <code>&lt;figure&gt;</code></span></a></li>
        <li><a class="card" href="chapters.html"><strong>Chapters and includes</strong><span>One file per chapter plus a shared slide pulled in with <code>{{ ... }}</code></span></a></li>
        <li><a class="card" href="handout.md"><strong>Handout export (Markdown)</strong><span>The same source as a Markdown document, with the speaker notes quoted under each slide</span></a></li>
        <li><a class="card" href="deck.crv"><strong>deck.crv</strong><span>The source behind the feature deck</span></a></li>
        ${pdf ? '<li><a class="card" href="features.pdf"><strong>The same deck as a PDF</strong><span>Printed by <code>reveal-carve pdf</code> through headless Chrome</span></a></li>' : ''}
    </ul>

    <h2>Use it</h2>
<pre><code>npm install @markup-carve/reveal-carve @markup-carve/carve reveal.js

npx reveal-carve build slides/deck.crv deck.html
npx reveal-carve watch slides/ deck.html      # rebuild and reload on save
npx reveal-carve lint slides/                 # catch a mistyped directive
npx reveal-carve handout slides/ handout.md   # slides plus spoken notes</code></pre>

    <footer>
        Built from the repository on every push.
        <a href="https://github.com/markup-carve/reveal-carve">Source on GitHub</a>.
    </footer>
</main>
</body>
</html>
`,
    'utf8',
);

cpSync(join(root, 'demo/showcase.crv'), join(out, 'showcase.crv'));
cpSync(join(root, 'demo/language.crv'), join(out, 'language.crv'));

console.log(
    `site: ${out} (features ${slides}, showcase ${showcase}, language ${language}, `
    + `chapters ${chapters} slides)`,
);
