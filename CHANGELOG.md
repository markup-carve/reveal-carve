# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Runtime reveal.js plugin: a `<section data-carve="file.crv">` or an inline
  `data-template` is replaced by the slides the Carve source describes.
- Build step and `reveal-carve` CLI with `build`, `watch`, `lint` and `handout`.
- Chapter directories as a deck source, ordered by file name.
- Include resolution for `{{ path }}`, bounded to a root directory and refusing
  cycles.
- Slide directives `%% class:`, `%% attr:`, `%% notes` and `%% fragments`, all
  ordinary Carve comments.
- `{.fragments}` on a list reveals it item by item; `{.fragment}` keeps reveal's
  own meaning of one step for the whole element.
- Fence attributes move from `<pre>` to `<code>` so reveal's stepwise line
  highlighting works on Carve code blocks.
- A slide that fails to render becomes a visible error slide; `--strict` fails
  the build instead.
- `--split-at-heading N` for prose-shaped sources.
- Handout export through Carve's Markdown writer, with speaker notes as quotes.
- Deck linting for mistyped directives, headless slides, text budget and code
  lines too wide for a slide.
- Theme helpers in `dist/reveal-carve.css`.
- Ships as ESM, CJS and a UMD bundle exposing the `RevealCarve` global.
- Optional deck footer, configured in the build step (`--footer`, `--footer-file`)
  or at runtime (`carve: { footer }`). No default content.
- Built pages now start from the same reveal defaults a hand-written page has
  (`hash`, `slideNumber`), overridable through `config`.
- Carve extensions by name (`--extension`, `carve: { extensions }`), including
  locale-aware quotation marks through `--smart-quotes`.
- `%% animate`, `%% minutes:` and `%% toc` directives; `reveal-carve agenda`
  reports the planned time and fails over `--budget`.
- `reveal-carve pdf` prints a built deck with headless Chrome.
- Container classes can render as other elements (`--element card=figure`,
  `carve: { elements }`), so a slide gets real semantics without raw HTML.
- Footnote definitions follow the slide that references them, instead of ending
  up on the last slide where canonical formatting puts them.
- Includes are expanded by the Carve engine itself (`expandIncludes` with the
  filesystem resolver from `@markup-carve/carve/node`), which brings root
  containment, a byte budget and the list of files a deck was built from.
- Theme styling for task lists, admonitions, definition lists, footnotes, tabs,
  folded details, spoilers, swatches, keyboard keys and block quotes.
- `reveal-carve pdf` builds a print copy in Carve's static mode when given a
  source, so tabs and code groups appear in full rather than one panel deep.
- PDF export drives Chrome over the DevTools protocol and waits for reveal's
  print layout, instead of trusting `--print-to-pdf` and a timer.
- `%% toc: chapters` lists chapter files with their summed minutes.
- Speaker timer from `%% minutes:`, shown in the speaker view.
- `reveal-carve vendor` copies reveal, Carve and the diagram renderers next to a
  deck; `reveal-carve check` runs carve lint, carve fmt and the deck rules.
- Dark theme, `{.diff}` line colouring, and `{data-line-numbers}` documented.
- Callout badges and diff markers survive reveal's highlighter.
- Code groups and css-mode tabs show exactly one panel again.
- `reveal-carve init <dir>` writes a starter deck: chapters, a shared partial and
  the commands to run it.
- A light/dark switch in the deck: `--dark-theme`, `--dark-css` and `--dark`
  ship both themes in one page, following the reader's system setting on the
  first visit and remembering the choice after that.
- Task list checkboxes are drawn by the theme - green when done, red while open -
  and keep their colour in print.
- `@markup-carve/reveal-carve/pdf` and `/init` are exported for use from Node.
- `reveal-carve vendor` copies the plugin's own bundle and both stylesheets too,
  so a vendored deck needs nothing from `node_modules`.
- A page that loads the plugin bundle through `--js` gets `RevealCarve()` in its
  plugin list without being told twice.
- Size classes `small`, `smaller` and `tiny`, on a block or a whole slide.
- Code inside a `two-col` column is set smaller and wrapped, instead of running
  under a horizontal scrollbar nobody can reach from the third row.
- The deck check runs three passes per deck - on screen, in print layout and in
  the dark theme - and fails on an empty diagram, a blank trailing page or text
  without contrast.
- Documentation: a getting-started walkthrough and a reference page under
  `docs/`.

### Fixed

- Mermaid diagrams came out empty, or as a syntax error in a printed deck: a
  flowchart laid out inside a hidden slide measures its labels as zero. Each
  block is rendered on its own now, and the demo pages show how.
- The published dark stylesheet imported a file name that does not exist in
  `dist`, so a dark deck loaded the colours and none of the layout.
- A printed deck gained a blank last page from the tooltip host Mermaid leaves
  on the body.
- A long agenda put a single entry on its continuation slide; the entries are
  spread evenly over as many slides as they need.
- `%% chapter:`, which the build step writes itself, no longer trips the linter.
- The development server stops watching when it is closed, so a process that
  served a deck can exit.
- `reveal-carve pdf` resolves `--css` and `--js` paths against the working
  directory rather than the temp directory it builds the print copy in.
