import assert from 'node:assert/strict';
import { test } from 'node:test';

// CANDIDATES is built at import time, so the override has to be in place first.
process.env.CHROME_PATH = process.execPath;

const { findChrome, sandboxFlags } = await import('../src/chrome.js');

test('findChrome honors CHROME_PATH ahead of the search', async () => {
    assert.equal(await findChrome(), process.execPath);
});

test('findChrome rejects rather than returning nothing', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/chrome.js', import.meta.url), 'utf8'));

    assert.match(source, /throw new Error\(`reveal-carve: no Chrome or Chromium found\./);
    assert.doesNotMatch(source, /return null|process\.exit\(0\)/);
});

test('the sandbox stays on unless asked to drop it', () => {
    const was = process.env.CHROME_NO_SANDBOX;

    try {
        delete process.env.CHROME_NO_SANDBOX;
        assert.deepEqual(sandboxFlags(), []);

        process.env.CHROME_NO_SANDBOX = '0';
        assert.deepEqual(sandboxFlags(), []);

        process.env.CHROME_NO_SANDBOX = '1';
        assert.deepEqual(sandboxFlags(), ['--no-sandbox']);
    } finally {
        was === undefined ? delete process.env.CHROME_NO_SANDBOX : (process.env.CHROME_NO_SANDBOX = was);
    }
});
