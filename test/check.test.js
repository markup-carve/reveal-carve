import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { maskSeparators, separatorLines } from '../src/lint.js';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'src', 'cli.js');
const temporaries = [];

after(() => {
    for (const dir of temporaries) {
        rmSync(dir, { recursive: true, force: true });
    }
});

function check(source) {
    const dir = mkdtempSync(join(tmpdir(), 'reveal-carve-check-test-'));
    temporaries.push(dir);
    const file = join(dir, 'deck.crv');
    writeFileSync(file, source);

    return { file, result: spawnSync(process.execPath, [cli, 'check', file], { encoding: 'utf8' }) };
}

test('separator lines are found outside the frontmatter only', () => {
    const source = '---\ntitle: Deck\n---\n# One\n\n---\n\n# Two\n\n--\n\n# Three\n';

    assert.deepEqual([...separatorLines(source)], [6]);
    assert.deepEqual([...separatorLines('# One\n\n---\n\n# Two\n')], [3]);
    assert.deepEqual([...separatorLines('# One\n\n===\n\n# Two\n', { separator: '\\n===\\n' })], [3]);
});

test('masking writes a separator as *** and keeps a CRLF line end', () => {
    assert.equal(maskSeparators('# One\r\n\r\n---\r\n\r\n# Two\r\n', new Set([3])), '# One\r\n\r\n***\r\n\r\n# Two\r\n');
});

test('check accepts the --- slide separator', () => {
    const { result } = check('---yaml\ntitle: Deck\n---\n\n# One\n\n---\n\n# Two\n\n--\n\n# Three\n');

    assert.equal(result.status, 0, result.stdout);
    assert.doesNotMatch(result.stdout, /thematic-break-spelling|\*\*\*/);
});

test('check still reports a slide that carve fmt would change, under the deck path', () => {
    const { file, result } = check('# One\ntext\n\n---\n\n# Two\n');

    assert.equal(result.status, 1, result.stdout);
    assert.ok(result.stdout.includes(`${file}:`), result.stdout);
    assert.doesNotMatch(result.stdout, /reveal-carve-check-[^t]/);
});
