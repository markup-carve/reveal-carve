# Carve extensions

Which extensions a deck gets without asking, which ones it has to ask for, and what each one needs from the page. The full table is in the [reference](reference.md#what-is-on-without-asking-and-what-is-not).

Tabs, code groups, folded details, spoilers, list tables, colour swatches,
semantic spans and code callouts are **on by default**. They need nothing from
the page - the plugin's own stylesheet covers all of them - and with them off a
tab group renders as stacked paragraphs with its labels as prose, which looks
like broken markup and reports no error.

Off by default, because their off-state is the better one: everything that needs
its own script (`mermaid`, `chart`, `mathBlock`, `vegaLite`, `d2`, `graphviz`,
`plantuml`, `wavedrom`, `abc`), `smartQuotes`, which needs a locale, and
`imgFence`, which changes what a fence is.

```bash
reveal-carve build slides/ deck.html --no-extension spoiler   # one off
reveal-carve build slides/ deck.html --core-only              # all off
```

```js
Reveal.initialize({
    carve: { extensions: false },   // core Carve only
    plugins: [RevealCarve()],
});
```

Enable the rest by name, in the build step or at runtime, and the plugin
resolves them against the engine:

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
