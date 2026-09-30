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

Only on an explicit go from the maintainer. Write the release notes as a DRAFT
release on the tag first, then push the tag:

```bash
git tag 0.1.0 && git push origin 0.1.0
```

That is the whole procedure. `.github/workflows/release.yml` does the rest,
behind the `release` environment, which needs a reviewer to approve the run.

Do NOT publish by hand. The workflow runs `npm publish` itself, so a manual
publish makes its own step fail on a version that already exists, and a manual
release creation collides with the draft the workflow is about to publish.

Before it builds anything the job refuses when the tag disagrees with
`package.json`, when the changelog has no section for the tag, or when the
release notes are missing or a stub. It publishes the release page last,
because a draft that stays a draft is recoverable and one published beside a
failed publish is not.

Watch the run to green rather than reading the releases page, and check the
registry separately: npm metadata lands before the tarball is installable, so
`npm view` can answer while `npm install` still 404s.

## Requirements, once

- `NPM_TOKEN` as a repository secret, a granular token with read and write on
  the `@markup-carve` scope.
- A `release` environment with a required reviewer.

## The first release comes before the scaffold works

`reveal-carve init --preset training` writes a `package.json` that depends on
`@markup-carve/reveal-carve`. Until the package is on npm, `npm install` in a
scaffolded deck fails - so the first publish is what makes the training starter
usable at all. Nothing else in the package depends on being published.
