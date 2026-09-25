# Markdown or Carve for slides

reveal.js ships a Markdown plugin, and it works. This page is the honest case for
using Carve instead, with the places Markdown wins listed too.

Everything here was measured against reveal.js 6.0.2 and `@markup-carve/carve`
0.1.7, not recalled.

## The short version

Markdown is the right choice for a deck of prose and bullets. Carve earns its
place when the deck carries code, side-by-side comparisons, or has to stay
correct while several people edit it over months.

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
outside, `::::` inside), the opposite of code fences. `carve fmt` fixes this for
you, which is the point of the next section.

## 3. The source is checkable

This is the argument that matters six months in, and it has no Markdown
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

**This is a real cost.** Your fingers know Markdown. The first week in Carve you
will write `**bold**` and get literal asterisks. The saving grace is that `carve
lint` reports exactly that case, so it is a fast correction rather than a slow
discovery.

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

Carve has `{{ path }}`. carve-js does not resolve it while rendering, so
reveal-carve does it in the build step, bounded to a root directory and refusing
cycles. One `house-rules.crv`, pulled into every deck that needs it.

## 7. Where Markdown wins

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

## 8. Feature-by-feature

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

## 9. Choosing

Take Markdown when the deck is prose, when someone else will maintain it, or when
you need it finished tonight.

Take Carve when the deck is about code, when the same material gets presented
more than once, or when you want the source checked rather than eyeballed. The
dialect costs you a week; the escaping and the copy-paste cost you every time.
