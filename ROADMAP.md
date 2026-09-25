# Roadmap

What exists today, and what would make this worth depending on. Priorities are
about unblocking real decks, not about effort.

## Shipped

- Runtime plugin (`data-carve`, inline or fetched) and Node build step
- Chapter directories as a deck source
- `%% class:`, `%% attr:` and `%% notes` directives
- Fence attributes moved from `<pre>` to `<code>` for reveal's line highlighting
- Attribute forwarding from the source section, idempotency guard, `data-charset`

## P1 - needed before anyone else can use this

**1. Dual build: ESM plus UMD global.**
reveal ships each plugin as a `.mjs` (ESM, default export) and a `.js` (UMD
assigning `window.Reveal<Name>`), wired through an `exports` subpath. Today this
package is ESM only, so the `<script src=...>` path that most reveal decks use
does not work. Ship `dist/reveal-carve.js` with the global `RevealCarve` and keep
the source as the ESM entry.

**2. List fragments.**
Carve puts `{.fragment}` on the `<ul>`, not on each `<li>` (measured), so
stepwise reveals of a bullet list do not work the way they do in Markdown decks.
reveal's Markdown plugin solves this with an `animateLists` option that rewrites
every `<li>`. Offer the same, plus a per-slide directive for the cases where only
one list should animate.

**3. Visible failure.**
A Carve source with a broken container currently produces a short deck rather
than an error. Render a diagnostic slide carrying the engine's message, and log
it, so a mistake is obvious on the projector instead of silently missing.

## P2 - makes it pleasant

**4. Include resolution in the build.**
`{{ path }}` is Carve syntax, but carve-js does not resolve it while rendering
(measured: the directive renders as literal text). Resolving it in the build step
turns a deck into a slide library: shared title slides, a reused disclaimer, a
chapter pulled into two decks. Needs a path boundary and cycle detection.

**5. Watch mode and dev server.**
Rebuild on save and reload the browser over server-sent events. This already
exists as a one-off script in a training project; it belongs here.

**6. `reveal-carve lint`.**
Wrap `carve lint` and add deck rules: unknown `%%` directive (today a typo is
silently a comment), slide without a heading, slide over a text budget, code
block wider than the slide.

**7. Handout export.**
`carveToMarkdown()` exists in carve-js, so the same source can produce a Markdown
or PDF handout with the speaker notes included. Attendees usually ask for the
slides; this answers with something readable.

## P3 - nice, not urgent

**8. Diagram fences.** Carve's Tier-3 `mermaid` and `chart` fences on slides.

**9. Auto-animate.** Directive sugar for reveal's `data-auto-animate` pairs.

**10. Automatic slide splitting.** `splitAtHeading: 2` instead of `---`, for
prose-shaped sources.

**11. A theme package.** The layout classes a technical deck keeps needing:
two-column comparison, exercise box, version tag.

**12. Locale-aware typography.** carve-js exposes smart-quote locales; German
decks should get German quotation marks without configuration. The option name
and behavior need to be established first - a quick probe with
`smartQuoteLocale: 'de'` still produced English quotes.
