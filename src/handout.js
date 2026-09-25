/**
 * Handout export: the same deck source as a readable document.
 *
 * Attendees ask for the slides, and slides are a bad document - the speaker
 * notes carry what was actually said. This joins body and notes per slide and
 * renders through Carve's Markdown writer.
 */

import { asListItemText, chapterTitles, DEFAULTS, deckMinutes, parseSlide } from './slice.js';

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

    // `%% toc` fills a slide in the deck; in a document the same directive has to
    // produce the list itself, or the handout carries an empty Agenda heading.
    const plan = deckMinutes(source, config);
    const titles = chapterTitles(slides);

    const entry = (text, minutes) => `- ${asListItemText(text)}${minutes ? ` (${minutes} min)` : ''}`;

    const slideAgenda = (index) => plan.slides
        .filter((slide, position) => slide.heading && position !== index)
        .map((slide) => entry(slide.heading, slide.minutes));

    // `%% toc: chapters` lists the chapter files, the way the deck does, so the
    // handout and the screen agree on what the agenda says.
    const chapterAgendaList = (index) => {
        const totals = new Map();

        slides.forEach((chunk, position) => {
            const title = titles.get(position);

            if (!title || position === index) {
                return;
            }

            totals.set(title, (totals.get(title) || 0) + parseSlide(chunk, config).minutes);
        });

        return [...totals].map(([title, minutes]) => entry(title, minutes));
    };

    const agenda = (index, mode) => (mode === 'chapters' ? chapterAgendaList(index) : slideAgenda(index)).join('\n');

    return slides
        .map((chunk, index) => {
            const slide = parseSlide(chunk, config);
            const parts = [];

            if (slide.body) {
                parts.push(toMarkdown(slide.body).trim());
            }

            if (slide.toc) {
                const list = agenda(index, slide.tocMode);

                if (list) {
                    parts.push(list);
                }
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
