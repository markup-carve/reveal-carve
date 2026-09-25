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

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

import { buildPage, buildSlides, readSource } from './build.js';
import { IncludeError } from './include.js';
import { buildHandout } from './handout.js';
import { formatFindings, lintSource } from './lint.js';
import { serve } from './dev.js';
import { missingRenderers, parseExtensionArgument, resolveExtensions } from './extensions.js';
import { deckMinutes } from './slice.js';
import { exportPdf } from './pdf.js';
import { vendorAssets } from './vendor.js';
import { initDeck } from './init.js';

const VERBS = ['init', 'build', 'watch', 'lint', 'handout', 'pdf', 'agenda', 'vendor', 'check'];

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
    const options = { stylesheets: [], scripts: [], carveOptions: {}, extensions: [] };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        switch (arg) {
            case '--title':
                options.title = argv[++index];
                break;
            case '--theme':
                options.theme = argv[++index];
                break;
            case '--dark-theme':
                options.darkTheme = argv[++index];
                break;
            case '--dark-css':
                options.darkStylesheets = [...(options.darkStylesheets || []), argv[++index]];
                break;
            case '--dark':
                options.defaultDark = true;
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
            case '--footer':
                options.footer = argv[++index];
                break;
            case '--footer-file':
                options.footer = readFileSync(argv[++index], 'utf8').trim();
                break;
            case '--extension':
                options.extensions.push(parseExtensionArgument(argv[++index]));
                break;
            case '--smart-quotes':
                options.extensions.push({ name: 'smartQuotes', options: { locale: argv[++index] } });
                break;
            case '--element':
                {
                    const [name, element] = argv[++index].split('=');
                    options.elements = { ...(options.elements || {}), [name]: element };
                }
                break;
            case '--version':
                options.version = argv[++index];
                break;
            case '--budget':
                options.budget = Number(argv[++index]);
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
            case '--no-reveal-spoilers':
                options.revealSpoilers = false;
                break;
            case '--no-notes':
                options.notes = false;
                break;
            case '--slides-only':
                options.slidesOnly = true;
                break;
            case '--static':
                options.carveOptions.mode = 'static';
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

/**
 * Where Carve's own `carve` command lives, or null when it is not installed.
 */
function locateCarveCli() {
    try {
        const require = createRequire(import.meta.url);
        const manifest = require.resolve('@markup-carve/carve/package.json');
        const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
        const entry = typeof bin === 'string' ? bin : Object.values(bin || {})[0];

        if (!entry) {
            return null;
        }

        const file = join(dirname(manifest), entry);

        return existsSync(file) ? file : null;
    } catch {
        return null;
    }
}

// A path that is not a URL is made absolute, for pages written somewhere else.
function absoluteAsset(path) {
    return /^(https?:)?\/\/|^data:/.test(path) ? path : resolve(path);
}

function usage() {
    console.log(`reveal-carve - Carve sources to reveal.js decks

  reveal-carve init    <dir>                    write a starter deck
  reveal-carve [build] <source> <target.html>   render a deck
  reveal-carve watch   <source> <target.html>   rebuild on save, reload the browser
  reveal-carve lint    <source...>              check deck sources
  reveal-carve handout <source> <target.md>     export slides plus speaker notes
  reveal-carve pdf     <deck.html> <out.pdf>    print the deck with headless Chrome
  reveal-carve agenda  <source>                 list the slides and their planned minutes
  reveal-carve vendor  <dir>                    copy reveal, Carve and the renderers next to a deck
  reveal-carve check   <source...>              carve lint, carve fmt and the deck rules in one go

A source is a .crv file or a directory holding one file per chapter.

Options: --title --theme --lang --reveal-base --css --js --port
         --dark-theme NAME --dark-css FILE --dark
         --extension NAME[:VALUE|:JSON] --smart-quotes LOCALE
         --element CLASS=ELEMENT
         --footer "<html>" --footer-file FILE --version MARKER
         --split-at-heading N --animate-lists --slides-only --strict --static
         --no-includes --include-root DIR --no-notes --no-reveal-spoilers`);
}

const argv = process.argv.slice(2);
const verb = VERBS.includes(argv[0]) ? argv.shift() : 'build';
const { positional, options } = parseArgs(argv);
const [source, target] = positional;

if (options.help || (!source && verb !== 'lint')) {
    usage();
    process.exit(options.help ? 0 : 1);
}

// A scaffold needs no engine, so it is handled before the rest is loaded.
if (verb === 'init') {
    const written = initDeck(source);

    for (const file of written) {
        console.log(`  ${file}`);
    }

    console.log(written.length
        ? `\n${source}: ${written.length} file(s). Next:\n`
            + `  cd ${source}\n`
            + '  npx reveal-carve vendor vendor\n'
            + '  npx reveal-carve watch slides deck.html --reveal-base vendor/reveal'
            + ' --css vendor/reveal-carve.css --js vendor/reveal-carve.js\n'
            + '\nThe README in there has the rest.'
        : `${source}: nothing written, the files are already there.`);
    process.exit(0);
}

const carve = await loadCarve();
const { fileSystemResolver } = await import('@markup-carve/carve/node');

options.engine = carve;
options.resolver = fileSystemResolver;
options.dependencies = new Set();

const extensions = resolveExtensions(options.extensions, carve);
const render = (text) => carve.carveToHtml(text, {
    sections: false,
    ...options.carveOptions,
    extensions,
});

const pending = missingRenderers(options.extensions);

if (pending.length && !options.scripts.length) {
    console.warn(
        `[reveal-carve] ${pending.join(', ')} produce markup that needs their own renderer on the `
        + 'page. Add it with --js, or the slide shows an empty block.',
    );
}

function buildOnce() {
    if (options.slidesOnly) {
        writeFileSync(target, `${buildSlides(source, render, options)}\n`, 'utf8');

        return 0;
    }

    return buildPage({ source, target, render, ...options });
}

// An unresolved include is a mistake in the deck, not a crash: it is reported
// like any other finding, with the flag that usually fixes it.
try {
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

        case 'agenda': {
            const plan = deckMinutes(readSource(source, options), options);

            for (const slide of plan.slides) {
                const minutes = slide.minutes ? `${String(slide.minutes).padStart(3)} min` : '      -';
                console.log(`${minutes}  ${slide.heading || '(no heading)'}`);
            }

            console.log(`\nTotal: ${plan.total} min over ${plan.planned} planned slides.`);

            if (options.budget && plan.total > options.budget) {
                console.error(`Over budget by ${plan.total - options.budget} min.`);
                process.exit(1);
            }

            break;
        }

        case 'vendor': {
            const { copied, missing } = vendorAssets(source || 'vendor');

            for (const entry of copied) {
                console.log(`  ${entry.target.padEnd(20)} from ${entry.name}`);
            }

            if (missing.length) {
                console.log('\nNot installed, so not copied:');

                for (const entry of missing) {
                    console.log(`  ${entry.name.padEnd(22)} ${entry.what}`);
                }

                console.log(`\nInstall what you need: npm install ${missing.map((e) => e.name).join(' ')}`);
            }

            console.log(`\n${copied.length} file(s) in ${source || 'vendor'}`);
            break;
        }

        case 'check': {
            const files = positional.length ? positional : ['.'];
            // Carve's own CLI is found through the package, not by a path relative
            // to this file: installed as a dependency it sits beside this package
            // rather than under it.
            const carveCli = locateCarveCli();
            const { spawnSync } = await import('node:child_process');
            let failed = false;

            if (!carveCli) {
                console.log(
                    'check: @markup-carve/carve has no CLI here, so carve lint and carve fmt are skipped. '
                    + 'The deck rules below still ran.',
                );
            }

            const runCarve = (args) => {
                if (!carveCli) {
                    return true;
                }

                const result = spawnSync(process.execPath, [carveCli, ...args], { encoding: 'utf8' });

                if (result.status !== 0) {
                    failed = true;
                    console.log((result.stdout || result.stderr).trim());
                }

                return result.status === 0;
            };

            for (const file of files) {
                const sources = statSync(file).isDirectory()
                    ? readdirSync(file).filter((name) => name.endsWith('.crv')).map((name) => join(file, name))
                    : [file];

                for (const path of sources) {
                    runCarve(['lint', path]);
                    runCarve(['fmt', '--check', path]);
                }

                const findings = lintSource(readSource(file, options), options);
                console.log(formatFindings(file, findings));
                failed = failed || findings.some((finding) => finding.level === 'error');
            }

            console.log(failed ? '\ncheck: problems found' : '\ncheck: clean');
            process.exit(failed ? 1 : 0);
            break;
        }

        case 'pdf': {
            // A deck source is printed from a copy of its own: Carve's static mode
            // unfolds tabs and code groups into sections, so every panel reaches the
            // page instead of only the selected one, and no renderer is pulled from
            // a CDN while headless Chrome is trying to print.
            const fromSource = !source.endsWith('.html');
            let deck = source;
            let expectedPages = 0;

            if (fromSource) {
                deck = join(tmpdir(), `reveal-carve-print-${Date.now()}.html`);
                expectedPages = buildPage({
                    source,
                    target: deck,
                    render: (text) => carve.carveToHtml(text, {
                        sections: false,
                        mode: 'static',
                        ...options.carveOptions,
                        extensions,
                    }),
                    ...options,
                    // A handout cannot be clicked, so a spoiler gets its answer on
                    // a repeated slide.
                    revealSpoilers: options.revealSpoilers !== false,
                    revealBase: options.revealBase
                        ? resolve(options.revealBase)
                        : resolve('node_modules/reveal.js/dist'),
                    // The print copy is written to a temp directory, so a relative
                    // asset path would resolve against that directory and load
                    // nothing. Local paths are made absolute; URLs are left alone.
                    stylesheets: (options.stylesheets || []).map(absoluteAsset),
                    // Unfolded tabs make a slide taller than the screen version, so
                    // let an overlong one run onto a second page instead of being cut.
                    config: { pdfMaxPagesPerSlide: 3, ...options.config },
                    // The print copy loads the plugin as well: the highlighter
                    // rebuilds a code block and drops the callout badges and diff
                    // line markers with it, and the plugin is what puts them back.
                    scripts: [
                        ...(options.scripts || []).map(absoluteAsset),
                        new URL('../dist/reveal-carve.js', import.meta.url).pathname,
                    ],
                    plugins: ['RevealCarve()', 'RevealHighlight', 'RevealNotes'],
                });
            }

            const result = await exportPdf(deck, target, { expectedPages });
            console.log(`${target}: ${result.pages} pages from ${source}`);
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
                options.dependencies.clear();
                const count = buildOnce();
                const included = options.dependencies.size;
                console.log(
                    `[reveal-carve] rebuilt ${target} (${count} slides`
                    + `${included ? `, ${included} included file${included === 1 ? '' : 's'}` : ''})`,
                );
            };

            rebuild();

            // The engine reports which files a deck was actually built from, so an
            // edit to an included partial rebuilds the deck that pulls it in - even
            // when that partial lives outside the directory being served.
            const watched = new Set(['.']);

            for (const dependency of options.dependencies) {
                watched.add(dirname(dependency));
            }

            serve({
                root,
                port: options.port,
                watch: [...watched].filter((dir) => dir === '.' || resolve(dir).startsWith(root)),
                extraWatch: [...options.dependencies].filter((file) => !resolve(file).startsWith(root)),
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
} catch (error) {
    if (!(error instanceof IncludeError)) {
        throw error;
    }

    console.error(`reveal-carve: ${error.message}`);

    // The flag only helps when the path pointed outside the root; a plain typo
    // in a file name is a different problem, and saying otherwise sends the
    // reader after the wrong thing.
    if (error.message.includes('..')) {
        console.error(
            'An include may not leave the source\'s own directory.'
            + ' Point --include-root at the directory they share.',
        );
    }

    process.exit(1);
}
