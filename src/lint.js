/**
 * Deck linting: Carve's own diagnostics plus the mistakes a deck source can make
 * that the language itself cannot see.
 *
 * The one that matters most is a mistyped directive. `%% notez` is a perfectly
 * valid Carve comment, so nothing complains - the speaker notes simply never
 * appear, and you find out while presenting.
 */

import { DEFAULTS, parseSlide } from './slice.js';

// `chapter` is not written by hand: the build step puts it at the head of every
// chapter file so an agenda can list chapters. It is linted as known all the
// same, because linting a directory means linting text the build step wrote.
export const KNOWN_DIRECTIVES = ['class', 'attr', 'notes', 'fragments', 'animate', 'minutes', 'toc', 'chapter'];

const DIRECTIVE_LINE = /^%%\s*([a-z-]+)\s*:?/i;

function slideLines(source, separator) {
    const lines = source.split('\n');
    const boundaries = [];
    let position = 0;

    for (const [index, line] of lines.entries()) {
        boundaries.push({ line: index + 1, text: line, offset: position });
        position += line.length + 1;
    }

    return { lines: boundaries, separator };
}

/**
 * @returns {Array<{level: 'error'|'warning', line: number, code: string, message: string}>}
 */
export function lintSource(source, options = {}) {
    const config = { ...DEFAULTS, ...options };
    const findings = [];
    const { lines } = slideLines(source, config.separator);

    for (const { line, text } of lines) {
        const match = text.match(DIRECTIVE_LINE);

        if (!match) {
            continue;
        }

        const name = match[1].toLowerCase();

        if (!KNOWN_DIRECTIVES.includes(name)) {
            findings.push({
                level: 'warning',
                line,
                code: 'unknown-directive',
                message: `"%% ${name}" is not a reveal-carve directive, so it stays a plain comment. `
                    + `Known: ${KNOWN_DIRECTIVES.map((known) => `%% ${known}`).join(', ')}.`,
            });
        }
    }

    const slides = source.split(new RegExp(config.separator, 'm'));

    for (const [index, chunk] of slides.entries()) {
        if (!chunk.trim()) {
            continue;
        }

        const slide = parseSlide(chunk, config);
        const number = index + 1;

        if (!/^#{1,6}\s/m.test(slide.body) && slide.body.length > 200) {
            findings.push({
                level: 'warning',
                line: 0,
                code: 'slide-without-heading',
                message: `Slide ${number} has no heading and more than 200 characters of text.`,
            });
        }

        const words = slide.body.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length;

        if (words > (config.wordBudget || 90)) {
            findings.push({
                level: 'warning',
                line: 0,
                code: 'slide-too-long',
                message: `Slide ${number} carries ${words} words of prose. Audiences read or listen, not both.`,
            });
        }

        // Only lines inside a fence count: a sentence with brackets in it is prose,
        // and an earlier heuristic that guessed from punctuation flagged exactly that.
        const fences = slide.body.match(/^([`~]{3,})[^\n]*\n([\s\S]*?)^\1[^\n]*$/gm) || [];
        const longest = fences
            .flatMap((block) => block.split('\n').slice(1, -1))
            .reduce((max, text) => Math.max(max, text.length), 0);

        if (longest > (config.codeWidth || 78)) {
            findings.push({
                level: 'warning',
                line: 0,
                code: 'code-too-wide',
                message: `Slide ${number} has a code line of ${longest} characters; it will overflow or shrink the slide.`,
            });
        }
    }

    return findings;
}

export function formatFindings(file, findings) {
    if (!findings.length) {
        return `${file}: ok`;
    }

    return findings
        .map((finding) => {
            const where = finding.line ? `${file}:${finding.line}` : file;

            return `${where}: ${finding.level}: ${finding.message} [${finding.code}]`;
        })
        .join('\n');
}
