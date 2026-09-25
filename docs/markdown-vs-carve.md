# Markdown or Carve for slides

reveal.js ships a Markdown plugin, and it works well. This page compares it with
Carve so you can pick the one that fits your deck, and it includes the cases
where Markdown is the better choice.

The behavior described here was checked against reveal.js 6.0.2 and
`@markup-carve/carve` 0.1.7.

## The short version

Markdown suits a deck of prose and bullets. Carve pays off when the deck carries
code, side-by-side comparisons, or gets edited by several people over months.

## 1. Code samples

The single biggest difference for a technical deck.

In Markdown, a fenced block is fine until you need an attribute on it. Then you
write HTML, and in HTML every `>` in your sample has to become `&gt;`:

```html
<pre><code class="language-php" data-line-numbers="1|2-3">
$query = $this-&gt;Orders-&gt;selectQuery();
$query-&gt;contain(['Customers'])
    -&gt;where(['status' =&gt; 'open']);
</code></pre>
```

Eleven escapes in four lines, each one a chance to break the sample while
editing. In Carve the attribute sits on its own line above the fence, and the
code stays code:

````
{data-line-numbers=1|2-3}
```php
$query = $this->Orders->selectQuery();
$query->contain(['Customers'])
    ->where(['status' => 'open']);
```
````

Carve renders those attributes onto `<pre>`; reveal reads them on `<code>`. This
plugin moves them, so stepwise highlighting works from the source above with no
further ceremony.

## 2. Layout

A before/after comparison is the workhorse slide of any migration talk. Markdown
has no concept of columns, so the source becomes HTML with Markdown islands:

```html
<div class="two-col">
<div class="before">

### Cake 4

```php
$table->query()->update();
```

</div>
<div class="after">
...
</div>
</div>
```

The blank lines inside the `<div>`s are load-bearing: without them the Markdown
inside is not parsed. Carve has containers with attributes, so the same slide is
markup all the way down:

```
{.two-col}
:::
{.before}
::::
### Cake 4

```php
$table->query()->update();
```
::::

{.after}
::::
### Cake 5

```php
$table->updateQuery();
```
::::
:::
```

Note the nesting rule: Carve containers get **wider on the inside** (`:::`
outside, `::::` inside), the opposite of code fences. `carve fmt` corrects it for
you, which leads to the next section.

## 3. The source is checkable

Six months later this is the difference you feel most, and Markdown has no
equivalent.

| Command | What it catches |
|---|---|
| `carve lint` | Markdown habits that silently mis-render in Carve, broken references, unbalanced containers |
| `carve fmt --check` | a source that is not in canonical form |
| `reveal-carve lint` | a mistyped directive, a slide with no heading, a wall of text, a code line too wide for the slide |

A Markdown deck has none of this. A typo in `<!-- .slide: class="center" -->`
does nothing and says nothing; you find out when the slide is on the projector.

The same holds for Carve's own directives - `%% notez` is a valid comment, so the
language cannot complain. That is exactly why `reveal-carve lint` exists.

## 4. Emphasis and the dialect tax

Carve is not Markdown with better tables, and pretending otherwise causes real
mistakes:

| | Markdown | Carve |
|---|---|---|
| bold | `**bold**` | `*bold*` |
| italic | `*italic*` or `_italic_` | `/italic/` |
| underline | not available | `_underline_` |
| strikethrough | `~~struck~~` | `~struck~` |
| highlight | not available | `=marked=` |
| superscript | not available | `{^sup^}` |

**This costs you something.** Your fingers know Markdown, so in the first week
you will write `**bold**` and get literal asterisks. `carve lint` reports that
case by name, so you correct it quickly instead of finding it on a slide.

## 5. Slide metadata

Markdown has no comment syntax, so reveal's plugin invented one on top of HTML
comments:

```markdown
<!-- .slide: class="center" data-background="#fff" -->
```

Carve has real comments, so the directives are part of the language and survive
every other tool that reads the document:

```
%% class: center
%% attr: data-background="#fff"
%% minutes: 5
%% notes
```

## 6. Reuse across decks

Markdown has no include mechanism; a shared slide is copy-paste, and the copies
drift.

Carve has `{{ path }}`. The engine resolves it in a separate pass,
`expandIncludes()`, with a resolver the host supplies. It sits outside rendering
because reading files a document names is a trust boundary.
reveal-carve drives that pass with the engine's filesystem resolver, so a deck
gets root containment, a byte budget, a depth limit and a list of every file it
was built from. One `house-rules.crv`, pulled into every deck that needs it.

