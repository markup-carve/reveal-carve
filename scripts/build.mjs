#!/usr/bin/env node
// Two artifacts from one source, the way reveal.js ships its own plugins:
// an ESM module with a default-exported factory, and a UMD file that assigns the
// same factory to window.RevealCarve.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { build } from 'esbuild';

const shared = {
    entryPoints: ['src/plugin.js'],
    bundle: true,
    target: ['es2020'],
    // The Carve engine is a peer dependency: a page should load one engine, no
    // matter how many plugins use it.
    external: ['@markup-carve/carve'],
    banner: { js: '/*! @markup-carve/reveal-carve - MIT */' },
};

await build({
    ...shared,
    format: 'esm',
    outfile: 'dist/reveal-carve.mjs',
});

await build({
    ...shared,
    format: 'cjs',
    outfile: 'dist/reveal-carve.cjs',
});

await build({
    ...shared,
    format: 'iife',
    globalName: 'RevealCarve',
    footer: {
        js: 'if (typeof RevealCarve !== "undefined" && RevealCarve.default) { RevealCarve = RevealCarve.default; }',
    },
    outfile: 'dist/reveal-carve.js',
});

mkdirSync('dist', { recursive: true });
copyFileSync('src/theme.css', 'dist/reveal-carve.css');
// The dark theme imports the light one, and the file is renamed on the way
// into dist - without rewriting the import the dark deck loads twelve rules
// and none of the layout.
writeFileSync(
    'dist/reveal-carve-dark.css',
    readFileSync('src/theme-dark.css', 'utf8').replace('@import "./theme.css";', '@import "./reveal-carve.css";'),
    'utf8',
);

console.log('dist/: reveal-carve.mjs, .cjs, .js and both themes written');
