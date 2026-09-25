# reveal-carve

Write [reveal.js](https://revealjs.com) presentations in [Carve](https://markup-carve.github.io/carve/).

**[See the demo deck](https://markup-carve.github.io/reveal-carve/)** - the same source rendered in the browser, pre-rendered by the build step, and exported as a handout.

Two entry points over one implementation:

- **Runtime plugin** - the browser renders `.crv` files as the deck loads. No build step.
- **Build step** - Node renders the deck to a static page, with chapter directories, includes, linting and a handout export.

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
```

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
| `--no-notes` | handout without the speaker notes |

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

### Theme helpers

`dist/reveal-carve.css` carries the layout classes a technical deck keeps needing:
`two-col` with `before`/`after`, `exercise`, `note`, `big`, `tag`, plus the styling
for error slides. Load it after your reveal theme, or ignore it and bring your own.

## When a slide fails to render

A broken source produces a visible error slide carrying the engine's message, not a
silently shorter deck. Pass `--strict` (or `throwOnError`) to fail the build instead.

## Differences from the Markdown plugin

- Vertical splitting is **on by default** (`--`); reveal's Markdown plugin needs `data-separator-vertical`.
- Slide attributes come from `%%` directives rather than `<!-- .slide: -->` comments, because Carve has real comment syntax.
- The Carve engine is a peer dependency rather than bundled, so a page loads one engine no matter how many plugins use it.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). Planned work is in [ROADMAP.md](ROADMAP.md).

## License

MIT
