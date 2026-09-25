# Getting started

From an empty directory to a deck you can present, in five commands.

## Install

```bash
npm init -y
npm install @markup-carve/reveal-carve @markup-carve/carve reveal.js
```

The Carve engine and reveal.js are peer dependencies: a page loads one of each,
however many plugins use them.

## Write the first deck

```bash
npx reveal-carve init talk
```

That writes a chapter directory, a shared partial and a README with the commands
for the deck:

```
talk/
  slides/
    010-opening.crv      title slide, speaker notes, an agenda
    020-chapter.crv      two columns, a diff, an include
    partials/
      thanks.crv         a slide pulled into the chapter above
  README.md
```

Chapters are joined in file-name order, so the running order is what a directory
listing shows, and reordering is renaming.

## Watch it while you write

The deck loads reveal.js and the theme from next to itself, so copy them in once:

```bash
cd talk
npx reveal-carve vendor vendor
npx reveal-carve watch slides deck.html --port 8800 \
    --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js
```

Open <http://localhost:8800/deck.html>. Every save rebuilds the deck and reloads
the page, including saves to an included partial that lives outside the served
directory.

## Check before the room sees it

```bash
npx reveal-carve check slides     # carve lint, carve fmt and the deck rules
npx reveal-carve agenda slides --budget 90
```

`check` catches a mistyped directive, which is otherwise silent: `%% note` is a
valid Carve comment, so the speaker notes simply never appear. `agenda` adds up
the `%% minutes:` in the deck and fails when the total runs past the budget.

## Build and print

```bash
npx reveal-carve build slides deck.html \
    --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js
npx reveal-carve pdf   slides deck.pdf --reveal-base vendor/reveal --css vendor/reveal-carve.css
```

The PDF is printed from a copy of the deck in Carve's static mode, so tabs, code
groups, folded details and spoilers are opened flat on the page instead of
hiding behind a click. Headless Chrome does the printing, over the DevTools
protocol, so the result is the same every run.

## Publish it

A built deck is one HTML file plus the `vendor/` directory beside it. Copy both
to any static host. Stamp the assets while building:

```bash
npx reveal-carve build slides deck.html \
    --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js \
    --version $(date +%s)
```

`--version` stamps every asset URL. Static hosts serve assets under the same
names for as long as their cache lifetime says, and without the stamp a reader
keeps the old stylesheet for ten minutes after a publish.

## Where to go next

- [Reference](reference.md) - every directive, flag, option and layout class.
- [Markdown or Carve](markdown-vs-carve.md) - the comparison, including the
  cases where Markdown is the better tool.
- The [demo site](https://markup-carve.github.io/reveal-carve/) runs the same
  source through the build step, the runtime plugin and the handout export.
