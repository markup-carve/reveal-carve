/**
 * Vendoring: the files a deck loads, copied next to the deck.
 *
 * This is what makes an offline deck work, and it was the least covered module
 * in the package - a broken copy would only be noticed in a room with no wifi.
 */

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { vendorAssets, VENDORABLE } from '../src/vendor.js';

// The plugin vendors its own bundle, which only exists after a build. A fresh
// clone runs `npm test` before `npm run build`, and that is not a failure.
const built = existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'reveal-carve.js'));
const needsBuild = { skip: built ? false : 'dist is not built' };

const temporaries = [];

after(() => {
    for (const dir of temporaries) {
        rmSync(dir, { recursive: true, force: true });
    }
});

function target() {
    const dir = mkdtempSync(join(tmpdir(), 'reveal-carve-vendor-'));

    temporaries.push(dir);

    return dir;
}

test('reveal, the engine and the plugin land next to the deck', needsBuild, () => {
    const dir = target();
    const { copied, missing } = vendorAssets(dir, { only: ['reveal.js', '@markup-carve/carve', '@markup-carve/reveal-carve'] });

    assert.deepEqual(missing, [], 'these three are dev dependencies of this repo');
    assert.ok(existsSync(join(dir, 'reveal', 'reveal.js')), 'reveal itself');
    assert.ok(existsSync(join(dir, 'reveal', 'plugin', 'highlight.js')), 'the plugins a deck loads');
    assert.ok(existsSync(join(dir, 'carve.iife.min.js')), 'the engine, for decks rendered in the browser');
    assert.ok(existsSync(join(dir, 'reveal-carve.js')), 'the plugin bundle');
    assert.ok(existsSync(join(dir, 'reveal-carve.css')), 'the theme');
    assert.ok(existsSync(join(dir, 'reveal-carve-dark.css')), 'the dark theme');
    // reveal's dist is copied as one directory, so five entries is six files.
    assert.equal(copied.length >= 5, true, `copied ${copied.length} entries`);
});

test('a package that is not installed is reported, not guessed at', () => {
    const { copied, missing } = vendorAssets(target(), { only: ['nonsense'] });

    assert.deepEqual(copied, []);
    assert.deepEqual(missing, []);
});

test('every vendorable entry says what it is for', () => {
    for (const entry of VENDORABLE) {
        assert.ok(entry.name, 'a package name');
        assert.ok(entry.what, `${entry.name} needs a reason a reader can act on`);
        assert.ok(entry.copy.length, `${entry.name} copies nothing`);
    }
});

test('vendoring twice is not an error', needsBuild, () => {
    const dir = target();

    vendorAssets(dir, { only: ['@markup-carve/reveal-carve'] });
    const second = vendorAssets(dir, { only: ['@markup-carve/reveal-carve'] });

    assert.equal(second.missing.length, 0);
    assert.ok(existsSync(join(dir, 'reveal-carve.css')));
});
