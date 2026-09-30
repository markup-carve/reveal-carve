import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as carve from '@markup-carve/carve';
import { fileSystemResolver } from '@markup-carve/carve/node';
import { readFrontmatter, mergeDeckOptions } from '../src/frontmatter.js';
import { readRenderers, splitFrontmatter } from '../src/frontmatter-split.js';
import { buildPage, readDeckSource, readSource } from '../src/build.js';
import { renderDeck, deckMinutes } from '../src/slice.js';
import { buildHandout } from '../src/handout.js';
import { lintSource } from '../src/lint.js';
import plugin from '../src/plugin.js';
import { setupDom, teardownDom, fakeDeck } from './helpers/dom.js';

const header = '---\ntitle: Workshop\nlang: de\nreveal:\n  theme: serif\n  darkTheme: black\n  renderers: []\n---\n';
const body = '\n# First\n\n%% minutes: 5\n\n---\n\n# Second\n';
const render = (text) => carve.carveToHtml(text, { sections: false });
const includes = { engine: carve, resolver: fileSystemResolver };
const temporary = (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'reveal-frontmatter-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));

    return dir;
};
afterEach(teardownDom);

test('frontmatter is removed before slides, agenda and handout are split', () => {
    const source = header + body;
    assert.equal(renderDeck(source, render).length, 2);
    assert.equal(deckMinutes(source).slides.length, 2);
    assert.equal(deckMinutes(source).total, 5);
    const markdown = buildHandout(source, carve.carveToMarkdown);
    assert.match(markdown, /First/);
    assert.doesNotMatch(markdown, /Workshop|renderers|lang:/);
    assert.deepEqual(lintSource(source), []);
});

test('YAML, JSON, CRLF and unrelated metadata are handled explicitly', () => {
    assert.equal(readFrontmatter(header.replaceAll('\n', '\r\n') + body).options.lang, 'de');
    assert.equal(readFrontmatter('--- \ntitle: Spaced\n---  \n# Deck').options.title, 'Spaced');
    assert.equal(readFrontmatter('---json\n{"title":"JSON"}\n---\n# Deck').options.title, 'JSON');
    assert.equal(readFrontmatter('---\nauthor: Someone\n---\n# Deck').source, '# Deck');
    // A deck may open with a separator: that block is slide content, not
    // metadata, and YAML would read a heading as a comment and fail the build.
    assert.equal(readFrontmatter('---\n\n# One\n\n---\n\n# Two').source, '---\n\n# One\n\n---\n\n# Two');
    assert.deepEqual(readFrontmatter('---json\n\n---\n# Deck').options, {});
    assert.equal(readFrontmatter('---\n# Only slide').source, '---\n# Only slide');
    assert.deepEqual(mergeDeckOptions({ title: 'metadata', renderers: ['mermaid'] }, { title: undefined, renderers: [] }), {
        title: 'metadata', renderers: [],
    });
});

test('invalid settings, YAML duplicates and unsupported formats are reported', () => {
    for (const text of ['title: 12', 'reveal: false', 'reveal:\n  theme: ../evil', 'reveal:\n  renderer: mermaid', 'reveal:\n  renderers: [unknown]', 'title: One\ntitle: Two']) {
        const source = `---\n${text}\n---\n# Deck`;
        assert.throws(() => readFrontmatter(source), /frontmatter/);
        assert.equal(lintSource(source)[0].code, 'frontmatter');
    }
    assert.throws(() => readFrontmatter('---toml\ntitle = "A"\n---\n# Deck'), /unsupported format/);
});

test('built pages use metadata, escape text, and preserve explicit API options', (t) => {
    const dir = temporary(t);
    const source = join(dir, 'deck.crv');
    const target = join(dir, 'deck.html');
    writeFileSync(source, header + body);
    assert.equal(buildPage({ source, target, render }), 2);
    let html = readFileSync(target, 'utf8');
    assert.match(html, /<title>Workshop<\/title>/);
    assert.match(html, /<html lang="de">/);
    assert.match(html, /theme\/serif.css/);
    assert.match(html, /theme\/black.css/);
    buildPage({ source, target, render, title: '<Overridden>', lang: 'en', theme: 'white', darkTheme: '' });
    html = readFileSync(target, 'utf8');
    assert.match(html, /<title>&lt;Overridden&gt;<\/title>/);
    assert.doesNotMatch(html, /theme\/serif.css|theme\/black.css/);
});

test('only the entry source owns deck configuration, not chapter directories or includes', (t) => {
    const dir = temporary(t);
    const entry = join(dir, 'entry.crv');
    const chapter = join(dir, 'chapter.crv');
    writeFileSync(chapter, '---\ntitle: Child\n---\n# Included');
    writeFileSync(entry, header + '\n{{ chapter.crv }}\n');
    const deck = readDeckSource(entry, includes);
    assert.equal(deck.options.title, 'Workshop');
    assert.match(deck.source, /Included/);
    assert.doesNotMatch(deck.source, /Child/);
    assert.throws(() => readSource(dir, includes), /single entry/);
});

