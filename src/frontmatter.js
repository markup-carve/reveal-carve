/**
 * Deck frontmatter: the settings a source carries about itself.
 *
 * Parsed here with a real YAML library, which is why this module is node-only.
 * The browser path uses `frontmatter-split.js`, which finds the block and reads
 * the one setting a built page can still act on.
 */

import { parseDocument } from 'yaml';

import { splitFrontmatter } from './frontmatter-split.js';

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
    const { block: text, format, source: body } = splitFrontmatter(source);

    if (text === null) {
        return { source, options: {} };
    }

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

    return { source: body, options };
}

export function mergeDeckOptions(metadata, explicit) {
    return { ...metadata, ...Object.fromEntries(Object.entries(explicit).filter(([, value]) => value !== undefined)) };
}
