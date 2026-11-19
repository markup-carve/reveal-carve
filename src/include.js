/**
 * Include resolution for deck sources.
 *
 * `{{ path }}` is Carve syntax, and the engine resolves it only when the parse
 * is given an include resolver, because reading files a document names is a
 * trust boundary. Decks are sliced into slides before they are rendered, so the
 * expansion is a separate pass over the source text.
 *
 * This module drives that pass with the engine's own filesystem resolver, which
 * brings root containment, a byte budget, a depth limit and a dependency list.
 * A build knows from `dependencies` exactly which files a deck was made of,
 * which is what watch mode needs.
 */

const DIRECTIVE = /^[ \t]*\{\{\s*[^}\n]+?\s*\}\}[ \t]*$/m;

export class IncludeError extends Error {}

export function hasIncludes(source) {
    return DIRECTIVE.test(source);
}

/**
 * @param {string} source Carve source text
 * @param {object} options
 * @param {string} options.from Path of the file the source came from
 * @param {string} [options.root] Directory includes may not escape, defaults to `from`'s directory
 * @param {object} options.engine The Carve 0.2 module (`parseWithDiagnostics`, `write`, `stringOffsetOfByte`)
 * @param {Function} options.resolver `fileSystemResolver` from `@markup-carve/carve/node`
 * @returns {{ source: string, dependencies: Array<object>, warnings: Array<object> }}
 */
export function expandIncludes(source, { from, root, engine, resolver, maxDepth } = {}) {
    if (!engine?.parseWithDiagnostics || !engine?.write || !engine?.stringOffsetOfByte) {
        throw new IncludeError(
            'reveal-carve: this Carve engine cannot expand includes. Pass --no-includes, '
            + 'or use the Carve 0.2 engine.',
        );
    }

    const base = root || dirnameOf(from);
    const answered = new Map();
    const inner = resolver(base);
    // The text each include answered, so a whole-file include is spliced in as written:
    // the deck's `---` slide separators are text in Carve 0.2 and must reach the slicer as they are.
    const recording = (request) => {
        const answer = inner(request);

        if (answer && answer.text !== undefined) {
            answered.set(answer.id, typeof answer.text === 'string' ? answer.text : new TextDecoder().decode(answer.text));
        }

        return answer;
    };
    const dependencies = [];
    const warnings = [];
    const limit = maxDepth || 16;

    const expand = (text, file, depth) => {
        const parsed = engine.parseWithDiagnostics(text, {
            includes: { resolver: recording, ...(file ? { file } : {}), ...(maxDepth ? { depth: maxDepth } : {}) },
            positions: true,
        });
        const failed = parsed.diagnostics.filter((d) => /^include-/.test(d.code) && d.severity === 'error');
        const missing = parsed.diagnostics.filter((d) => /^include-(not-found|outside-root|unreadable|non-text)$/.test(d.code));

        if (missing.length || failed.length) {
            const nameOf = (d) => nodeAt(parsed.document, d.path)?.path ?? d.message;
            const names = [...new Set([...missing, ...failed].map(nameOf))];

            throw new IncludeError(`include could not be resolved: ${names.join(', ')}`);
        }

        warnings.push(...parsed.diagnostics.filter((d) => /^include-/.test(d.code)));
        const top = parsed.document.children.filter((node) => node.type === 'include' && node.children && node.pos);
        let out = '';
        let at = 0;

        for (const node of top) {
            const start = engine.stringOffsetOfByte(text, node.pos.startOffset);
            const end = engine.stringOffsetOfByte(text, node.pos.endOffset);
            const whole = !node.options || Object.keys(node.options).length === 0;
            let replacement;

            dependencies.push({ id: resolvePath(base, node.file), path: node.path, resolved: true });

            if (whole && answered.has(node.file) && depth < limit) {
                replacement = expand(answered.get(node.file), node.file, depth + 1).replace(/\n+$/, '');
            } else {
                replacement = engine.write({ ...parsed.document, children: node.children }).replace(/\n+$/, '');
            }

            out += text.slice(at, start) + replacement;
            at = end;
        }

        out += text.slice(at);

        // An included file's own frontmatter configures nothing: only the entry source owns deck settings.
        const head = parsed.document.children[0];

        if (depth > 0 && head?.type === 'frontmatter' && head.pos) {
            const cut = engine.stringOffsetOfByte(text, head.pos.endOffset);

            return out.slice(cut).replace(/^\r?\n/, '');
        }

        return out;
    };

    return { source: expand(source, relativeTo(base, from), 0), dependencies, warnings };
}

/** The node an RFC 6901 pointer names. */
function nodeAt(document, pointer) {
    let node = document;

    for (const step of String(pointer || '').split('/').slice(1)) {
        node = node?.[step.replaceAll('~1', '/').replaceAll('~0', '~')];
    }

    return node;
}

function resolvePath(base, file) {
    if (!file) {
        return file;
    }

    return file.startsWith('/') ? file : `${base.replace(/\/+$/, '')}/${file}`;
}

function relativeTo(base, file) {
    const prefix = `${String(base).replace(/\/+$/, '')}/`;

    return String(file).startsWith(prefix) ? String(file).slice(prefix.length) : undefined;
}

function dirnameOf(path) {
    const cut = String(path).lastIndexOf('/');

    return cut === -1 ? '.' : path.slice(0, cut);
}
