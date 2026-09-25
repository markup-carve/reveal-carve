/**
 * Golden files: the slide markup each demo deck renders to, stored and compared.
 *
 * The checks elsewhere test rules someone thought of. This one notices anything
 * that changes at all, including the changes nobody predicted - a stray class, a
 * lost attribute, an element that quietly became a div.
 *
 * Update with: UPDATE_GOLDEN=1 npm test
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as carve from '@markup-carve/carve';

import { buildSlides } from '../src/build.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const goldenDir = join(here, 'golden');

const EXTENSIONS = [
    carve.mermaid(),
    carve.chart(),
    carve.mathBlock(),
    carve.imgFence({ language: 'svg' }),
    carve.details(),
    carve.tabs({ mode: 'aria' }),
    carve.listTable(),
    carve.spoiler(),
    carve.colorSwatch(),
    carve.semanticSpan(),
    carve.codeCallouts(),
    carve.codeGroup(),
];

const render = (text) => carve.carveToHtml(text, { sections: false, extensions: EXTENSIONS });

const DECKS = [
    { name: 'deck', source: 'demo/deck.crv' },
    { name: 'showcase', source: 'demo/showcase.crv' },
    { name: 'language', source: 'demo/language.crv', options: { elements: { card: 'figure' } } },
];

mkdirSync(goldenDir, { recursive: true });

for (const deck of DECKS) {
    test(`${deck.name} renders the markup it is supposed to`, () => {
        const actual = `${buildSlides(join(root, deck.source), render, deck.options || {})}\n`;
        const golden = join(goldenDir, `${deck.name}.html`);

        if (process.env.UPDATE_GOLDEN || !existsSync(golden)) {
            writeFileSync(golden, actual, 'utf8');
            console.log(`  golden file written: test/golden/${deck.name}.html`);

            return;
        }

        const expected = readFileSync(golden, 'utf8');

        if (actual !== expected) {
            const actualLines = actual.split('\n');
            const firstDiff = expected.split('\n').findIndex((line, index) => line !== actualLines[index]);

            assert.fail(
                `${deck.name} rendered differently at line ${firstDiff + 1}.\n`
                + `  expected: ${expected.split('\n')[firstDiff]}\n`
                + `  actual:   ${actualLines[firstDiff]}\n`
                + 'If the change is intended: UPDATE_GOLDEN=1 npm test',
            );
        }
    });
}
