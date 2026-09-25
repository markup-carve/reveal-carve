#!/usr/bin/env node
/**
 * reveal-carve - Carve sources to reveal.js decks.
 *
 *   reveal-carve build <source> <target.html> [options]
 *   reveal-carve watch <source> <target.html> [--port 8800] [options]
 *   reveal-carve lint <source...>
 *   reveal-carve handout <source> <target.md> [--no-notes]
 *
 * `build` is the default, so the verb may be left out.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { buildPage, buildSlides, readSource } from './build.js';
import { buildHandout } from './handout.js';
import { formatFindings, lintSource } from './lint.js';
import { serve } from './dev.js';

const VERBS = ['build', 'watch', 'lint', 'handout'];

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
    const options = { stylesheets: [], scripts: [], carveOptions: {} };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        switch (arg) {
            case '--title':
                options.title = argv[++index];
                break;
            case '--theme':
                options.theme = argv[++index];
                break;
            case '--lang':
                options.lang = argv[++index];
                break;
            case '--reveal-base':
                options.revealBase = argv[++index];
                break;
            case '--css':
                options.stylesheets.push(argv[++index]);
                break;
            case '--js':
                options.scripts.push(argv[++index]);
                break;
            case '--port':
                options.port = Number(argv[++index]);
                break;
            case '--split-at-heading':
                options.splitAtHeading = Number(argv[++index]);
                break;
            case '--animate-lists':
                options.animateLists = true;
                break;
            case '--no-includes':
                options.includes = false;
                break;
            case '--include-root':
                options.includeRoot = argv[++index];
                break;
            case '--no-notes':
                options.notes = false;
                break;
            case '--slides-only':
                options.slidesOnly = true;
                break;
            case '--strict':
                options.throwOnError = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                positional.push(arg);
        }
    }

    return { positional, options };
}

function usage() {
    console.log(`reveal-carve - Carve sources to reveal.js decks

  reveal-carve [build] <source> <target.html>   render a deck
  reveal-carve watch   <source> <target.html>   rebuild on save, reload the browser
  reveal-carve lint    <source...>              check deck sources
  reveal-carve handout <source> <target.md>     export slides plus speaker notes

A source is a .crv file or a directory holding one file per chapter.

Options: --title --theme --lang --reveal-base --css --js --port
         --split-at-heading N --animate-lists --slides-only --strict
         --no-includes --include-root DIR --no-notes`);
}

const argv = process.argv.slice(2);
const verb = VERBS.includes(argv[0]) ? argv.shift() : 'build';
const { positional, options } = parseArgs(argv);
const [source, target] = positional;

if (options.help || (!source && verb !== 'lint')) {
    usage();
    process.exit(options.help ? 0 : 1);
}

const carve = await loadCarve();
const render = (text) => carve.carveToHtml(text, options.carveOptions);

function buildOnce() {
    if (options.slidesOnly) {
        writeFileSync(target, `${buildSlides(source, render, options)}\n`, 'utf8');

        return 0;
    }

    return buildPage({ source, target, render, ...options });
}

switch (verb) {
    case 'lint': {
        const files = positional.length ? positional : ['.'];
        let failed = false;

        for (const file of files) {
            const findings = lintSource(readSource(file, options), options);
            console.log(formatFindings(file, findings));
            failed = failed || findings.some((finding) => finding.level === 'error');
        }

        process.exit(failed ? 1 : 0);
        break;
    }

    case 'handout': {
        const markdown = buildHandout(
            readSource(source, options),
            (text) => carve.carveToMarkdown(text),
            options,
        );
        writeFileSync(target, markdown, 'utf8');
        console.log(`${target}: handout from ${source}`);
        break;
    }

    case 'watch': {
        const root = resolve(dirname(target));
        const rebuild = () => {
            const count = buildOnce();
            console.log(`[reveal-carve] rebuilt ${target} (${count} slides)`);
        };

        rebuild();
        serve({
            root,
            port: options.port,
            watch: ['.'],
            ignore: (filename) => filename.endsWith('.html'),
            onChange: rebuild,
        });
        break;
    }

    default: {
        const count = buildOnce();
        console.log(`${target}: ${count} slides from ${source}`);
    }
}
