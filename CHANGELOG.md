# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Runtime reveal.js plugin: a `<section data-carve="file.crv">` or an inline
  `data-template` is replaced by the slides the Carve source describes.
- Node build step and `reveal-carve` CLI for static decks, with chapter
  directories as a source.
- Slide directives `%% class:`, `%% attr:` and `%% notes`, all ordinary Carve
  comments.
- Fence attributes are moved from `<pre>` to `<code>` so reveal's stepwise line
  highlighting works on Carve code blocks.
