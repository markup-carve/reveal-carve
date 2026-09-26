# Reference

Everything the plugin reads: directives in a source, flags on the command line,
options in `Reveal.initialize`, and the classes the stylesheet brings.

## Slide directives

A directive is an ordinary Carve comment, so a source with directives still
renders through any other Carve tool. A mistyped one is silent - that is what
`reveal-carve lint` is for.

| Directive | Effect |
|---|---|
| `%% class: center big` | CSS classes on this slide's `<section>` |
| `%% attr: data-background="#123"` | raw attributes on the `<section>` |
| `%% notes` | everything after it is a speaker note |
| `%% fragments` | every list on this slide reveals item by item |
| `%% animate` | auto-animate this slide against the next |
| `%% minutes: 5` | planned length, summed by `reveal-carve agenda` |
| `%% toc` | fill this slide with an agenda of the other slides |
| `%% toc: chapters` | an agenda of chapters rather than of slides |
| `%% chapter: Name` | written by the build step, not by hand |

Separators: `---` starts the next slide, `--` the next slide in a vertical
stack. `--split-at-heading N` starts one at every level-N heading instead.

## Attributes on a block

| Written above the block | What it does |
|---|---|
| `{.fragments}` on a list | that one list reveals item by item |
| `{.fragment}` on anything | one reveal step for the whole element |
| `{data-line-numbers=1|2-3}` on a fence | reveal's stepwise code highlighting |
| `{.diff}` on a fence | added lines green, removed lines red |
| `{.callout}` in a fence | a numbered badge that survives the highlighter |
| `{.two-col}` on a container | two columns side by side |
| `{.small}`, `{.smaller}`, `{.tiny}` on anything | smaller type for that block |

`data-line-numbers`, `data-ln-start-from`, `data-trim`, `data-noescape` and
`data-id` are moved from `<pre>` down to `<code>`, which is where reveal reads
them.

## Command line

| Verb | What it does |
|---|---|
| `init <dir>` | write a starter deck: chapters, a partial, a README |
| `build <source> <target.html>` | render a deck to one page |
| `watch <source> <target.html>` | rebuild on save, reload the browser |
| `lint <source...>` | deck problems: unknown directives and the like |
| `check <source...>` | `carve lint`, `carve fmt --check` and the deck rules |
| `agenda <source>` | the running order and its planned minutes |
| `handout <source> <target.md>` | slides plus what you said about them |
| `pdf <source> <out.pdf>` | a print copy, built and printed by Chrome |
| `vendor <dir>` | copy reveal, Carve and the renderers next to the deck |

| Flag | Meaning |
|---|---|
| `--title`, `--theme`, `--lang` | page title, reveal theme (default `white`), `<html lang>` |
| `--dark-theme NAME` | a second reveal theme, with a switch in the corner |
| `--dark-css FILE` | extra stylesheet for the dark theme, repeatable |
| `--dark` | start in the dark theme |
| `--reveal-base DIR` | path to reveal's `dist` |
| `--css FILE`, `--js FILE` | extra stylesheets and scripts, repeatable |
| `--footer "<html>"`, `--footer-file FILE` | a footer under every slide |
| `--extension NAME[:VALUE|:JSON]` | enable a Carve extension, repeatable |
| `--no-extension NAME` | turn one of the defaults off, repeatable |
| `--core-only` | no extensions at all |
| `--smart-quotes LOCALE` | locale-aware quotation marks |
| `--element CLASS=ELEMENT` | render a container class as a real element |
| `--split-at-heading N` | a new slide at every level-N heading |
| `--animate-lists` | every list reveals one item at a time |
| `--include-root DIR` | directory includes may not escape |
| `--no-includes` | leave `{{ path }}` as literal text |
| `--slides-only` | write the sections without a page around them |
| `--static` | Carve's static mode: tabs and code groups unfolded |
| `--strict` | fail the build instead of rendering an error slide |
| `--version MARKER` | stamp asset URLs, so a publish is not cached |
| `--budget N` | `agenda` fails over N planned minutes |
| `--no-notes` | handout without the speaker notes |
| `--no-reveal-spoilers` | print without the slide that opens spoilers |
| `--port N` | port for `watch` |

## What is on without asking, and what is not

Core Carve syntax always works - no flag, no extension:

headings, paragraphs, `_emphasis_` and `*strong*`, inline code, fenced code with
an attribute line, bullet, ordered and task lists, tables (`|=` marks a header
row), block quotes, links and images, footnotes, definition lists, `:::`
containers, `{.class key=value}` attribute lines, `%%` comments, `{{ includes }}`
(the build step resolves them), and braced `{^sup^}` / `{~sub~}`.

Eight extensions are on unless a deck turns them off, because they need nothing
from the page and their off-state reads as broken markup: `tabs`, `codeGroup`,
`details`, `spoiler`, `listTable`, `colorSwatch`, `semanticSpan` and
`codeCallouts`. Drop one with `--no-extension NAME`, or all of them with
`--core-only` (`carve: { extensions: false }` at runtime).

