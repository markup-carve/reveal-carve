/**
 * Include resolution for deck sources.
 *
 * `{{ path }}` is Carve syntax, but carve-js does not resolve it while rendering -
 * the directive comes out as literal text. Resolving it here is what turns a deck
 * into a slide library: a shared title slide, a reused disclaimer, one chapter
 * pulled into two decks.
 *
 * Reading files named by a document is a trust boundary, so this stays inside a
 * root directory and refuses cycles.
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const INCLUDE = /^[ \t]*\{\{\s*([^}\n]+?)\s*\}\}[ \t]*$/gm;

export class IncludeError extends Error {}

function inside(root, candidate) {
    const step = relative(root, candidate);

    return step === '' || (!step.startsWith('..') && !step.startsWith('/'));
}

/**
 * Replace every `{{ path }}` line with the file it names, recursively.
 *
 * @param {string} source Carve source text
 * @param {object} options
 * @param {string} options.from Path of the file the source came from
 * @param {string} [options.root] Directory includes may not escape, defaults to `from`'s directory
 * @param {number} [options.maxDepth] Nesting limit, default 10
 */
export function resolveIncludes(source, { from, root, maxDepth = 10, read = readFileSync } = {}) {
    const base = resolve(root || dirname(from));

    const expand = (text, currentFile, chain) => {
        if (chain.length > maxDepth) {
            throw new IncludeError(`include nesting deeper than ${maxDepth}: ${chain.join(' -> ')}`);
        }

        return text.replace(INCLUDE, (match, target) => {
            const path = resolve(dirname(currentFile), target);

            if (!inside(base, path)) {
                throw new IncludeError(`include outside the root directory: ${target}`);
            }

            if (chain.includes(path)) {
                throw new IncludeError(`include cycle: ${[...chain, path].join(' -> ')}`);
            }

            let content;

            try {
                content = read(path, 'utf8');
            } catch {
                throw new IncludeError(`include not found: ${target} (from ${currentFile})`);
            }

            return expand(String(content).trim(), path, [...chain, path]);
        });
    };

    return expand(source, resolve(from), [resolve(from)]);
}

export function hasIncludes(source) {
    INCLUDE.lastIndex = 0;

    return INCLUDE.test(source);
}
