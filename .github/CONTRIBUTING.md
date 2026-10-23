# Contributing

## Getting set up

```bash
npm install
npm test          # node --test, no runner to learn
npm run build     # dist/reveal-carve.{mjs,cjs,js}
node scripts/build-site.mjs site   # the published demo, built locally
```

## What the code is

- `src/slice.js` - pure string work: source in, slide markup out. No file system, no DOM, no Carve engine. Everything testable lives here.
- `src/plugin.js` - the browser plugin. Fetches, renders, replaces the section.
- `src/build.js`, `src/cli.js` - the Node path: chapter directories, includes, whole pages.
- `src/include.js`, `src/lint.js`, `src/handout.js`, `src/dev.js` - one job each.

The split exists so the browser and the build step never drift: both call `renderDeck` from `slice.js`.

## House rules

- **Carve sources are canonical.** Run `carve fmt --check` and `carve lint` on any `.crv` you touch, including the demos.
- **A test per behavior, not per function.** The suite is `node --test`; keep it dependency-free.
- **Comments explain why, not what.** A comment that restates the code will be removed in review.
- **American English** in identifiers, comments and documentation.
- **No machine attribution** in commits or pull requests.

## Pull requests

- One topic per pull request.
- Label it with a kind (`bug`, `enhancement`, `chore`, `documentation`) and an area (`area:plugin`, `area:build`, `area:cli`, `area:docs`, `area:tooling`).
- CI runs the suite on Node 20, 22 and 24. Green before review.
- Add a CHANGELOG entry only for user-visible changes. Test and tooling work goes in the commit message instead.

## Reporting a rendering difference

If a deck renders differently in the plugin than in the build step, that is a bug worth its own issue: those two paths sharing one implementation is the whole design. Include the source, both outputs, and the versions.
