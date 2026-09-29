# Printing and publishing

Getting a deck off your machine: a PDF handout, a published page whose assets are not stale, and a copy that needs no network in the room.

### PDF export

```bash
reveal-carve pdf slides/deck.crv deck.pdf
```

Given a Carve source rather than an HTML file, the PDF is built from a print copy
of the deck in Carve's static mode. That matters for anything interactive: a tab
group on screen shows one panel at a time, and printing the live deck would put
only that panel on the page. In static mode the panels unfold into sections with
their labels as headings, so the handout carries all of them. Code groups behave
the same way.

An overlong slide runs onto a second page rather than being cut, and code wraps
instead of leaving the paper.

Printing an HTML deck directly also works, and prints exactly what is on screen:

```bash
reveal-carve pdf deck.html deck.pdf
```

The export drives Chrome over the DevTools protocol and waits for reveal's print
layout to exist. Chrome's own `--print-to-pdf` flag prints when its timer runs
out, which produced a blank one-page PDF for a deck that had printed twelve pages
a minute earlier, from the same file.

### Publishing an updated deck

A static host serves a deck's files under the same names with a cache lifetime of
its own; GitHub Pages sends `max-age=600`. Until that expires the browser keeps
the old stylesheet and the old bundle, and the reader has to hard-refresh to see
your change.

Pass `version` (or `--version`) and every local asset URL gets that marker, so a
new build is a new URL:

```bash
reveal-carve build slides/ deck.html --version $(git rev-parse --short HEAD)
```

The HTML page itself still follows the host's cache rules, which on GitHub Pages
means up to ten minutes. Nothing a deck can do changes that.

### Offline decks

A deck presented in a room with no wifi cannot load renderers from a CDN. Vendor
them next to the deck and point `--js` at the local copies:

```bash
npm install mermaid chart.js katex
mkdir -p deck/vendor
cp node_modules/mermaid/dist/mermaid.min.js deck/vendor/
cp node_modules/chart.js/dist/chart.umd.js deck/vendor/
cp -r node_modules/katex/dist deck/vendor/katex

reveal-carve build slides/ deck/index.html \
    --reveal-base vendor/reveal \
    --js vendor/mermaid.min.js --js vendor/chart.umd.js \
    --js vendor/katex/katex.min.js --css vendor/katex/katex.min.css
```

Everything else - reveal, the Carve engine, the plugin - is already local when it
comes from `node_modules`. The SVG fence needs nothing at all: the image is
inlined as a data URI.