## 7. How Markdown solves these instead

Markdown is not helpless here; it just answers each of these outside the
language. Every row below is a real, working approach, and every one is a
separate tool with its own dialect.

| Need | Markdown's answer | What it costs |
|---|---|---|
| Table of contents | Not in CommonMark. `markdown-it-table-of-contents`, `remark-toc`, or `doctoc`, which writes the list into the file and keeps it updated on re-runs | A preprocessor in the chain, and with doctoc a generated block living in your source |
| Includes | Not in Markdown. `markdown-it-include`, `embedme`, or a static site generator's shortcodes (`mdBook`'s `{{#include}}`, Hugo, Jekyll) | Works only inside that one tool; the file stops rendering correctly anywhere else |
| Attributes and classes | Not in CommonMark. `markdown-it-attrs`, Kramdown and Pandoc each ship `{.class}` with slightly different rules | Which Markdown you are writing becomes a question with a per-project answer |
| Comments | No comment syntax. HTML comments are the convention | reveal gives `<!-- .slide: -->` a meaning, so an invisible note and a directive look identical |
| Highlight, underline, sup/sub | GFM has `~~strike~~` only. `markdown-it-mark` and friends add the rest | Another plugin per construct |
| Source checking | `markdownlint` checks style: heading levels, list markers, trailing spaces | It cannot know that `<!-- .slde: -->` was meant to be a directive |
| Speaker notes | reveal's own `Note:` convention | Fine, but a Markdown-only convention: no other reader treats it as a note |
| Timing, agenda, handout | Nothing, anywhere | A spreadsheet, or a script you write |

For a reveal deck specifically, the Markdown plugin itself offers none of these.
Its whole configuration surface is separators, the two attribute-comment regexes,
`animateLists`, `smartypants`, and whatever you pass through to `marked`
(measured against `reveal.js` 6.0.2, `dist/plugin/markdown.mjs`).

**The difference is assembly, not capability.** Each Markdown answer works. You
pick five of them, install and configure them, and the next contributor has to
learn which combination this repository chose. Carve has one spec, one engine and
one lint, and the constructs above are either in the language or in a named
extension of it.

## 8. Where Markdown wins

- **No build step needed, ever.** reveal's Markdown plugin is bundled with
  reveal; Carve needs the engine on the page or a build step.
- **Everyone already knows it.** If someone else has to edit your deck in a
  hurry, Markdown has no learning cost.
- **Editor support is universal.** Carve has an LSP, a Tree-sitter grammar and
  plugins for IntelliJ, VS Code, Zed and Sublime, but you have to install them.
- **Smaller page weight.** The Carve browser bundle is roughly 740 KB; the
  Markdown plugin is already in reveal's dist. For a deck served over a
  conference wifi, that matters more than it should.
- **A prose deck gains nothing.** If your slides are a title and three bullets,
  every advantage above is theoretical.

## 9. Feature-by-feature

| | Markdown plugin | reveal-carve |
|---|---|---|
| Horizontal separator | `---`, configurable | `---`, configurable |
| Vertical separator | off by default | on by default (`--`) |
| Speaker notes | `Note:` at column 0 | `%% notes` |
| Slide classes | `<!-- .slide: -->` | `%% class:` |
| Element attributes | `<!-- .element: -->` | Carve attribute lines, native |
| List fragments | `animateLists` option | `%% fragments`, `{.fragments}`, or the option |
| Code line stepping | fence info string `js [1-3\|5]` | fence attribute line |
| Auto-animate | manual attribute | `%% animate` |
| Includes | none | `{{ path }}` |
| Agenda slide | none | `%% toc` |
| Timing plan | none | `%% minutes:` plus `reveal-carve agenda` |
| Handout export | none | `reveal-carve handout` |
| Source validation | none | `carve lint`, `carve fmt`, `reveal-carve lint` |
| Diagrams | bring your own | Carve extensions (`--extension mermaid`) |
| Locale typography | none | `--smart-quotes de` |

## 10. Choosing

Take Markdown when the deck is prose, when someone else will maintain it, or when
it has to be finished tonight.

Take Carve when the deck is about code, when the same material gets presented
more than once, or when you want the source checked by a tool. Learning the
dialect costs you a week. Escaping and copy-paste cost you on every edit.
