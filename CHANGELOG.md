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
