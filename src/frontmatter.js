import { parseDocument } from 'yaml';

export class FrontmatterError extends Error {
    constructor(message) {
        super(`reveal-carve frontmatter: ${message}`);
        this.name = 'FrontmatterError';
    }
}

function mapping(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new FrontmatterError(`${name} must be a mapping.`);
    }
}

export function readFrontmatter(source) {
    const opening = /^(?:\uFEFF)?---(?: ?([a-zA-Z0-9]+))?[ \t]*\r?\n/.exec(source);
    if (!opening) return { source, options: {} };
    const rest = source.slice(opening[0].length);
    const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
    // An unmatched leading separator is a slide boundary, not metadata.
    if (!closing) return { source, options: {} };
    const format = opening[1] || 'yaml';
    const text = rest.slice(0, closing.index);
    let data;
    try {
        if (format === 'json') {
            data = text.trim() ? JSON.parse(text) : {};
        } else if (format === 'yaml') {
            const doc = parseDocument(text, { schema: 'core', uniqueKeys: true });
            if (doc.errors.length || doc.warnings.length) {
                throw new Error([...doc.errors, ...doc.warnings].map((item) => item.message).join('\n'));
            }
            data = doc.toJS({ maxAliasCount: 50 });
            if (data == null && text.trim()) {
                throw new Error('the opening --- block contains only comments. Remove the leading separator if this is slide content, or use an empty metadata mapping ({}).');
            }
            data ??= {};
        } else {
            throw new Error(`unsupported format "${format}"; use YAML or JSON.`);
        }
    } catch (error) {
        throw new FrontmatterError(error.message);
    }
    mapping(data, 'metadata');
    const options = {};
    for (const key of ['title', 'lang']) {
        if (Object.hasOwn(data, key)) {
            if (typeof data[key] !== 'string' || !data[key].trim()) {
                throw new FrontmatterError(`${key} must be a nonempty string.`);
            }
            options[key] = data[key];
        }
    }
    if (Object.hasOwn(data, 'reveal')) {
        mapping(data.reveal, 'reveal');
        for (const key of Object.keys(data.reveal)) {
            if (!['theme', 'darkTheme', 'renderers'].includes(key)) {
                throw new FrontmatterError(`unknown reveal setting "${key}".`);
            }
            const value = data.reveal[key];
            if (key === 'renderers') {
                if (!Array.isArray(value) || value.some((name) => !['mermaid', 'katex'].includes(name))) {
                    throw new FrontmatterError('reveal.renderers must be a list of mermaid and/or katex.');
                }
                options.renderers = [...new Set(value)];
            } else {
                if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) {
                    throw new FrontmatterError(`reveal.${key} must be a theme name, not a path.`);
                }
                options[key] = value;
            }
        }
    }
    return { source: rest.slice(closing.index + closing[0].length), options };
}

export function mergeDeckOptions(metadata, explicit) {
    return { ...metadata, ...Object.fromEntries(Object.entries(explicit).filter(([, value]) => value !== undefined)) };
}
