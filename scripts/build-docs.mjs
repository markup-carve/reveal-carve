#!/usr/bin/env node
/**
 * Docs written in Carve, published as Markdown.
 *
 * GitHub shows a `.crv` file as plain text, so a page linked from the README
 * would arrive as a wall of source. The Carve file stays the original - this is
 * the repo that should be writing its docs in its own language - and the
 * rendered Markdown is generated beside it.
 *
 *   node scripts/build-docs.mjs [--check]
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as carve from '@markup-carve/carve';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');

/**
 * @param {string} name A `.crv` file in docs/
 * @returns {{path: string, markdown: string}}
 */
export function renderDoc(name) {
    const source = readFileSync(join(docs, name), 'utf8');
    const notice = `<!-- Generated from docs/${name} by scripts/build-docs.mjs. Edit that file. -->`;

    return {
        path: join(docs, name.replace(/\.crv$/, '.md')),
        markdown: `${notice}\n\n${carve.carveToMarkdown(source).trim()}\n`,
    };
}

export function carveDocs() {
    return readdirSync(docs).filter((name) => name.endsWith('.crv')).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes('--check');
    let stale = 0;

    for (const name of carveDocs()) {
        const { path, markdown } = renderDoc(name);
        const current = (() => {
            try {
                return readFileSync(path, 'utf8');
            } catch {
                return null;
            }
        })();

        if (current === markdown) {
            continue;
        }

        if (check) {
            console.log(`${path} is out of date. Run: npm run docs`);
            stale += 1;
            continue;
        }

        writeFileSync(path, markdown, 'utf8');
        console.log(`wrote ${path}`);
    }

    process.exit(stale ? 1 : 0);
}