test('CLI overrides metadata and can explicitly disable declared renderers', (t) => {
    const dir = temporary(t);
    const source = join(dir, 'deck.crv');
    const target = join(dir, 'deck.html');
    writeFileSync(source, header.replace('renderers: []', 'renderers: [mermaid]') + body);
    const result = spawnSync(process.execPath, ['src/cli.js', 'build', source, target, '--title', 'CLI', '--theme', 'white', '--no-renderers'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(target, 'utf8');
    assert.match(html, /<title>CLI<\/title>/);
    assert.match(html, /theme\/white.css/);
    assert.doesNotMatch(html, /mermaid.min.js/);
});

test('runtime strips metadata and leaves host title and theme alone', async () => {
    const { document } = setupDom(`<section data-carve><textarea data-template>${header + body}</textarea></section>`);
    document.title = 'Host title';
    document.documentElement.lang = 'en';
    await plugin().init(fakeDeck(document, { carve: { carve } }));
    assert.equal(document.querySelectorAll('.slides > section').length, 2);
    assert.equal(document.title, 'Host title');
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(document.querySelectorAll('link').length, 0);
});

test('runtime renderer declarations use preloaded libraries and host overrides', async () => {
    const text = '---\nreveal:\n  renderers: [katex]\n---\n# Math\n\n```math\nx + 1\n```';
    const { document, window } = setupDom(`<section data-carve><textarea data-template>${text}</textarea></section>`);
    document.fonts = { ready: Promise.resolve() };
    let rendered = 0;
    window.katex = { render(source, block) { rendered++; block.textContent = 'Rendered math'; } };
    await plugin().init(fakeDeck(document, { carve: { carve } }));
    assert.equal(rendered, 1);
    assert.match(document.querySelector('.math').textContent, /Rendered math/);
    const next = setupDom(`<section data-carve><textarea data-template>${text}</textarea></section>`);
    await plugin().init(fakeDeck(next.document, { carve: { carve, renderers: [] } }));
    assert.equal(next.document.querySelector('.math'), null);
});

test('watch rebuilds resolve metadata afresh while keeping CLI overrides', { timeout: 15000 }, async (t) => {
    const { spawn } = await import('node:child_process');
    const { createServer } = await import('node:net');
    const dir = temporary(t);
    const source = join(dir, 'deck.crv');
    const target = join(dir, 'deck.html');
    writeFileSync(source, header + body);
    const probe = createServer();
    await new Promise((done) => probe.listen(0, '127.0.0.1', done));
    const port = probe.address().port;
    await new Promise((done) => probe.close(done));
    const child = spawn(process.execPath, ['src/cli.js', 'watch', source, target, '--lang', 'fr', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    t.after(() => child.kill());
    const until = async (predicate) => {
        for (let i = 0; i < 120; i++) {
            if (predicate()) {return;}
            if (child.exitCode !== null) {assert.fail(output);}
            await new Promise((done) => setTimeout(done, 50));
        }
        assert.fail(`watch did not rebuild: ${output}`);
    };
    await until(() => output.includes('watching, Ctrl+C'));
    writeFileSync(source, header.replace('Workshop', 'Changed').replace('serif', 'moon') + body);
    await until(() => readFileSync(target, 'utf8').includes('<title>Changed</title>'));
    assert.match(readFileSync(target, 'utf8'), /<html lang="fr">/);
    assert.match(readFileSync(target, 'utf8'), /theme\/moon.css/);
    writeFileSync(source, body);
    await until(() => readFileSync(target, 'utf8').includes('<title>Presentation</title>'));
    const html = readFileSync(target, 'utf8');
    assert.match(html, /theme\/white.css/);
    assert.doesNotMatch(html, /theme\/moon.css|theme\/black.css/);
    assert.match(html, /<html lang="fr">/);
});


test('directory lint and check accept files with deck settings', (t) => {
    const dir = temporary(t);
    writeFileSync(join(dir, 'deck.crv'), carve.carveToCarve(header + '\n# Deck\n'));
    for (const verb of ['lint', 'check']) {
        const result = spawnSync(process.execPath, [join(process.cwd(), 'src/cli.js'), verb], {
            cwd: dir, encoding: 'utf8',
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
    }
});

test('a deck that opens with a separator still builds', () => {
    // Every shape here was valid before frontmatter existed, and stays valid.
    const content = [
        '---\n# Title\n---\n\n# Second\n',
        '---\nSome prose.\n---\n\n# Second\n',
        '---\n- a bullet\n- another\n---\n\n# Second\n',
    ];

    for (const source of content) {
        assert.equal(readFrontmatter(source).source, source, source.slice(0, 16));
        assert.deepEqual(readFrontmatter(source).options, {});
        assert.deepEqual(lintSource(source).filter((finding) => finding.code === 'frontmatter'), []);
    }
});

test('a block tagged as yaml is metadata, and says so when it is wrong', () => {
    // `--- yaml` is a promise: the deck meant metadata, so a bad block is an
    // error rather than a slide.
    assert.throws(() => readFrontmatter('--- yaml\n# only a comment\n---\n# Deck'), /frontmatter/);
    assert.equal(readFrontmatter('--- yaml\ntitle: Tagged\n---\n# Deck').options.title, 'Tagged');
});

test('the runtime reads the renderer list without a YAML parser', () => {
    const cases = [
        ['---\nreveal:\n  renderers:\n    - mermaid\n    - katex\n---\n# Deck', ['mermaid', 'katex']],
        ['---\nreveal:\n  renderers: [mermaid]\n---\n# Deck', ['mermaid']],
        ['---json\n{"reveal":{"renderers":["katex"]}}\n---\n# Deck', ['katex']],
        ['---\ntitle: No renderers\n---\n# Deck', []],
        ['# No frontmatter at all\n', []],
        ['---\n# Title\n---\n# Deck', []],
    ];

    for (const [source, expected] of cases) {
        assert.deepEqual(readRenderers(source), expected, source.slice(0, 24));
    }
});

test('what the parser reads and what the runtime reads agree', () => {
    const source = '---\ntitle: Both\nreveal:\n  renderers:\n    - mermaid\n---\n\n# Deck\n';

    assert.deepEqual(readFrontmatter(source).options.renderers, readRenderers(source));
    assert.equal(readFrontmatter(source).source, splitFrontmatter(source).source);
});
