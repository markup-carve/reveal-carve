/**
 * Carve source to Markdown, for handouts and the generated docs.
 *
 * Carve 0.2 writes Markdown through its writer registry, with the writer from the
 * engine's export entry. That writer has not shipped yet (markup-carve/carve-js#5076),
 * so until it does this throws a `MarkdownWriterUnavailableError` that says so.
 */

export class MarkdownWriterUnavailableError extends Error {
    constructor() {
        super(
            'reveal-carve: the Carve 0.2 Markdown writer is not available yet (markup-carve/carve-js#5076); '
            + 'handouts and the generated docs are written in Markdown, so they wait for it',
        );
        this.name = 'MarkdownWriterUnavailableError';
        this.code = 'writer-unavailable';
    }
}

/**
 * @param {object} engine The Carve 0.2 module
 * @returns {Promise<((text: string) => string) | null>} a writer, or null while the engine has none
 */
export async function findMarkdownWriter(engine) {
    if (typeof engine?.createWriterRegistry !== 'function') {
        return null;
    }

    const registry = engine.createWriterRegistry();

    if (!registry.has('markdown')) {
        try {
            (await import('@markup-carve/carve/export')).registerExports?.(registry);
        } catch {
            // This engine build has no export entry.
        }
    }

    return registry.has('markdown') ? (text) => registry.write('markdown', engine.parse(text)).output : null;
}

/**
 * @param {object} engine The Carve 0.2 module
 * @returns {Promise<(text: string) => string>}
 */
export async function markdownWriter(engine) {
    const writer = await findMarkdownWriter(engine);

    if (!writer) {
        throw new MarkdownWriterUnavailableError();
    }

    return writer;
}
