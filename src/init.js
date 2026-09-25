/**
 * Scaffold a deck: a chapter directory, a shared partial and the commands to
 * run it. Nothing here is required to use the plugin - it exists so the first
 * deck starts from something that already shows the parts worth knowing about.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
npx reveal-carve watch slides ${name}.html --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js
npx reveal-carve build slides ${name}.html --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js
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
export function initDeck(target) {
    const name = basename(target) || 'deck';
    const files = [
        ['slides/010-opening.crv', OPENING(name.replace(/[-_]/g, ' '))],
        ['slides/020-chapter.crv', CHAPTER],
        ['slides/partials/thanks.crv', PARTIAL],
        ['README.md', README(name)],
    ];
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
