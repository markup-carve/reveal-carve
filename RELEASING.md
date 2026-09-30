# Releasing

The version stays **0.1.0** until the first release: nothing has been published,
so no commit bumps it. Releasing is the maintainer's call, and it is public
within minutes - Packagist-style registries index a tag on their own.

## Before tagging

1. `npm run lint && npm test` - clean on Node 20, 22 and 24 in CI.
2. `npm run build && node scripts/build-site.mjs site`
3. `node scripts/check-decks.mjs site` - every deck, on screen, in print layout
   and in the dark theme.
4. `node scripts/check-pdf.mjs site` - page and line counts against the stored
   numbers.
5. `npm run docs` - the Markdown beside each Carve doc is current.
6. `npm pack --dry-run` - `dist/`, `src/`, `types/`, the three Markdown files,
   and nothing else.
7. Install the tarball into an empty project and run the scaffold end to end:

   ```bash
   npm pack
   mkdir /tmp/deck && cd /tmp/deck && npm init -y
   npm install /path/to/markup-carve-reveal-carve-0.1.0.tgz @markup-carve/carve reveal.js
   npx reveal-carve init talk && cd talk
   npx reveal-carve vendor vendor
   npx reveal-carve build slides talk.html --title talk \
       --reveal-base vendor/reveal --css vendor/reveal-carve.css --js vendor/reveal-carve.js
   ```

8. Move the `[Unreleased]` section of the CHANGELOG under the version heading,
   and leave a fresh `[Unreleased]` above it.

## Tagging

Only on an explicit go from the maintainer:

```bash
npm publish --access public
git tag 0.1.0 && git push origin 0.1.0
gh release create 0.1.0 --notes-file <(sed -n '/## \[0.1.0\]/,/## \[/p' CHANGELOG.md)
```

A published tag with no release object is an empty releases page, so the release
is part of the release, not a follow-up.

## The first release comes before the scaffold works

`reveal-carve init --preset training` writes a `package.json` that depends on
`@markup-carve/reveal-carve`. Until the package is on npm, `npm install` in a
scaffolded deck fails - so the first publish is what makes the training starter
usable at all. Nothing else in the package depends on being published.
