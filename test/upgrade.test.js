import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { upgrade } from '@markup-carve/carve/upgrade';

import { upgradeDeck } from '../src/upgrade.js';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'src', 'cli.js');
const temporaries = [];

after(() => {
    for (const dir of temporaries) {
        rmSync(dir, { recursive: true, force: true });
    }
});

function workspace(files) {
    const dir = mkdtempSync(join(tmpdir(), 'reveal-carve-upgrade-test-'));
    temporaries.push(dir);

    for (const [name, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, name)), { recursive: true });
        writeFileSync(join(dir, name), text);
    }

    return dir;
}

test('slide separators and frontmatter stay as written, each slide is upgraded', () => {
    const source = '---\ntitle: Deck\n---\n\nText\n# One\n\n---\n\nMore\n# Two\n\n--\n\nPlain\n';
    const result = upgradeDeck(source, { upgrade });

    assert.equal(result.output, '---\ntitle: Deck\n---\n\nText\n\n# One\n\n---\n\nMore\n\n# Two\n\n--\n\nPlain\n');
    assert.equal(result.check, 'pass');
    assert.deepEqual(result.records.map((record) => [record.entry, record.line]), [['U-001', 6], ['U-001', 11]]);
});

test('a deck 0.2 reads the same way is left alone', () => {
    const source = '# One\n\n---\n\n# Two\n';
    const result = upgradeDeck(source, { upgrade });

    assert.equal(result.output, source);
    assert.equal(result.changed, false);
});

test('a separator inside a fence is slide text, not a boundary', () => {
    const source = '```\na\n---\nb\n```\n\nText\n# One\n';

    assert.equal(upgradeDeck(source, { upgrade }).output, '```\na\n---\nb\n```\n\nText\n\n# One\n');
    assert.equal(upgradeDeck('```\n--\n```\n\nText\n# One\n', { upgrade }).output, '```\n--\n```\n\nText\n\n# One\n');
});

test('a record range counts UTF-16 offsets of the whole deck', () => {
    const source = 'Ü\n\n---\n\n[Label]\n:::: tabs\n::: tab\nx\n:::\n::::\n';
    const [record] = upgradeDeck(source, { upgrade }).records.filter((entry) => entry.range);

    assert.equal(source.slice(record.range.startOffset, record.range.endOffset).split('\n')[0], '::: tab');
});

test('a CRLF deck keeps its line ends', () => {
    assert.equal(upgradeDeck('Text\r\n# One\r\n\r\n---\r\n\r\nTwo\r\n', { upgrade }).output, 'Text\r\n\r\n# One\r\n\r\n---\r\n\r\nTwo\r\n');
});

test('the worst check of any slide is the check of the deck', () => {
    const result = upgradeDeck('= Fine\n\n---\n\nwhole\n', {
        upgrade: (text) => ({ output: text, changed: false, records: [], check: text.includes('whole') ? 'mismatch' : 'explained', engine01: '0.1' }),
    });

    assert.equal(result.check, 'mismatch');
});

test('upgrade reports without --write and writes the deck and its includes with it', () => {
    const dir = workspace({
        'decks/deck.crv': '# Deck\n\n{{ ../partials/part.crv }}\n\n---\n\nText\n# Two\n',
        'partials/part.crv': 'Intro\n# Partial\n',
    });
    const args = [cli, 'upgrade', join(dir, 'decks'), '--include-root', dir];
    const dry = spawnSync(process.execPath, args, { encoding: 'utf8' });

    assert.equal(dry.status, 1, dry.stderr);
    assert.match(dry.stdout, /deck\.crv: would be upgraded/);
    assert.match(dry.stdout, /part\.crv: would be upgraded/);
    assert.doesNotMatch(dry.stdout, /U-011/);
    assert.equal(readFileSync(join(dir, 'partials/part.crv'), 'utf8'), 'Intro\n# Partial\n');

    const written = spawnSync(process.execPath, [...args, '--write'], { encoding: 'utf8' });

    assert.equal(written.status, 0, written.stdout + written.stderr);
    assert.equal(readFileSync(join(dir, 'decks/deck.crv'), 'utf8'), '# Deck\n\n{{ ../partials/part.crv }}\n\n---\n\nText\n\n# Two\n');
    assert.equal(readFileSync(join(dir, 'partials/part.crv'), 'utf8'), 'Intro\n\n# Partial\n');
    assert.equal(spawnSync(process.execPath, args, { encoding: 'utf8' }).status, 0);
});

test('--write writes nothing when one file of the deck is blocked', () => {
    const dir = workspace({
        'decks/a.crv': 'Text\n# One\n',
        'decks/b.crv': '{.two-col}\n:::\n{.before}\n::::\n### A\n::::\n:::\n',
    });
    const run = spawnSync(process.execPath, [cli, 'upgrade', join(dir, 'decks'), '--write'], { encoding: 'utf8' });

    assert.equal(run.status, 1);
    assert.match(run.stdout, /b\.crv: not upgraded/);
    assert.match(run.stdout, /nothing written/);
    assert.equal(readFileSync(join(dir, 'decks/a.crv'), 'utf8'), 'Text\n# One\n');
});
