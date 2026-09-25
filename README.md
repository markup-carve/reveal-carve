# reveal-carve

Write [reveal.js](https://revealjs.com) presentations in [Carve](https://markup-carve.github.io/carve/).

Two ways to use it, sharing one slicing implementation:

- **Runtime plugin** - the browser renders `.crv` files as the deck loads. No build step.
- **Build step** - Node renders the deck to a static HTML file. For handouts, PDF export, or pages that must not run a renderer in the browser.

## Why Carve for slides

- Single-delimiter emphasis: `*bold*`, `/italic/`, `` `code` ``
- Code samples need no HTML escaping, so `$this->find()` is written as it appears
- Containers carry attributes (`{.two-col}` then `:::`), so a two-column comparison is markup rather than embedded HTML
- `carve lint` and `carve fmt --check` validate the source before it reaches a browser

## Install

```bash
npm install @markup-carve/reveal-carve @markup-carve/carve reveal.js
```

## Runtime plugin

```html
<section data-carve="slides/deck.crv"></section>

<script src="node_modules/@markup-carve/carve/dist/carve.iife.min.js"></script>
<script src="node_modules/reveal.js/dist/reveal.js"></script>
<script type="module">
import RevealCarve from '@markup-carve/reveal-carve';

Reveal.initialize({
    plugins: [RevealCarve()],
});
</script>
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

The plugin takes the Carve engine from the global `carve` object. Pass your own with `Reveal.initialize({ carve: { carve: myEngine } })`, or a plain function with `{ carve: { render: (text) => html } }`.

## Build step

```bash
npx reveal-carve slides/deck.crv deck.html --title "My deck"
npx reveal-carve slides/chapters/ deck.html --title "My deck"
```

A directory source holds one file per chapter. Chapters are ordered by file name and joined with the slide separator, so `010-intro.crv`, `020-orm.crv`, `030-outlook.crv` gives a readable running order.

| Flag | Meaning |
|---|---|
| `--title` | page title |
| `--theme` | reveal theme name, default `white` |
| `--lang` | `<html lang>`, default `en` |
| `--reveal-base` | path to reveal's `dist`, default `node_modules/reveal.js/dist` |
| `--css`, `--js` | extra stylesheets and scripts, repeatable |
| `--slides-only` | write only the `<section>` markup, no page around it |

In JavaScript:

```js
import { buildPage, buildSlides } from '@markup-carve/reveal-carve/build';
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

All four directives are ordinary Carve comments, so the document still renders correctly through any other Carve tool. Separators are configurable per section (`data-separator`, `data-separator-vertical`, `data-separator-notes`) or globally in the `carve` config block.

### Code blocks

A fence's attribute line flows onto reveal's `<code>` element, so reveal's stepwise line highlighting works:

````
{data-line-numbers="1-3|5"}
```php
$query->select(['id'])
    ->where(['active' => true])
    ->all();
```
````

Carve renders those attributes onto `<pre>`; this plugin moves the ones reveal reads (`data-line-numbers`, `data-ln-start-from`, `data-trim`, `data-noescape`, `data-id`) down to `<code>`.

## Differences from the Markdown plugin

- Vertical splitting is **on by default** (`--`). reveal's Markdown plugin has it off unless you set `data-separator-vertical`.
- Slide attributes come from `%%` directives rather than `<!-- .slide: -->` comments, because Carve has real comment syntax.
- The Carve engine is a peer dependency rather than bundled, so a page loads one engine no matter how many plugins use it.

## Demo

```bash
npm install
npx http-server .      # or any static server
# open demo/index.html
```

`demo/index.html` uses the runtime plugin; `npm run demo:static` renders the same source to a static page.

## License

MIT
