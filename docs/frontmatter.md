<!-- Generated from docs/frontmatter.crv by scripts/build-docs.mjs. Edit that file. -->

# Deck frontmatter

A single entry file can hold the settings needed to render a deck. Metadata is
removed before slide splitting, so its fences do not become slide boundaries.

```carve
---
title: Planning a workshop
lang: en
reveal:
  theme: white
  darkTheme: black
  renderers:
    - mermaid
    - katex
---

# Planning a workshop

Make time for practice.
```

## Settings

| Setting | Meaning |
| --- | --- |
| `title` | HTML document title; it does not insert a heading |
| `lang` | Language of the generated HTML document |
| `reveal.theme` | Reveal theme name, such as `white` |
| `reveal.darkTheme` | Second theme name, such as `black`, with a theme switch |
| `reveal.renderers` | List containing `mermaid`, `katex`, or both; `[]` disables them |

Theme values are names, not paths. Title and language must be nonempty strings.
Unknown settings inside `reveal` are errors. Other top-level metadata, such as
an author or description, is accepted but has no effect on the deck.

YAML is the default. `---yaml` and `--- yaml` also work. JSON uses `---json`
and a JSON object between the fences. Other formats are rejected. Duplicate
YAML keys, unsupported tags and malformed settings are errors even when an
explicit option would override them. Metadata must start at the beginning of
the file; an unclosed fence is treated as ordinary source, as in Carve. A block
containing only YAML comments is rejected because slide headings can look like
comments. Remove the opening separator if the block is slide content.

## Overrides and commands

Explicit CLI or API options override metadata, which overrides defaults. Lists
replace rather than append: `--with katex` replaces a declared renderer list,
and `--no-renderers` clears it. Existing extension flags still control Carve
extensions independently.

```bash
reveal-carve build deck.crv deck.html --title "Workshop handout"
reveal-carve watch deck.crv deck.html
reveal-carve pdf deck.crv deck.pdf
reveal-carve handout deck.crv handout.md
reveal-carve agenda deck.crv
reveal-carve check deck.crv
```

Build, watch and source PDF use the entry settings. Watch re-reads metadata and
resolves extensions on each rebuild, including when a setting is removed.
Handouts and agendas exclude metadata from the content. Printing an existing
HTML file uses that file’s already-built settings.

Renderer declarations enable the matching extensions and copy installed assets
for built pages. They do not install packages. Install `mermaid` and `katex` in
the project if the deck needs them. Asset paths, custom CSS/JS, output filenames
and server ports remain CLI/API options. Dark theme helpers still need
`--dark-css` when custom helpers are used.

## Chapters

Directory sources retain their existing behavior. They cannot supply deck-wide
settings through a chapter’s frontmatter. Directory lint and check validate each
file independently. For rendering, use one entry file instead:

```carve
---
title: Workshop
reveal:
  renderers: [mermaid]
---

{{ slides/010-opening.crv }}

---

{{ slides/020-explain.crv }}
```

Only the entry file supplies global settings. Metadata in included files cannot
override it. Per-slide frontmatter is not supported; use the existing slide
directives for classes, notes and timing. The training starter uses this entry
file structure while keeping its asset paths and commands in `deck.mjs`.

## Browser plugin and JavaScript API

The browser plugin removes frontmatter from each loaded Carve source. Its host
page keeps control of the document title, language and theme stylesheets; those
metadata fields do not change the page.

Renderer declarations enable the corresponding Carve extensions and use Mermaid
or KaTeX already loaded by the host. The host must also load KaTeX CSS and fonts.
Missing libraries fail initialization with a visible renderer error. Explicit
`carve.renderers` in the plugin configuration overrides source declarations,
including `[]` to disable them. Custom `carve.render` callbacks still own how
the source is rendered.

`buildPage` merges entry settings with its explicit options and prepares managed
renderer assets. Its supplied `render` callback remains responsible for Carve
extension selection. `readDeckSource` from the build module returns
`{ source, options }`, with expanded content and validated entry options, for
callers that need to configure their renderer first. `readSource` returns just
the expanded content. Low-level slide and handout renderers consume frontmatter
but do not configure the caller’s renderer.
