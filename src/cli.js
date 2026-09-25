#!/usr/bin/env node
/**
 * reveal-carve - build a reveal.js deck from Carve sources.
 *
 *   reveal-carve <source.crv|chapter-dir> <target.html> [--title "..."]
 *                [--theme white] [--lang de] [--reveal-base path]
 *                [--css extra.css] [--js extra.js] [--slides-only]
 */

import { writeFileSync } from 'node:fs';

import { buildPage, buildSlides } from './build.js';

// The Carve package publishes ESM only, so this is a dynamic import rather than
// a require: `require('@markup-carve/carve')` fails with ERR_PACKAGE_PATH_NOT_EXPORTED.
async function loadCarve() {
    try {
        return await import('@markup-carve/carve');
    } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND') {
            throw new Error(
                'reveal-carve: @markup-carve/carve is not installed. Run `npm install @markup-carve/carve`.',
            );
        }

        throw error;
    }
}

function parseArgs(argv) {
    const positional = [];
    const options = { stylesheets: [], scripts: [] };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        switch (arg) {
            case '--title':
                options.title = argv[++i];
                break;
            case '--theme':
                options.theme = argv[++i];
                break;
            case '--lang':
                options.lang = argv[++i];
                break;
            case '--reveal-base':
                options.revealBase = argv[++i];
                break;
            case '--css':
                options.stylesheets.push(argv[++i]);
                break;
            case '--js':
                options.scripts.push(argv[++i]);
                break;
            case '--slides-only':
                options.slidesOnly = true;
                break;
            default:
                positional.push(arg);
        }
    }

    return { positional, options };
}

const { positional, options } = parseArgs(process.argv.slice(2));
const [source, target] = positional;

if (!source || !target) {
    console.error('Usage: reveal-carve <source.crv|chapter-dir> <target.html> [options]');
    process.exit(1);
}

const carve = await loadCarve();
const render = (text) => carve.carveToHtml(text, options.carveOptions || {});

if (options.slidesOnly) {
    const slides = buildSlides(source, render, options);
    writeFileSync(target, `${slides}\n`, 'utf8');
    console.log(`${target}: slide markup from ${source}`);
} else {
    const count = buildPage({ source, target, render, ...options });
    console.log(`${target}: ${count} slides from ${source}`);
}
