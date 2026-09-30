/**
 * The command line, parsed.
 *
 * Every flag here is a promise to somebody's build script, and the parser used
 * to be reachable only by spawning the CLI - so it was the least covered file
 * in the package. These are the shapes that matter: repeats, values, negations
 * and the errors a typo should produce.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';

import { absoluteAsset, locateCarveCli, parseArgs, usage, VERBS } from '../src/args.js';

test('positional arguments keep their order', () => {
    const { positional } = parseArgs(['slides/deck.crv', 'deck.html']);

    assert.deepEqual(positional, ['slides/deck.crv', 'deck.html']);
});

test('repeatable flags collect rather than overwrite', () => {
    const { options } = parseArgs([
        '--css', 'a.css', '--css', 'b.css',
        '--js', 'one.js', '--js', 'two.js',
        '--extension', 'mermaid', '--extension', 'listTable',
        '--no-extension', 'spoiler',
    ]);

    assert.deepEqual(options.stylesheets, ['a.css', 'b.css']);
    assert.deepEqual(options.scripts, ['one.js', 'two.js']);
    assert.deepEqual(options.extensions, ['mermaid', 'listTable']);
    assert.deepEqual(options.withoutExtensions, ['spoiler']);
});

test('value flags take the argument after them', () => {
    const { options } = parseArgs([
        '--title', 'My deck',
        '--theme', 'serif',
        '--lang', 'de',
        '--port', '8123',
        '--split-at-heading', '2',
        '--budget', '90',
    ]);

    assert.equal(options.title, 'My deck');
    assert.equal(options.theme, 'serif');
    assert.equal(options.lang, 'de');
    assert.equal(options.port, 8123);
    assert.equal(options.splitAtHeading, 2);
    assert.equal(options.budget, 90);
});

test('the negations read as negations', () => {
    const { options } = parseArgs(['--no-includes', '--no-notes', '--no-reveal-spoilers', '--core-only', '--static']);

    assert.equal(options.includes, false);
    assert.equal(options.notes, false);
    assert.equal(options.revealSpoilers, false);
    assert.equal(options.coreOnly, true);
    assert.equal(options.carveOptions.mode, 'static');
});

test('an element mapping becomes a class-to-element pair', () => {
    const { options } = parseArgs(['--element', 'card=figure', '--element', 'note=aside']);

    assert.deepEqual(options.elements, { card: 'figure', note: 'aside' });
});

test('smart quotes carry their locale', () => {
    const { options } = parseArgs(['--smart-quotes', 'de']);

    assert.deepEqual(options.extensions, [{ name: 'smartQuotes', options: { locale: 'de' } }]);
});

test('a bad renderer name is refused at the flag, not at render time', () => {
    assert.throws(() => parseArgs(['--with', 'mermaid,nonsense']), /Unknown renderer/);
    assert.throws(() => parseArgs(['--with']), /--with requires a value/);
    assert.deepEqual(parseArgs(['--with', 'mermaid,katex']).options.renderers, ['mermaid', 'katex']);
});

test('an unknown flag is an error, not a file name', () => {
    assert.throws(() => parseArgs(['--nonsense']), /unknown option/i);
});

test('a local asset path is made absolute, a URL is left alone', () => {
    assert.equal(absoluteAsset('https://example.com/x.js'), 'https://example.com/x.js');
    assert.equal(absoluteAsset('//example.com/x.js'), '//example.com/x.js');
    assert.match(absoluteAsset('vendor/x.js'), /^\/.*vendor\/x\.js$/);
});

test('every verb the usage text advertises exists', () => {
    const lines = [];
    const log = console.log;

    console.log = (text) => lines.push(text);

    try {
        usage();
    } finally {
        console.log = log;
    }

    const text = lines.join('\n');

    for (const verb of VERBS) {
        assert.ok(text.includes(`reveal-carve ${verb}`) || text.includes(`[${verb}]`), verb);
    }
});

test('Carve\'s own CLI is found where it is installed', () => {
    // `check` runs carve lint and carve fmt through this path. When it returns
    // null those two are skipped silently, and a broken source reports clean -
    // which is what a missing import did here once.
    const found = locateCarveCli();

    assert.ok(found, 'the engine is a dev dependency of this repo, so it must be found');
    assert.match(found, /@markup-carve[/\\]carve[/\\].*cli\.js$/);
    assert.ok(existsSync(found), `${found} does not exist`);
});
