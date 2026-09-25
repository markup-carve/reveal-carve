#!/usr/bin/env node
/**
 * PDF regression: page count and text per deck, compared against a stored file.
 *
 * The published handout once opened with a nearly empty page, because an agenda
 * overran its slide and reveal moved the list to the next one. Nothing in the
 * suite could see that - the HTML was fine. Page counts can.
 *
 *   node scripts/check-pdf.mjs [siteDir]      compare
 *   UPDATE_PDF=1 node scripts/check-pdf.mjs   store the current numbers
 */

import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const site = resolve(process.argv[2] || 'site');
const expectedFile = resolve('test/golden/pdf.json');

const PDFS = ['features.pdf', 'everything.pdf'];

async function measure(file) {
    const { stdout: info } = await run('pdfinfo', [file]);
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
    const { stdout: text } = await run('pdftotext', [file, '-']);
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

    return {
        pages,
        // A page that carries nothing but its heading is the shape of the defect
        // this guards against, so the headline count travels with the page count.
        lines: lines.length,
        first: lines[0] || '',
        last: lines[lines.length - 1] || '',
    };
}

const actual = {};

for (const name of PDFS) {
    const file = join(site, name);

    if (!existsSync(file)) {
        console.error(`check-pdf: ${file} is missing. Run the site build first.`);
        process.exit(1);
    }

    actual[name] = await measure(file);
}

if (process.env.UPDATE_PDF || !existsSync(expectedFile)) {
    writeFileSync(expectedFile, `${JSON.stringify(actual, null, 4)}\n`, 'utf8');
    console.log(`check-pdf: stored ${Object.keys(actual).length} measurements`);
    process.exit(0);
}

const expected = JSON.parse(readFileSync(expectedFile, 'utf8'));
let failed = false;

for (const [name, measurement] of Object.entries(actual)) {
    const before = expected[name];

    if (!before) {
        console.log(`${name}: new, ${measurement.pages} pages`);
        continue;
    }

    // Text shifts with every wording change, so only the structure is compared:
    // an unexpected page, or a page count that moved without the content moving.
    const drift = Math.abs(measurement.pages - before.pages);
    const lineDrift = Math.abs(measurement.lines - before.lines);

    if (drift > 0 && lineDrift < 3) {
        failed = true;
        console.log(
            `${name}: ${before.pages} pages before, ${measurement.pages} now, `
            + `with the same content (${before.lines} lines vs ${measurement.lines}). `
            + 'Something changed the layout rather than the text.',
        );
        continue;
    }

    console.log(`${name}: ${measurement.pages} pages, ${measurement.lines} lines of text`);
}

if (failed) {
    console.log('\nIf the new layout is what you want: UPDATE_PDF=1 node scripts/check-pdf.mjs');
}

process.exit(failed ? 1 : 0);
