# reveal-carve

Write reveal.js presentations in Carve. Package version 0.1.6 provides a browser plugin and a Node build command. See the [Carve documentation](https://markup-carve.github.io/carve/) for the markup language.

## Install

Install the deck tool and its runtime dependencies:

```sh
npm install @markup-carve/reveal-carve @markup-carve/carve reveal.js
```

## Usage

Create a starter deck with `npx reveal-carve init talk`.

Separate slides with `***` or `---` on its own line. Carve 0.2 writes
thematic breaks as `***` (U-044), so upgraded decks keep their slide boundaries.

## Documentation

- [Carve documentation](https://markup-carve.github.io/carve/)
- [Setup and full guide](docs/guide.md)
- [Documentation index](docs/README.md)

## License

[MIT](LICENSE)
