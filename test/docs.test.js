/**
 * The docs written in Carve, and the Markdown published beside them.
 *
 * GitHub renders a `.crv` file as plain text, so the README links the generated
 * page - which means the generated page has to be current. This is the check
 * that says so before a reader finds out.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

import * as carve from '@markup-carve/carve';

import { carveDocs, renderDoc } from '../scripts/build-docs.mjs';
import { findMarkdownWriter } from '../src/markdown.js';

// The docs are rendered with the Carve 0.2 Markdown writer, which the pinned engine does not have yet.
const needsMarkdown = { skip: !(await findMarkdownWriter(carve)) && 'needs the Carve 0.2 Markdown writer (markup-carve/carve-js#5076)' };

test('every Carve doc has a rendered Markdown page beside it', needsMarkdown, async () => {
    const names = carveDocs();

    assert.ok(names.length, 'no .crv docs found');

    for (const name of names) {
        const { path, markdown } = await renderDoc(name);

        assert.ok(existsSync(path), `${path} is missing. Run: npm run docs`);
        assert.equal(readFileSync(path, 'utf8'), markdown, `${path} is out of date. Run: npm run docs`);
    }
});

test('the rendered page says where it came from', needsMarkdown, async () => {
    for (const name of carveDocs()) {
        assert.match((await renderDoc(name)).markdown, /^<!-- Generated from docs\/.*\.crv/);
    }
});
