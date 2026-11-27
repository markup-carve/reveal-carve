# reveal-carve

Write reveal.js presentations in Carve. Package version 0.2.0 provides a browser plugin and a Node build command. See the [Carve documentation](https://markup-carve.github.io/carve/) for the markup language.

## Install

Install the deck tool and its runtime dependencies:

```sh
npm install @markup-carve/reveal-carve@^0.2 @markup-carve/carve@^0.2 reveal.js
```

The build command needs Node.js 20 or newer; PDF export needs Node.js 22. It needs the Carve 0.2 engine (`@markup-carve/carve` 0.2).

## Usage

Create a starter deck with `npx reveal-carve init talk`.

Separate slides with `***` or `---` on its own line. Carve 0.2 writes
thematic breaks as `***` (U-044), so upgraded decks keep their slide boundaries.

Upgrade a Carve 0.1 deck and its includes with
`npx reveal-carve upgrade slides/ --write`; it keeps the `---` separators as written.

## Documentation

- [Carve documentation](https://markup-carve.github.io/carve/)
- [Setup and full guide](docs/guide.md)
- [Documentation index](docs/README.md)

## License

[MIT](LICENSE)
