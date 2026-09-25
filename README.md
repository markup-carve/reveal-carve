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

### Code blocks

A fence's attribute line drives reveal's stepwise highlighting:

````
{data-line-numbers=1|2-3|4}
```php
$query = $this->Orders->selectQuery();
$query->contain(['Customers'])
    ->where(['status' => 'open']);
$total = $query->count();
```
````

Carve renders those attributes onto `<pre>`; the plugin moves the ones reveal reads
(`data-line-numbers`, `data-ln-start-from`, `data-trim`, `data-noescape`, `data-id`)
down to `<code>`.

### Chapters and includes

A directory source holds one file per chapter, ordered by name:

```
slides/
  010-intro.crv
  020-orm.crv
  030-outlook.crv
```

`{{ ../partials/house-rules.crv }}` pulls a shared slide into a deck. Includes stay
inside `--include-root`, refuse cycles, and can be switched off.

### Deck footer

There is no default footer: what belongs down there is your business. Give it
content and it appears, in the build step or at runtime.

```bash
reveal-carve build slides/deck.crv deck.html \
    --footer '<a href="index.html">Overview</a> <span>Built with Carve</span>'
```

```js
Reveal.initialize({
    carve: { footer: '<a href="index.html">Overview</a>' },
    plugins: [RevealCarve()],
});
```

It sits outside `.slides`, so it survives every transition, and it is hidden in
print. `footerClass` renames the element's class if `deck-footer` collides with
your own styles.

### Containers as other elements

Carve renders `{.card}` plus `:::` as `<div class="card">`. When the slide wants
real semantics, map the class to an element instead of writing raw HTML:

```bash
reveal-carve build slides/ deck.html --element card=figure --element quote=blockquote
```

```js
Reveal.initialize({
    carve: { elements: { card: 'figure', quote: 'blockquote' } },
});
```

The source stays pure Carve, so `carve lint` still checks it and the Markdown
handout still reads it. Raw HTML in the source would reach the HTML target only:
plain text, ANSI and the handout drop it.

### Code blocks: line numbers, diffs, callouts

```
{data-line-numbers}          numbers every line
{data-line-numbers=2|4-6}    numbers them and steps through those lines
{.diff}                      colours lines starting with + or -
```

All three are plain Carve attribute lines above the fence. Callout markers
(`<1>` at the end of a line, with a matching `<1> text` paragraph under the
block) keep their badge inside the code as well.

One caveat worth knowing: reveal's highlighter rebuilds a code block from its
text, which drops the markup for diffs and callouts. The plugin puts it back
once reveal is ready, so a deck that uses either should load the plugin - the
`pdf` command does that for its print copy on its own.

### Carve extensions

Carve's richer features are engine extensions. Enable them by name, in the build
step or at runtime, and the plugin resolves them against the engine:

```bash
reveal-carve build slides/ deck.html \
    --extension mermaid \
    --smart-quotes de \
    --js https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js
```

```js
Reveal.initialize({
    carve: { extensions: ['mermaid', { name: 'smartQuotes', options: { locale: 'de' } }] },
    plugins: [RevealCarve()],
});
```

Diagram extensions (`mermaid`, `chart`, `vegaLite`, `d2`, `graphviz`, `plantuml`,
`wavedrom`, `abc`, `mathBlock`) emit markup that their own renderer turns into a
picture. reveal-carve says so on the console rather than leaving you with an empty
rectangle on a slide.

What each one emits, and what draws it:

| Fence | Carve emits | Renderer on the page |
|---|---|---|
| ` ```mermaid ` | `<pre class="mermaid">` | Mermaid |
| ` ```chart ` | `<div class="chart">` with JSON | Chart.js, from the JSON |
| ` ```math ` | `<div class="math display">\[ … \]</div>` | KaTeX or MathJax |
| ` ```svg ` | `<img src="data:image/svg+xml,…">` | none: the SVG is sanitized and inlined |

Call `mermaid.render()` per block and write the SVG back yourself rather than
`mermaid.run()`. Reveal keeps every slide but the current one at `display: none`,
and a flowchart laid out in a hidden slide measures its labels as zero, so it
comes out empty or as a syntax error in a printed copy. The demo site's
`scripts/build-site.mjs` has the loop.

