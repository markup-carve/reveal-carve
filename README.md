# reveal-carve

Write [reveal.js](https://revealjs.com) presentations in [Carve](https://markup-carve.github.io/carve/).

**[See the demo deck](https://markup-carve.github.io/reveal-carve/)** - the same source rendered in the browser, pre-rendered by the build step, and exported as a handout.

Two entry points over one implementation:

- **Runtime plugin** - the browser renders `.crv` files as the deck loads. No build step.
- **Build step** - Node renders the deck to a static page, with chapter directories, includes, linting and a handout export.

## What it does that plain reveal.js does not

- **An agenda that writes itself.** `%% toc` on a slide lists the other slides,
  with per-slide minutes added up and long lists split evenly over two slides.
- **Chapters as directories.** A deck is one file or a folder of numbered files;
  includes pull shared slides in and the watcher follows them.
- **A print mode that unfolds.** Tabs, code groups, details and spoilers are
  interactive on screen and opened flat in the handout and the PDF, so nothing
  hides behind a click on paper.
- **PDF from the command line.** `reveal-carve pdf deck.crv` drives headless
  Chrome over the DevTools protocol - no browser dialog, and repeatable.
- **Diffs, callouts and stepwise highlighting** survive the syntax highlighter:
  `{.diff}` colours the lines, `{.callout}` numbers them, `{data-line-numbers}`
  steps through them.
- **A speaker timer** from the same `%% minutes:` the agenda counts, in the
  speaker view only.
- **A handout export.** `reveal-carve handout` turns the deck into one Markdown
  document, speaker notes included.
- **Errors you can see.** A broken slide renders as a slide carrying the
  engine's message rather than vanishing, and `reveal-carve lint` catches it
  first.

## Why Carve for slides

| | In HTML | In Carve |
|---|---|---|
| A PHP chain in a code block | `$this-&gt;find()` eleven times over | `$this->find()`, as written |
| Two-column before/after | nested `<div>` in the source | `{.two-col}` and two containers |
| Stepwise code highlighting | hand-written `<code data-line-numbers>` | `{data-line-numbers=1\|2-3}` above the fence |
| Checking the source | open it in a browser and look | `carve lint`, `carve fmt --check`, `reveal-carve lint` |

## Install

```bash
npm install @markup-carve/reveal-carve @markup-carve/carve reveal.js
npx reveal-carve init talk      # a starter deck: chapters, a partial, the commands
```

[Getting started](docs/getting-started.md) walks from here to a published deck;
[the reference](docs/reference.md) lists every directive, flag and option.

## Training starter

```bash
npx reveal-carve init workshop --preset training
cd workshop
npm install
npm start
```

Open <http://localhost:8800>. The starter includes a timed workshop, code
comparisons, an exercise and solution, Mermaid diagrams and KaTeX formulas.
It uses local assets and offers light and dark styles. `npm run pdf` exports
the slides; `npm run handout` writes a Markdown document with speaker notes.
PDF export needs Chrome or Chromium and Node 22 or later.

For an existing deck, install `mermaid` and `katex`, then pass
`--with mermaid,katex` to `build`, `watch` or source-based `pdf`. The command
copies renderer assets beside the output and waits for rendering before print
layout. See [the training guide](docs/training.md) for layouts and commands.

## Deck frontmatter

A single entry `.crv` file can carry its title, language and rendering settings:

```yaml
---
title: Planning a workshop
lang: en
reveal:
  theme: white
  darkTheme: black
  renderers: [mermaid, katex]
---
```

Put slide content after the closing fence. Explicit CLI options override these
settings; `--no-renderers` clears the renderer list. Build, watch and source PDF
read metadata before splitting slides. Watch re-reads it on every rebuild.
For chapters, use an entry file with includes. See [frontmatter](docs/frontmatter.md)
for formats, validation and browser-plugin behavior.

## Runtime plugin

```html
<section data-carve="slides/deck.crv"></section>

<script src="node_modules/@markup-carve/carve/dist/carve.iife.min.js"></script>
<script src="node_modules/reveal.js/dist/reveal.js"></script>
<script src="node_modules/@markup-carve/reveal-carve/dist/reveal-carve.js"></script>
<script>
Reveal.initialize({ plugins: [RevealCarve, RevealHighlight, RevealNotes] });
</script>
```

As an ES module:

```js
import RevealCarve from '@markup-carve/reveal-carve';

Reveal.initialize({ plugins: [RevealCarve()] });
```

Inline sources work too:

```html
<section data-carve>
    <textarea data-template>
        # Title

        ---

        ## Second slide
    </textarea>
</section>
```

The engine comes from the global `carve` object. Override it with
`Reveal.initialize({ carve: { carve: myEngine } })`, or pass a plain function with
`{ carve: { render: (text) => html } }`.

## Command line

```bash
reveal-carve build slides/deck.crv deck.html --title "My deck"
reveal-carve build slides/chapters/ deck.html          # one file per chapter
reveal-carve watch slides/ deck.html --port 8800       # rebuild and reload on save
reveal-carve lint slides/                              # deck problems, before the room sees them
reveal-carve handout slides/ handout.md                # slides plus what you said about them
reveal-carve agenda slides/ --budget 120               # planned minutes per slide, and the total
reveal-carve check slides/                             # carve lint, carve fmt and the deck rules
reveal-carve vendor deck/vendor                        # copy reveal, Carve and the renderers in
reveal-carve pdf slides/ deck.pdf                      # print copy, built and printed
```

| Flag | Meaning |
|---|---|
| `--title`, `--theme`, `--lang` | page title, reveal theme (default `white`), `<html lang>` |
| `--reveal-base` | path to reveal's `dist`, default `node_modules/reveal.js/dist` |
| `--css`, `--js` | extra stylesheets and scripts, repeatable |
| `--split-at-heading N` | start a new slide at every level-N heading instead of `---` |
| `--animate-lists` | every list reveals one item at a time |
| `--include-root DIR` | directory includes may not escape, default: the source's own |
| `--no-includes` | leave `{{ path }}` as literal text |
| `--slides-only` | write the `<section>` markup without a page around it |
| `--strict` | fail the build instead of rendering an error slide |
| `--footer "<html>"`, `--footer-file` | a footer under the deck, e.g. links back to an overview |
| `--extension NAME[:VALUE]` | enable a Carve extension, repeatable |
| `--no-extension NAME` | turn one of the defaults off, repeatable |
| `--core-only` | no extensions at all, core Carve syntax only |
| `--smart-quotes LOCALE` | locale-aware quotation marks, e.g. `de` |
| `--budget N` | `agenda` fails when the planned minutes exceed N |
| `--no-notes` | handout without the speaker notes |
| `--no-reveal-spoilers` | print without the repeated slide that opens spoilers |

In JavaScript:

```js
import { buildPage } from '@markup-carve/reveal-carve/build';
import { carveToHtml } from '@markup-carve/carve';

buildPage({
    source: 'slides/chapters',
    target: 'deck.html',
    render: (text) => carveToHtml(text),
    title: 'My deck',
});
```

## Writing slides

| Syntax | Meaning |
|---|---|
| `---` on its own line | next slide |
| `--` on its own line | next slide in a vertical stack |
| `%% class: center big` | CSS classes for this slide |
| `%% attr: data-background="#fff"` | raw attributes for this slide's `<section>` |
| `%% notes` | everything after it is a speaker note |
| `%% fragments` | every list on this slide reveals one item at a time |
| `{.fragments}` on a list | that one list reveals item by item |
| `{.fragment}` on anything | reveal's own behavior, one step for the whole element |
| `%% animate` | auto-animate this slide against the next |
| `%% minutes: 5` | planned length, summed by `reveal-carve agenda` |
| `%% toc` | fill this slide with an agenda of the other slides' headings |

All directives are ordinary Carve comments, so the document still renders correctly
through any other Carve tool. A mistyped one is therefore silent - which is what
`reveal-carve lint` is for.

Code blocks, chapters, containers, footnotes, timing and themes have their own
page: [authoring slides](docs/authoring.md).

## When a slide fails to render

A broken source produces a visible error slide carrying the engine's message, not a
silently shorter deck. Pass `--strict` (or `throwOnError`) to fail the build instead.

## Differences from the Markdown plugin

- Vertical splitting is **on by default** (`--`); reveal's Markdown plugin needs `data-separator-vertical`.
- Slide attributes come from `%%` directives rather than `<!-- .slide: -->` comments, because Carve has real comment syntax.
- The Carve engine is a peer dependency rather than bundled, so a page loads one engine no matter how many plugins use it.

## Documentation

- [Getting started](docs/getting-started.md) - from an empty directory to a
  published deck.
- [Authoring slides](docs/authoring.md) - code blocks, chapters, containers,
  footnotes, timing, themes, and the keys a tab group answers to.
- [Extensions](docs/extensions.md) - what is on by default, and what a diagram
  fence needs from the page.
- [Printing and publishing](docs/publishing.md) - PDF export, cache-safe
  publishing, decks that work with no network.
- [Frontmatter](docs/frontmatter.md) - deck settings the source carries itself.
- [Training decks](docs/training.md) - the `--preset training` starter.
- [Reference](docs/reference.md) - every directive, flag, option and class.
- [Markdown or Carve](docs/markdown-vs-carve.md) - the comparison, including
  where Markdown is the better tool.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md), and [RELEASING.md](RELEASING.md) for what
a release runs through.
