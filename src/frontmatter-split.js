/**
 * Finding a frontmatter block, without parsing it.
 *
 * The parser lives in `frontmatter.js` and pulls in a YAML library, which has no
 * business in a browser bundle: at runtime the only setting that can still apply
 * is the renderer list, and the page is already built. This module holds the
 * string work both paths share, so the plugin can read that one setting without
 * the parser.
 */

/** A line that opens a mapping: `key:` or `key: value`. */
const MAPPING_LINE = /^[A-Za-z_][\w-]*[ \t]*:(?:[ \t]|$)/;

/**
 * Whether a block reads as metadata rather than as the first slide.
 *
 * `---` on its own line is also how a deck starts a slide, and a deck whose
 * first line is a separator was valid long before frontmatter existed. Such a
 * block is handed back as content: YAML would read `# Title` as a comment and
 * fail the build over a heading.
 */
function looksLikeMetadata(text, format, tagged) {
    if (tagged) {
        return true;
    }

    if (format === 'json') {
        return text.trim().startsWith('{');
    }

    return text
        .split('\n')
        .some((line) => !line.trim().startsWith('#') && MAPPING_LINE.test(line.trim()));
}

/**
 * Split a source into its frontmatter block and the deck below it.
 *
 * @param {string} source
 * @returns {{block: string|null, format: string, source: string}} `block` is
 *   null when the source carries no frontmatter, and `source` is then unchanged.
 */
export function splitFrontmatter(source) {
    const opening = /^(?:\uFEFF)?---(?: ?([a-zA-Z0-9]+))?[ \t]*\r?\n/.exec(source);

    if (!opening) {
        return { block: null, format: 'yaml', source };
    }

    const rest = source.slice(opening[0].length);
    const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);

    // An unmatched leading separator is a slide boundary, not metadata.
    if (!closing) {
        return { block: null, format: 'yaml', source };
    }

    const format = opening[1] || 'yaml';
    const text = rest.slice(0, closing.index);

    if (!looksLikeMetadata(text, format, Boolean(opening[1]))) {
        return { block: null, format, source };
    }

    return {
        block: text,
        format,
        source: rest.slice(closing.index + closing[0].length),
    };
}

/**
 * The renderer list, read without a YAML parser.
 *
 * This is everything the runtime path can still act on - a page that already
 * exists has its title, language and theme - so the browser bundle needs no
 * more than this. Anything malformed is ignored here and reported by the build
 * step, which does parse the block properly.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function readRenderers(source) {
    const { block, format } = splitFrontmatter(source);

    if (!block) {
        return [];
    }

    if (format === 'json') {
        try {
            const data = JSON.parse(block);

            return [...new Set(data?.reveal?.renderers || [])];
        } catch {
            return [];
        }
    }

    const reveal = /^reveal[ \t]*:[ \t]*$/m.exec(block);

    if (!reveal) {
        return [];
    }

    // The block under `reveal:`, up to the next line that starts at column one.
    const body = block.slice(reveal.index + reveal[0].length).split('\n');
    const indented = [];

    for (const line of body) {
        if (line.trim() && !/^\s/.test(line)) {
            break;
        }

        indented.push(line);
    }

    const inline = /^\s*renderers[ \t]*:[ \t]*\[([^\]]*)\]/m.exec(indented.join('\n'));

    if (inline) {
        return [...new Set(inline[1].split(',').map((name) => name.trim().replace(/['"]/g, '')).filter(Boolean))];
    }

    const list = /^(\s*)renderers[ \t]*:[ \t]*$/m.exec(indented.join('\n'));

    if (!list) {
        return [];
    }

    const after = indented.join('\n').slice(list.index + list[0].length).split('\n');
    const names = [];

    for (const line of after) {
        const item = /^\s*-[ \t]*(.+?)[ \t]*$/.exec(line);

        if (!item) {
            if (line.trim()) {
                break;
            }

            continue;
        }

        names.push(item[1].replace(/['"]/g, ''));
    }

    return [...new Set(names)];
}
