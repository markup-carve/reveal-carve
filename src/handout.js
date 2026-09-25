/**
 * Handout export: the same deck source as a readable document.
 *
 * Attendees ask for the slides, and slides are a bad document - the speaker
 * notes carry what was actually said. This joins body and notes per slide and
 * renders through Carve's Markdown writer.
 */

import { DEFAULTS, parseSlide } from './slice.js';

/**
 * @param {string} source Carve source of a whole deck
 * @param {(text: string) => string} toMarkdown Carve's Markdown renderer
 * @param {object} [options]
 * @param {boolean} [options.notes] Include speaker notes, default true
 * @param {string} [options.notesLabel] Prefix for the notes block
 */
export function buildHandout(source, toMarkdown, options = {}) {
    const config = { ...DEFAULTS, ...options };
    const includeNotes = config.notes !== false;
    const label = config.notesLabel || '**Spoken:**';
    const vertical = new RegExp(config.verticalSeparator, 'm');

    const slides = source
        .split(new RegExp(config.separator, 'm'))
        .flatMap((chunk) => chunk.split(vertical))
        .filter((chunk) => chunk.trim());

    return slides
        .map((chunk) => {
            const slide = parseSlide(chunk, config);
            const parts = [];

            if (slide.body) {
                parts.push(toMarkdown(slide.body).trim());
            }

            if (includeNotes && slide.notes) {
                const notes = toMarkdown(slide.notes)
                    .trim()
                    .split('\n')
                    .map((line) => (line ? `> ${line}` : '>'))
                    .join('\n');

                parts.push(`${label}\n\n${notes}`);
            }

            return parts.join('\n\n');
        })
        .filter(Boolean)
        .join('\n\n---\n\n')
        .concat('\n');
}
