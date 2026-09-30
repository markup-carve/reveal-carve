/**
 * The command line, as data.
 *
 * Argument parsing is the part of the CLI worth testing: every flag is a
 * promise to somebody's build script. It lives here so a test can call it
 * without spawning a process or building a deck.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import { parseExtensionArgument } from './extensions.js';
import { rendererNames } from './renderers.js';

export const VERBS = ['init', 'build', 'watch', 'lint', 'handout', 'pdf', 'agenda', 'vendor', 'check'];

export function parseArgs(argv) {
    const positional = [];
    const options = { stylesheets: [], scripts: [], carveOptions: {}, extensions: [], withoutExtensions: [] };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        switch (arg) {
            case '--preset':
                options.preset = argv[++index];
                break;
            case '--no-renderers':
                options.renderers = [];
                break;
            case '--with':
                options.renderers = rendererNames(argv[++index] ?? '');
                break;
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
            case '--no-extension':
                options.withoutExtensions.push(argv[++index]);
                break;
            case '--core-only':
                options.coreOnly = true;
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
                // A typo in a flag used to become a file name, and the command
                // then failed somewhere else entirely - or worse, quietly built
                // the wrong thing.
                if (arg.startsWith('-') && arg !== '-') {
                    throw new Error(`unknown option ${arg}. Run reveal-carve --help for the list.`);
                }

                positional.push(arg);
        }
    }

    return { positional, options };
}

/**
 * Where Carve's own `carve` command lives, or null when it is not installed.
 */
export function locateCarveCli() {
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
export function absoluteAsset(path) {
    return /^(https?:)?\/\/|^data:/.test(path) ? path : resolve(path);
}

export function usage() {
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

Options: --preset training --with mermaid,katex --no-renderers
         --title --theme --lang --reveal-base --css --js --port
         --dark-theme NAME --dark-css FILE --dark
         --extension NAME[:VALUE|:JSON] --no-extension NAME --core-only
         --smart-quotes LOCALE
         --element CLASS=ELEMENT
         --footer "<html>" --footer-file FILE --version MARKER
         --split-at-heading N --animate-lists --slides-only --strict --static
         --no-includes --include-root DIR --no-notes --no-reveal-spoilers`);
}