The rest are off until a deck asks for them with `--extension NAME` or
`carve: { extensions: [...] }`:

| Extension | What it adds | On by default | Needs a renderer on the page |
|---|---|---|---|
| `tabs` | `::: tabs` with `:::: tab [Label]` | yes | no |
| `codeGroup` | one code block per file, switched | yes | no |
| `details` | a folded block | yes | no |
| `spoiler` | text blacked out until asked for | yes | no |
| `listTable` | a table written as a nested list | yes | no |
| `colorSwatch` | `:color[#abc]` chips | yes | no |
| `semanticSpan` | inline spans with a role | yes | no |
| `codeCallouts` | numbered markers inside a fence | yes | no |
| `smartQuotes` | locale-aware quotation marks | no, it needs a locale | no |
| `headingNumbers`, `headingPermalinks`, `headingLevelShift`, `headingReference` | heading numbering, anchors, level shifting | no | no |
| `tableOfContents`, `tocPlacement` | a generated contents list | no | no |
| `citations`, `glossary`, `index`, `wikilinks` | scholarly and wiki constructs | no | no |
| `autolink`, `externalLinks` | bare URLs, and marking outbound links | no | no |
| `defaultAttributes`, `tabNormalize`, `fencedRender` | attribute defaults, tab normalization, a generic fence hook | no | no |
| `imgFence` | a fence that becomes an image, e.g. inline SVG | no | no |
| `mermaid` | `<pre class="mermaid">` | no | Mermaid |
| `chart` | `<div class="chart">` plus JSON | no | Chart.js |
| `mathBlock` | display math | no | KaTeX or MathJax |
| `vegaLite`, `d2`, `graphviz`, `plantuml`, `wavedrom`, `abc` | that project's diagram fence | no | that project's script |

The demo site runs mermaid,
chart, mathBlock, imgFence (as ` ```svg `), details, tabs (aria mode), listTable,
spoiler, colorSwatch, semanticSpan, codeCallouts, codeGroup and smartQuotes -
`scripts/build-site.mjs` has the list in one place.

The plugin's own behavior - the deck footer, the speaker timer, the tab and
spoiler keys, callout badges and diff colouring surviving the highlighter - is
not an extension and needs no flag, beyond the markup itself.

## Keys

| Key | On a slide with a tab or code group | Anywhere else |
|---|---|---|
| Up, Down | previous/next panel; past the ends, the deck | the deck's vertical navigation |
| Left, Right | the deck | the deck |
| Home, End | first/last panel while the strip has focus | the deck's first/last slide |

## Plugin options

```js
Reveal.initialize({
    carve: {
        extensions: ['mermaid', 'chart', { name: 'smartQuotes', options: { locale: 'de' } }],
        footer: '<a href="index.html">Overview</a>',
        tabs: true,             // 'fragments' to step through tabs instead
        timer: 'always',        // default: the speaker view only
        elements: { card: 'figure' },
        animateLists: false,
        splitAtHeading: 0,
        throwOnError: false,
    },
    plugins: [RevealCarve()],
});
```

`carve: { engine }` passes an engine in; without it the plugin takes
`window.carve`, the browser bundle the Carve package ships.

Per section, `data-carve="file.crv"`, `data-separator`,
`data-separator-vertical`, `data-separator-notes`, `data-split-at-heading`,
`data-animate-lists` and `data-charset` override the deck-wide setting.

## Layout classes

From `dist/reveal-carve.css`, loaded after a reveal theme:

| Class | What it is for |
|---|---|
| `two-col` | two columns; `before` and `after` colour them. Code in a column is set smaller and wrapped |
| `small`, `smaller`, `tiny` | 0.8em, 0.65em, 0.5em - on a block or a whole slide |
| `exercise` | a task block, set off from the slide |
| `note` | a quiet aside under the content |
| `big` | one statement, filling the slide |
| `tag`, `tag muted`, `tag ok` | a small label in running text |
| `card` | a framed block; `--element card=figure` makes it a `<figure>` |
| `toc-list`, `columns-2` | the agenda a `%% toc` slide carries |
| `deck-footer` | the footer element the plugin fills |

Carve's own constructs are styled too: admonitions, definition lists, task
lists, tabs, code groups, spoilers, colour swatches, footnotes and endnotes.

`dist/reveal-carve-dark.css` carries the same class names with dark-room values
and imports the light file, so it is loaded instead of it, after a dark reveal
theme.

## JavaScript API

```js
import { buildPage, buildSlides, readSource } from '@markup-carve/reveal-carve/build';
import { buildHandout } from '@markup-carve/reveal-carve/handout';
import { exportPdf } from '@markup-carve/reveal-carve/pdf';
import { lintSource } from '@markup-carve/reveal-carve/lint';
import { initDeck } from '@markup-carve/reveal-carve/init';
```

`buildPage` returns the number of slides it wrote; `exportPdf` resolves to
`{ target, pages }`.
