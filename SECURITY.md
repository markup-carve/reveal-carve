# Security

## Reporting

Report a vulnerability through GitHub's private advisory form on this repository
("Security" tab, "Report a vulnerability"). Please do not open a public issue for
anything exploitable.

## What this package treats as a trust boundary

- **Rendered HTML.** Carve can emit raw HTML from a source document. A deck built
  from a source you do not control is as trusted as that source. Use the Carve
  engine's own `--safe` / `noRaw` option when rendering untrusted input.
- **Includes.** `{{ path }}` reads files named by the document. Resolution refuses
  to leave the root directory and refuses cycles, and includes can be switched off
  entirely with `--no-includes`. The root defaults to the deck's own directory.
- **The development server.** `reveal-carve watch` serves the output directory on
  localhost with no authentication. It is a writing tool, not a deployment target.

## Supported versions

While the package is below 1.0, fixes land on the current minor only.
