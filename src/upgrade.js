/**
 * The Carve 0.1 to 0.2 upgrade of a deck source.
 *
 * The engine's upgrade reads a whole document, where a slide separator is a
 * thematic break it respells as `***`. So the deck is cut at its separators
 * first, each slide is upgraded on its own, and the separators, the blank lines
 * around them and the frontmatter go back exactly as written.
 */

import { splitFrontmatter } from './frontmatter-split.js';
import { DEFAULTS, slideSeparators } from './slice.js';

const CHECK_ORDER = ['pass', 'explained', 'mismatch'];
const REGISTERED = ['wikilinks', 'samp'];

/**
 * @param {string} source Carve 0.1 deck source
 * @param {object} options
 * @param {Function} options.upgrade `upgrade` from `@markup-carve/carve/upgrade`
 * @param {string} [options.separator] horizontal separator pattern
 * @param {string|null} [options.verticalSeparator] vertical separator pattern, `null` for none
 * @param {Array<string|{name: string}>} [options.extensions] the deck's extensions; `wikilinks` and `samp`
 *   have 0.1 source forms the engine respells only when they are registered
 * @returns {{ output: string, changed: boolean, check: 'pass'|'explained'|'mismatch',
 *   records: Array<object>, engine01: string }}
 */
export function upgradeDeck(source, { upgrade, separator, verticalSeparator, extensions = [] } = {}) {
    const horizontal = separator || DEFAULTS.separator;
    const vertical = verticalSeparator === undefined ? DEFAULTS.verticalSeparator : verticalSeparator;
    const registeredExtensions = extensions
        .map((extension) => (typeof extension === 'string' ? extension : extension?.name))
        .filter((name) => REGISTERED.includes(name));
    const { source: body } = splitFrontmatter(source);
    const bodyStart = source.length - body.length;
    const records = [];
    let check = 'pass';
    let engine01 = '';
    let output = source.slice(0, bodyStart);
    let at = 0;

    const pieces = [];
    for (const [start, end] of slideSeparators(body, horizontal)) {
        pieces.push(...verticalPieces(body, at, start, vertical), [start, end, true]);
        at = end;
    }
    pieces.push(...verticalPieces(body, at, body.length, vertical));

    for (const [start, end, keep] of pieces) {
        const text = body.slice(start, end);
        const core = /^((?:[ \t]*\r?\n)*)([\s\S]*?)((?:\r?\n[ \t]*)*)$/.exec(text);

        if (keep || !core[2].trim()) {
            output += text;
            continue;
        }

        const result = upgrade(`${core[2]}${core[2].includes('\r\n') ? '\r\n' : '\n'}`, { registeredExtensions });
        const coreStart = bodyStart + start + core[1].length;
        const lineShift = source.slice(0, coreStart).split('\n').length - 1;

        // The record's `range` is dropped: it counts code points of the 0.1 tree within one slide.
        for (const record of result.records) {
            const shifted = { ...record, ...(typeof record.line === 'number' ? { line: record.line + lineShift } : {}) };
            delete shifted.range;
            records.push(shifted);
        }

        if (CHECK_ORDER.indexOf(result.check) > CHECK_ORDER.indexOf(check)) {
            check = result.check;
        }

        engine01 = engine01 || result.engine01;
        output += core[1] + result.output.replace(/(?:\r?\n)+$/, '') + core[3];
    }

    return { output, changed: output !== source, check, records, engine01 };
}

/** `[start, end, isSeparator]` pieces of one horizontal slide, cut at its vertical separators. */
function verticalPieces(body, from, to, vertical) {
    if (!vertical) {
        return [[from, to, false]];
    }

    const pieces = [];
    let at = from;
    for (const [start, end] of slideSeparators(body.slice(from, to), vertical)) {
        pieces.push([at, from + start, false], [from + start, from + end, true]);
        at = from + end;
    }
    pieces.push([at, to, false]);

    return pieces;
}
