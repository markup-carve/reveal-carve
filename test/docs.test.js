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

import { carveDocs, renderDoc } from '../scripts/build-docs.mjs';

test('every Carve doc has a rendered Markdown page beside it', () => {
    const names = carveDocs();

    assert.ok(names.length, 'no .crv docs found');

    for (const name of names) {
        const { path, markdown } = renderDoc(name);

        assert.ok(existsSync(path), `${path} is missing. Run: npm run docs`);
        assert.equal(readFileSync(path, 'utf8'), markdown, `${path} is out of date. Run: npm run docs`);
    }
});

test('the rendered page says where it came from', () => {
    for (const name of carveDocs()) {
        assert.match(renderDoc(name).markdown, /^<!-- Generated from docs\/.*\.crv/);
    }
});
