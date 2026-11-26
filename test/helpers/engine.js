/**
 * The Carve 0.2 engine as the CLI loads it: the core entry, the standard extensions and the
 * Markdown importer, which live in entries of their own.
 */
import * as core from '@markup-carve/carve';
import * as standard from '@markup-carve/carve/extensions';
import * as formats from '@markup-carve/carve/import';

export const carve = { ...standard, ...core, ...formats };
