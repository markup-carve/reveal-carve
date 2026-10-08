# Authoring slides

What a deck source can say, beyond the directives in the [reference](reference.md): code blocks and their attributes, chapters and includes, containers, footnotes, timing, and the keys a group answers to.

### Code blocks

A fence's attribute line drives reveal's stepwise highlighting:

````
{data-line-numbers="1\|2-3\|4"}
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

### Code blocks: line numbers, diffs, callouts

```
{data-line-numbers}          numbers every line
{data-line-numbers="2\|4-6"}    numbers them and steps through those lines
{.diff}                      colours lines starting with + or -
```

All three are plain Carve attribute lines above the fence. Callout markers
(`<1>` at the end of a line, with a matching `<1> text` paragraph under the
block) keep their badge inside the code as well.

One caveat worth knowing: reveal's highlighter rebuilds a code block from its
text, which drops the markup for diffs and callouts. The plugin puts it back
once reveal is ready, so a deck that uses either should load the plugin - the
`pdf` command does that for its print copy on its own.

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

### Containers as other elements

Carve renders `{.card}` plus `:::` as `<div class="card">`. When the slide wants
real semantics, map the class to an element instead of writing raw HTML:

```bash
reveal-carve build slides/ deck.html --element card=figure --element quote=blockquote
```

```js
Reveal.initialize({
    carve: { elements: { card: 'figure', quote: 'blockquote' } },
});
```

The source stays pure Carve, so `carve lint` still checks it and the Markdown
handout still reads it. Raw HTML in the source would reach the HTML target only:
plain text, ANSI and the handout drop it.

### Footnotes on a slide

A footnote definition belongs to the document, and `carve fmt` moves definitions
to its end - which on a deck means slide twelve holds the note that slide three
points at. reveal-carve collects the definitions and gives each one to the slide
that references it. An unreferenced definition is dropped rather than shown on its
own. Pass `footnotes: false` to leave the source alone.

### Tabs and code groups from the keyboard

On a slide carrying a tab group or a code group, the up and down keys step
through its panels. Left and right stay with the deck, and once the group is at
its last panel, down moves the deck on as usual - so a speaker with a clicker
never has to reach for the mouse, and never gets stuck cycling one slide.

`tabs`, `details` and `spoiler` are markup too: the theme styles them, and the
demo site ships about thirty lines of script to make spoilers reveal. Copy that
from `scripts/build-site.mjs` if you want the same behavior.

### Planning the time

```bash
reveal-carve agenda slides/ --budget 120
#  20 min  CakePHP 5 in one slide
#  40 min  Reading the code together
#  ...
# Total: 115 min over 6 planned slides.
```

`%% toc` puts the same list on a slide, with the minutes beside each entry, so the
agenda cannot drift away from the deck it describes.

### Speaker timer

`%% minutes: 5` on a slide is a plan; `carve: { timer: true }` compares it with
the clock. The box shows elapsed against planned and how far ahead or behind you
are, and it only appears in the speaker view - `timer: 'always'` overrides that.

### Agenda by chapter

`%% toc` lists every slide. `%% toc: chapters` lists the chapter files instead,
with the minutes of each chapter added up, which is the agenda a training deck
wants:

```
- Introduction [20 min]
- Reading the code [40 min]
- Upgrade strategy [30 min]
```

### Deck footer

There is no default footer: what belongs down there is your business. Give it
content and it appears, in the build step or at runtime.

```bash
reveal-carve build slides/deck.crv deck.html \
    --footer '<a href="index.html">Overview</a> <span>Built with Carve</span>'
```

```js
Reveal.initialize({
    carve: { footer: '<a href="index.html">Overview</a>' },
    plugins: [RevealCarve()],
});
```

It sits outside `.slides`, so it survives every transition, and it is hidden in
print. `footerClass` renames the element's class if `deck-footer` collides with
your own styles.

### Dark theme

`dist/reveal-carve-dark.css` carries the same class names with values for a dark
room. Load it instead of `reveal-carve.css`, after a dark reveal theme.

The build step can ship both and put a switch in the corner of the deck:

```bash
reveal-carve build slides/ deck.html --dark-theme black --dark-css vendor/reveal-carve-dark.css
```

The first visit follows the reader's own system setting, the choice is
remembered per browser, and the switch never reaches paper. `--dark` starts in
the dark theme regardless.

### Theme helpers

`dist/reveal-carve.css` carries the layout classes a technical deck keeps needing:
`two-col` with `before`/`after`, `exercise`, `note`, `big`, `tag`, the deck footer,
plus the styling for error slides. Load it after your reveal theme, or ignore it and bring your own.
