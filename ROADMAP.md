# Roadmap

What exists, and what is left. Priorities are about unblocking real decks, not
about effort.

## Shipped

- Runtime plugin (`data-carve`, inline or fetched) and Node build step, sharing
  one slicing implementation
- Chapter directories, and `{{ path }}` includes with a root boundary and cycle
  detection
- `%% class:`, `%% attr:`, `%% notes` and `%% fragments` directives
- `{.fragments}` for item-by-item lists, leaving reveal's `{.fragment}` intact
- Fence attributes moved from `<pre>` to `<code>` for stepwise line highlighting
- Visible error slides, `--strict` to fail instead
- `reveal-carve lint`, `reveal-carve handout`, `reveal-carve watch`
- `--split-at-heading N` for prose-shaped sources
- Theme helpers, and a demo site built by the same script locally and in CI
- ESM, CJS and a UMD bundle exposing the `RevealCarve` global

## Next

**Diagram fences.** Carve's Tier-3 `mermaid` and `chart` fences on slides. Needs
a decision on whether the extension is enabled by the plugin or handed in by the
deck, since both add a renderer to the page.

**Auto-animate pairs.** `%% attr:` already reaches `data-auto-animate`, but the
matched-element ids that make it look good deserve a directive of their own.

**PDF export as a subcommand.** `?print-pdf` plus headless Chrome is a recipe
everybody rewrites; it belongs in the CLI next to `handout`.

**Locale-aware typography.** carve-js exposes smart-quote locales, so a German
deck should get German quotation marks without configuration. A probe with
`smartQuoteLocale: 'de'` still produced English quotes, so the option name and
behavior need to be established against the engine first.

**A deck-level table of contents.** Carve has a TOC extension; a generated agenda
slide that stays in sync with the chapters would earn its place in a training
deck.

**Speaker-view niceties.** Timing hints per slide (`%% minutes: 5`) summed into a
running total, so a two-hour block can be planned rather than discovered.
