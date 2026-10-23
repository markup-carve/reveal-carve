import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import * as carve from '@markup-carve/carve';
import { fileSystemResolver } from '@markup-carve/carve/node';

import { importMarkdownDeck } from '../src/import.js';
import { readSource } from '../src/build.js';
import { renderDeck } from '../src/slice.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'markdown-deck.md');
const render = (text) => carve.carveToHtml(text, { sections: false });

const temporaries = [];

after(() => {
    for (const dir of temporaries) {
        rmSync(dir, { recursive: true, force: true });
    }
});

function tempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'reveal-carve-import-'));
    temporaries.push(dir);

    return dir;
}

test('converts each slide and keeps the separators', () => {
    const { source, slides, warnings } = importMarkdownDeck(readFileSync(fixture, 'utf8'), { engine: carve });

    assert.equal(slides, 3);
    assert.match(source, /Some \*bold\* and \/emphasized\/ text\./);
    assert.match(source, /\n\n---\n\n%% attr: data-background="#ff0000"\n\n## Second/);
    assert.match(source, /```\n\n--\n\n## Down/);
    assert.match(source, /%% notes\n\nSay \/hello\/ first\./);
    assert.match(source, /\{data-line-numbers="1\\\|2"\}\n```js\nconst a = 1/);
    assert.match(source, /\n\n```\nplain\n```/);
    assert.doesNotMatch(source, /Note:/);
    assert.deepEqual(warnings, [
        'slide 3: a .element comment stays an HTML comment; move it to a Carve attribute such as {.fragment}',
    ]);
});

test('the converted deck renders the same slides, notes and attributes', () => {
    const { source } = importMarkdownDeck(readFileSync(fixture, 'utf8'), { engine: carve });
    const deck = renderDeck(source, render);

    assert.equal(deck.length, 2);
    assert.match(deck[0], /<hr>/, 'an in-slide rule became a slide separator');
    assert.match(deck[0], /<aside class="notes">\n<p>Say <em>hello<\/em> first\.<\/p>/);
    assert.match(deck[1], /<section data-background="#ff0000">\n<h2 id="Second">/);
    assert.match(deck[1], /<code data-line-numbers="1\|2" class="language-js">/);
    assert.equal((deck[1].match(/<section/g) || []).length, 3, 'the vertical stack was lost');
});

test('drops line steps it cannot place, and says so', () => {
    const markdown = '- item\n\n  ```js [2]\n  a\n  ```\n\n```js [1]\nb\n```\n';
    const { source, warnings } = importMarkdownDeck(markdown, { engine: carve });

    assert.match(source, /\{data-line-numbers="1"\}\n```js\nb/);
    assert.deepEqual(warnings, [
        'slide 1: line highlights on a code fence were dropped; add a {data-line-numbers} attribute line',
    ]);
});

test('a notes separator inside a code sample stays code', () => {
    const markdown = '# Code\n\n```text\nNote: literal\n```\n\nNote: spoken\n';
    const { source } = importMarkdownDeck(markdown, { engine: carve });

    assert.equal(source, '# Code\n\n```text\nNote: literal\n```\n\n%% notes\n\nspoken\n');
});

test('a --- line inside code stays code, and is reported as a separator', () => {
    const markdown = '# Rules\n\n***\n\n```yaml\n---\nkey: value\n```\n';
    const { source, warnings } = importMarkdownDeck(markdown, { engine: carve, separator: '^===$' });

    assert.equal(source, '# Rules\n\n***\n\n```yaml\n---\nkey: value\n```\n');
    assert.deepEqual(warnings, ['slide 1: a converted line reads as a slide separator; check the slide boundaries']);
});

test('honors custom separators and drops empty slides', () => {
    const markdown = '===\n# One\n\nNOTES: spoken\n===\n# Two\n';
    const { source, slides } = importMarkdownDeck(markdown, {
        engine: carve,
        separator: '^===$',
        verticalSeparator: null,
        notesSeparator: '^NOTES:',
    });

    assert.equal(slides, 2);
    assert.equal(source, '# One\n\n%% notes\n\nspoken\n\n---\n\n# Two\n');
});

test('the import verb writes a Carve deck and reports what it could not convert', () => {
    const dir = tempDir();
    const target = join(dir, 'deck.crv');
    const result = spawnSync(process.execPath, [join(here, '..', 'src', 'cli.js'), 'import', fixture, target], {
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /3 slides from/);
    assert.match(result.stderr, /slide 3: a \.element comment/);
    assert.equal(readFileSync(target, 'utf8'), importMarkdownDeck(readFileSync(fixture, 'utf8'), { engine: carve }).source);

    const check = spawnSync(process.execPath, [join(here, '..', 'src', 'cli.js'), 'check', target], { encoding: 'utf8' });

    assert.equal(check.status, 0, check.stdout);
});

test('a deck includes one named region of a partial', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'partial.crv'), 'Before.\n\n%% #region rules\n## House rules\n%% #endregion\n\nAfter.\n');
    writeFileSync(join(dir, 'deck.crv'), '# Deck\n\n---\n\n{{ partial.crv @region:rules }}\n');
    const warnings = [];
    const source = readSource(join(dir, 'deck.crv'), {
        engine: carve,
        resolver: fileSystemResolver,
        onWarning: (message) => warnings.push(message),
    });

    assert.match(source, /## House rules/);
    assert.doesNotMatch(source, /Before\.|After\./);
    assert.deepEqual(warnings, []);
});

test('a missing region is reported, not dropped silently', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'partial.crv'), 'No regions here.\n');
    writeFileSync(join(dir, 'deck.crv'), '{{ partial.crv @region:rules }}\n');
    const warnings = [];
    readSource(join(dir, 'deck.crv'), {
        engine: carve,
        resolver: fileSystemResolver,
        onWarning: (message) => warnings.push(message),
    });

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /deck\.crv: Include region "rules" is missing or invalid/);
});
