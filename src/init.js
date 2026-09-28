/**
 * Scaffold a deck: a chapter directory, a shared partial and the commands to
 * run it. Nothing here is required to use the plugin - it exists so the first
 * deck starts from something that already shows the parts worth knowing about.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { rendererNames } from './renderers.js';
import { fileURLToPath } from 'node:url';
import { basename, join } from 'node:path';

const FENCE = '```';

const OPENING = (title) => `%% class: center

%% minutes: 5

# ${title}

Written in Carve, shown with reveal.js.

%% notes

Speaker notes live under the slide. They reach the speaker view and the handout,
never the screen.

---

%% toc

## Agenda

---

## The first slide

- Bullets are bullets
- Inline code stays as written: \`$this->find()\`
- *Strong*, _emphasis_, and a footnote[^1]

[^1]: Footnotes land at the foot of the slide.
`;

const CHAPTER = `%% minutes: 15

## Two columns

{.two-col}
:::
{.before}
::::
### Before

${FENCE}php
$query = $table->find();
$query->order([
    'created' => 'DESC',
]);
${FENCE}
::::

{.after}
::::
### After

${FENCE}php
$query = $table->find();
$query->orderBy([
    'created' => 'DESC',
]);
${FENCE}
::::
:::

---

## What changed

{.diff}
${FENCE}php
 $query = $table->find();
-$query->order([
+$query->orderBy([
     'created' => 'DESC',
 ]);
${FENCE}

---

{{ partials/thanks.crv }}
`;

const PARTIAL = `## Thank you

Included from \`slides/partials/thanks.crv\`, so every deck ends the same way.
`;

const README = (name) => `# ${name}

Run these from this directory. The first one copies reveal.js, the Carve engine
and the plugin's theme into \`vendor/\`, so the deck loads everything from next to
itself and works with no network.

${FENCE} bash
npx reveal-carve vendor vendor
npx reveal-carve watch slides ${name}.html --title "${name}" --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js \\
    --dark-theme black --dark-css vendor/reveal-carve-dark.css
npx reveal-carve build slides ${name}.html --title "${name}" --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js \\
    --dark-theme black --dark-css vendor/reveal-carve-dark.css
npx reveal-carve pdf   slides ${name}.pdf --reveal-base vendor/reveal --css vendor/reveal-carve.css
npx reveal-carve agenda slides
npx reveal-carve check slides
${FENCE}

Slides are one file per chapter under \`slides/\`, joined in file-name order.
Shared slides live in \`slides/partials/\` and come in with \`{{ partials/name.crv }}\`.
`;

/**
 * Write a starter deck into `target`, skipping any file that is already there.
 *
 * @param {string} target Directory to create the deck in
 * @returns {string[]} The files written, relative to the target
 */
export function initDeck(target, options = {}) {
    if (options.preset && options.preset !== 'training') {
        throw new Error(`Unknown preset: ${options.preset}. Choose training.`);
    }
    if (options.renderers && options.preset !== 'training') {
        throw new Error('--with on init requires --preset training.');
    }
    const name = basename(target) || 'deck';
    let files = [
        ['slides/010-opening.crv', OPENING(name.replace(/[-_]/g, ' '))],
        ['slides/020-chapter.crv', CHAPTER],
        ['slides/partials/thanks.crv', PARTIAL],
        ['README.md', README(name)],
    ];
    if (options.preset === 'training') {
        const names = rendererNames(options.renderers || ['mermaid', 'katex']);
        if (!names.includes('mermaid') || !names.includes('katex')) {
            throw new Error('The training preset needs --with mermaid,katex for its examples.');
        }
        const directory = fileURLToPath(new URL('./templates/training/', import.meta.url));
        const collect = (base = '') => readdirSync(join(directory, base), { withFileTypes: true })
            .flatMap((entry) => entry.isDirectory() ? collect(join(base, entry.name))
                : [[join(base, entry.name), readFileSync(join(directory, base, entry.name), 'utf8')]]);
        files = collect().map(([path, content]) => [path === 'gitignore' ? '.gitignore' : path, content]);
        const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
        files.push(['package.json', JSON.stringify({
            name: 'carve-training-deck', private: true, type: 'module',
            scripts: Object.fromEntries(['start', 'build', 'pdf', 'handout', 'agenda', 'check']
                .map((command) => [command, `node deck.mjs ${command === 'start' ? 'watch' : command}`])),
            dependencies: {
                '@markup-carve/reveal-carve': `^${version}`,
                '@markup-carve/carve': '^0.1.7', 'reveal.js': '^6.0.2',
                mermaid: '^11.0.0', katex: '^0.16.0',
            },
        }, null, 2) + '\n']);
    }
    const written = [];

    for (const [path, content] of files) {
        const file = join(target, path);

        if (existsSync(file)) {
            continue;
        }

        mkdirSync(join(target, path.split('/').slice(0, -1).join('/')), { recursive: true });
        writeFileSync(file, content, 'utf8');
        written.push(path);
    }

    return written;
}
