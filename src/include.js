/**
 * Include resolution for deck sources.
 *
 * `{{ path }}` is Carve syntax, and the engine resolves it - but not while
 * rendering: `carveToHtml()` leaves the directive as text. The expansion is a
 * separate pass, `expandIncludes()`, with a resolver the host provides. That is
 * deliberate, because reading files a document names is a trust boundary.
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
 * @param {object} options.engine The Carve module (`carveToHtml`, `parse`, `expandIncludes`)
 * @param {Function} options.resolver `fileSystemResolver` from `@markup-carve/carve/node`
 * @returns {{ source: string, dependencies: Array<object>, warnings: Array<object> }}
 */
export function expandIncludes(source, { from, root, engine, resolver, maxDepth } = {}) {
    if (!engine?.expandIncludes || !engine?.parse || !engine?.renderCarve) {
        throw new IncludeError(
            'reveal-carve: this Carve engine cannot expand includes. Pass --no-includes, '
            + 'or upgrade @markup-carve/carve.',
        );
    }

    const base = root || dirnameOf(from);
    const expanded = engine.expandIncludes(engine.parse(source), source, {
        resolve: resolver(base),
        sourcePath: from,
        ...(maxDepth ? { maxDepth } : {}),
    });

    const unresolved = (expanded.dependencies || []).filter((entry) => !entry.resolved);

    if (unresolved.length) {
        throw new IncludeError(
            `include could not be resolved: ${unresolved.map((entry) => entry.id).join(', ')}`,
        );
    }

    return {
        source: engine.renderCarve(expanded.doc),
        dependencies: expanded.dependencies || [],
        warnings: expanded.warnings || [],
    };
}

function dirnameOf(path) {
    const cut = String(path).lastIndexOf('/');

    return cut === -1 ? '.' : path.slice(0, cut);
}
