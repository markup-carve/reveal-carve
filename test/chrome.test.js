import assert from 'node:assert/strict';
import { test } from 'node:test';

// CANDIDATES is built at import time, so the override has to be in place first.
process.env.CHROME_PATH = process.execPath;

const { findChrome } = await import('../src/chrome.js');

test('findChrome honors CHROME_PATH ahead of the search', async () => {
    assert.equal(await findChrome(), process.execPath);
});

test('findChrome rejects rather than returning nothing', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/chrome.js', import.meta.url), 'utf8'));

    assert.match(source, /throw new Error\(`reveal-carve: no Chrome or Chromium found\./);
    assert.doesNotMatch(source, /return null|process\.exit\(0\)/);
});
