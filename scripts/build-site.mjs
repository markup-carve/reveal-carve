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

import { buildPage, readSource } from '../src/build.js';
import { buildHandout } from '../src/handout.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'site');

const render = (text) => carve.carveToHtml(text);

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
<script src="vendor/carve.iife.min.js"></script>
<script src="vendor/reveal/reveal.js"></script>
<script src="vendor/reveal/plugin/highlight.js"></script>
<script src="vendor/reveal/plugin/notes.js"></script>
<script src="vendor/reveal-carve/reveal-carve.js"></script>
<script>
Reveal.initialize({
    hash: true,
    slideNumber: 'c/t',
    plugins: [RevealCarve, RevealHighlight, RevealNotes],
});
</script>
</body>
</html>
`,
    'utf8',
);

// 3. The chapter deck, including a shared slide from demo/partials.
const chapters = buildPage({
    source: join(root, 'demo/decks'),
    target: join(out, 'chapters.html'),
    render,
    title: 'reveal-carve - chapters and includes',
    revealBase: 'vendor/reveal',
    stylesheets: ['vendor/reveal-carve/reveal-carve.css'],
    includeRoot: join(root, 'demo'),
});

// 4. The handout export of the chapter deck.
writeFileSync(
    join(out, 'handout.md'),
    buildHandout(
        readSource(join(root, 'demo/decks'), { includeRoot: join(root, 'demo') }),
        (text) => carve.carveToMarkdown(text),
    ),
    'utf8',
);

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
        <li><a class="card" href="chapters.html"><strong>Chapters and includes</strong><span>One file per chapter plus a shared slide pulled in with <code>{{ ... }}</code></span></a></li>
        <li><a class="card" href="handout.md"><strong>Handout export</strong><span>The same source as a document, with the speaker notes as quotes</span></a></li>
        <li><a class="card" href="deck.crv"><strong>deck.crv</strong><span>The source behind the feature deck</span></a></li>
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

console.log(`site: ${out} (features ${slides} slides, chapters ${chapters} slides)`);
