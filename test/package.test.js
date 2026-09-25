/**
 * What the package actually ships.
 *
 * The dark theme imports the light one and both files are renamed on the way
 * into dist, so the import can point at a name that is not there any more. A
 * deck built with the dark theme then loads twelve rules and no layout at all,
 * which no source-level test can see.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

test('every import in the shipped stylesheets resolves inside dist', { skip: !existsSync(dist) && 'dist is not built' }, () => {
    for (const name of ['reveal-carve.css', 'reveal-carve-dark.css']) {
        const file = join(dist, name);

        assert.ok(existsSync(file), `dist/${name} is missing`);

        for (const match of readFileSync(file, 'utf8').matchAll(/@import\s+"([^"]+)"/g)) {
            assert.ok(
                existsSync(join(dist, match[1])),
                `dist/${name} imports ${match[1]}, which is not in dist`,
            );
        }
    }
});

test('the package lists the files a deck loads', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

    for (const entry of ['./theme.css', './theme-dark.css']) {
        assert.ok(manifest.exports[entry], `package.json does not export ${entry}`);
        assert.ok(
            existsSync(join(root, manifest.exports[entry])),
            `${entry} points at ${manifest.exports[entry]}, which is not there`,
        );
    }
});
