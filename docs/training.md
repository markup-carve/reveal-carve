# Training starter

Create a workshop with local diagram and formula rendering:

```bash
npx reveal-carve init workshop --preset training
cd workshop
npm install
npm start
```

Open <http://localhost:8800>. The starter includes a 30-minute lesson about
planning a workshop. Edit the files under `slides/` to replace it with your
content. `deck.crv` includes those chapters and holds the title, language,
themes and renderer list. Shared slides belong in `slides/partials/`.

## Commands

| Command | Result |
|---|---|
| `npm start` | Preview with reload on save |
| `npm run build` | `index.html` and local assets in `vendor/` |
| `npm run pdf` | `handout.pdf`, including exercise solutions |
| `npm run handout` | `handout.md`, including speaker notes |
| `npm run agenda` | Planned durations by slide |
| `npm run check` | Source formatting, syntax and deck checks |

Install dependencies once. Preview, build and export then work without a
network connection. Share `index.html` together with `vendor/`. PDF export
requires Chrome or Chromium and Node 22 or later; `CHROME_PATH` selects a browser.
The PDF contains slides. Speaker notes go into the Markdown handout.

## Layouts

Set `%% class: layout-title` on an opening slide or `%% class: layout-section`
on a chapter divider. Both use the current theme's colors. The corner button
switches between light and dark styles.

For a comparison, put `before` and `after` containers inside a `two-col`
container. For code beside prose, put `code` and `explanation` containers
inside `layout-code`. The example chapter contains both forms. The `exercise`
slide class uses the existing exercise styling; advancing to the next slide
reveals the solution.

## Existing decks

```bash
npm install mermaid katex
npx reveal-carve build slides deck.html --with mermaid,katex
```

`--with` enables the matching Carve extensions, copies installed renderer assets
into `vendor/` beside the output, and configures initialization. It also works
with `watch` and with `pdf` when the input is Carve source. Source PDF export
uses `vendor/` in the current directory. Select only Mermaid
or KaTeX with `--with mermaid` or `--with katex`. The training preset requires
both because its example uses both.

Mermaid diagrams render in a visible scratch element, so slides that are hidden
at startup still get measured. Diagrams keep a white background in both themes. Rendering and font loading finish before Reveal
creates the print layout. A renderer failure appears on the page and fails PDF
export. Missing packages produce an `npm install` command.

Use `--extension` with your own `--js` and `--css` assets for custom renderer
configuration. Do not also select that renderer with `--with`. The managed setup
currently covers Mermaid and KaTeX in built pages; it does not change the
standalone runtime plugin.