The SVG fence is `img` by default; `imgFence:{"language":"svg"}` makes it ` ```svg `.
The [showcase deck](https://markup-carve.github.io/reveal-carve/showcase.html)
runs all four.

`graphviz`, `d2`, `plantuml`, `wavedrom`, `vegaLite` and `abc` work the same way:
Carve emits `<pre class="graphviz">` and the like, and you add that project's
renderer with `--js`. The demo site leaves them out on purpose - six more
renderers would make it slower, not more convincing.

### Tabs and code groups from the keyboard

On a slide carrying a tab group or a code group, the up and down keys step
through its panels. Left and right stay with the deck, and once the group is at
its last panel, down moves the deck on as usual - so a speaker with a clicker
never has to reach for the mouse, and never gets stuck cycling one slide.

`tabs`, `details` and `spoiler` are markup too: the theme styles them, and the
demo site ships about thirty lines of script to make spoilers reveal. Copy that
from `scripts/build-site.mjs` if you want the same behavior.

### PDF export

```bash
reveal-carve pdf slides/deck.crv deck.pdf
```

Given a Carve source rather than an HTML file, the PDF is built from a print copy
of the deck in Carve's static mode. That matters for anything interactive: a tab
group on screen shows one panel at a time, and printing the live deck would put
only that panel on the page. In static mode the panels unfold into sections with
their labels as headings, so the handout carries all of them. Code groups behave
the same way.

An overlong slide runs onto a second page rather than being cut, and code wraps
instead of leaving the paper.

Printing an HTML deck directly also works, and prints exactly what is on screen:

```bash
reveal-carve pdf deck.html deck.pdf
```

The export drives Chrome over the DevTools protocol and waits for reveal's print
layout to exist. Chrome's own `--print-to-pdf` flag prints when its timer runs
out, which produced a blank one-page PDF for a deck that had printed twelve pages
a minute earlier, from the same file.

### Publishing an updated deck

A static host serves a deck's files under the same names with a cache lifetime of
its own; GitHub Pages sends `max-age=600`. Until that expires the browser keeps
the old stylesheet and the old bundle, and the reader has to hard-refresh to see
your change.

Pass `version` (or `--version`) and every local asset URL gets that marker, so a
new build is a new URL:

```bash
reveal-carve build slides/ deck.html --version $(git rev-parse --short HEAD)
```

The HTML page itself still follows the host's cache rules, which on GitHub Pages
means up to ten minutes. Nothing a deck can do changes that.

### Offline decks

A deck presented in a room with no wifi cannot load renderers from a CDN. Vendor
them next to the deck and point `--js` at the local copies:

```bash
npm install mermaid chart.js katex
mkdir -p deck/vendor
cp node_modules/mermaid/dist/mermaid.min.js deck/vendor/
cp node_modules/chart.js/dist/chart.umd.js deck/vendor/
cp -r node_modules/katex/dist deck/vendor/katex

reveal-carve build slides/ deck/index.html \
    --reveal-base vendor/reveal \
    --js vendor/mermaid.min.js --js vendor/chart.umd.js \
    --js vendor/katex/katex.min.js --css vendor/katex/katex.min.css
```

Everything else - reveal, the Carve engine, the plugin - is already local when it
comes from `node_modules`. The SVG fence needs nothing at all: the image is
inlined as a data URI.

### Footnotes on a slide

A footnote definition belongs to the document, and `carve fmt` moves definitions
to its end - which on a deck means slide twelve holds the note that slide three
points at. reveal-carve collects the definitions and gives each one to the slide
that references it. An unreferenced definition is dropped rather than shown on its
own. Pass `footnotes: false` to leave the source alone.

### Planning the time

```bash
reveal-carve agenda slides/ --budget 120
#  20 min  CakePHP 5 in one slide
#  40 min  Reading the code together
#  ...
# Total: 115 min over 6 planned slides.
```

`%% toc` puts the same list on a slide, with the minutes beside each entry, so the
agenda cannot drift away from the deck it describes.

### Speaker timer

`%% minutes: 5` on a slide is a plan; `carve: { timer: true }` compares it with
the clock. The box shows elapsed against planned and how far ahead or behind you
are, and it only appears in the speaker view - `timer: 'always'` overrides that.

### Agenda by chapter

`%% toc` lists every slide. `%% toc: chapters` lists the chapter files instead,
with the minutes of each chapter added up, which is the agenda a training deck
wants:

```
- Introduction [20 min]
- Reading the code [40 min]
- Upgrade strategy [30 min]
```

### Dark theme

`dist/reveal-carve-dark.css` carries the same class names with values for a dark
room. Load it instead of `reveal-carve.css`, after a dark reveal theme.

The build step can ship both and put a switch in the corner of the deck:

```bash
reveal-carve build slides/ deck.html --dark-theme black --dark-css vendor/reveal-carve-dark.css
```

The first visit follows the reader's own system setting, the choice is
remembered per browser, and the switch never reaches paper. `--dark` starts in
the dark theme regardless.

### Theme helpers

`dist/reveal-carve.css` carries the layout classes a technical deck keeps needing:
`two-col` with `before`/`after`, `exercise`, `note`, `big`, `tag`, the deck footer,
plus the styling for error slides. Load it after your reveal theme, or ignore it and bring your own.

## When a slide fails to render

A broken source produces a visible error slide carrying the engine's message, not a
silently shorter deck. Pass `--strict` (or `throwOnError`) to fail the build instead.

## Differences from the Markdown plugin

- Vertical splitting is **on by default** (`--`); reveal's Markdown plugin needs `data-separator-vertical`.
- Slide attributes come from `%%` directives rather than `<!-- .slide: -->` comments, because Carve has real comment syntax.
- The Carve engine is a peer dependency rather than bundled, so a page loads one engine no matter how many plugins use it.

## Documentation

- [Getting started](docs/getting-started.md)
- [Reference](docs/reference.md)
- [Markdown or Carve](docs/markdown-vs-carve.md)

## Markdown or Carve

A side-by-side comparison, including the cases where Markdown is the better
choice: [docs/markdown-vs-carve.md](docs/markdown-vs-carve.md).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).
