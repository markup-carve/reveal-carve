/**
 * Vendoring: put everything a deck loads next to the deck.
 *
 * A deck presented in a room with no wifi cannot fetch Mermaid from a CDN, and
 * the failure is silent - the slide simply shows the diagram source. This copies
 * what is installed into the deck's own directory and reports what is missing,
 * so the gap is found at the desk rather than at the lectern.
 */

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Each entry: the package, the files to copy, and what it is for.
 */
export const VENDORABLE = [
    {
        name: 'reveal.js',
        from: 'reveal.js/package.json',
        copy: [{ source: 'dist', target: 'reveal' }],
        what: 'the presentation framework itself',
    },
    {
        name: '@markup-carve/carve',
        from: '@markup-carve/carve/package.json',
        copy: [{ source: 'dist/carve.iife.min.js', target: 'carve.iife.min.js' }],
        what: 'the Carve engine, for decks rendered in the browser',
    },
    {
        name: 'mermaid',
        from: 'mermaid/package.json',
        copy: [{ source: 'dist/mermaid.min.js', target: 'mermaid.min.js' }],
        what: 'diagrams',
    },
    {
        name: 'chart.js',
        from: 'chart.js/package.json',
        copy: [{ source: 'dist/chart.umd.js', target: 'chart.umd.js' }],
        what: 'charts',
    },
    {
        name: 'katex',
        from: 'katex/package.json',
        copy: [{ source: 'dist', target: 'katex' }],
        what: 'math',
    },
];

function locate(entry) {
    // Not every package exports its package.json, so fall back to walking up
    // from whatever entry point it does export.
    try {
        return dirname(require.resolve(entry.from));
    } catch {
        // continue
    }

    try {
        const main = require.resolve(entry.name);
        const marker = `node_modules/${entry.name}`;
        const cut = main.lastIndexOf(marker);

        return cut === -1 ? null : main.slice(0, cut + marker.length);
    } catch {
        return null;
    }
}

/**
 * @param {string} target Directory to copy into, e.g. `deck/vendor`
 * @param {object} [options]
 * @param {string[]} [options.only] Package names to vendor; default: whatever is installed
 * @returns {{copied: Array<object>, missing: Array<object>}}
 */
export function vendorAssets(target, options = {}) {
    mkdirSync(target, { recursive: true });

    const wanted = options.only?.length
        ? VENDORABLE.filter((entry) => options.only.includes(entry.name))
        : VENDORABLE;

    const copied = [];
    const missing = [];

    for (const entry of wanted) {
        const base = locate(entry);

        if (!base) {
            missing.push(entry);
            continue;
        }

        for (const file of entry.copy) {
            const source = join(base, file.source);

            if (!existsSync(source)) {
                missing.push({ ...entry, detail: file.source });
                continue;
            }

            cpSync(source, join(target, file.target), { recursive: true });
            copied.push({ name: entry.name, target: file.target });
        }
    }

    return { copied, missing };
}
