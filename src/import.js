/**
 * Convert a reveal.js Markdown deck into a Carve deck source.
 *
 * Each slide is converted on its own, so a construct can never run across a
 * slide boundary, and the separators are written back in the form this
 * package splits on. The defaults match reveal.js's Markdown plugin, with
 * `--` as the vertical separator most decks configure.
 */

import { DEFAULTS } from './slice.js';

export const MARKDOWN_DEFAULTS = {
    separator: '\\r?\\n---\\r?\\n',
    verticalSeparator: '\\r?\\n--\\r?\\n',
    notesSeparator: '^\\s*notes?:',
};

const FENCE = /^(`{3,}|~{3,})(.*)$/;
const LINE_STEPS = /^(\s*\S*)\s*\[([^\]]*)\]\s*$/;
const SLIDE_COMMENT = /<!--\s*\.slide:\s*([\s\S]*?)\s*-->[ \t]*\r?\n?/g;
const ELEMENT_COMMENT = /<!--\s*\.element:/;

/**
 * @param {string} markdown The deck's Markdown source
 * @param {object} options
 * @param {object} options.engine The Carve module (`markdownToCarve`)
 * @param {string} [options.separator] Horizontal slide separator, as a regular expression
 * @param {string|null} [options.verticalSeparator] Vertical slide separator; `null` for none
 * @param {string} [options.notesSeparator] Start of the speaker notes, matched case-insensitively
 * @returns {{ source: string, slides: number, warnings: string[] }}
 */
export function importMarkdownDeck(markdown, { engine, ...options } = {}) {
    if (typeof engine?.markdownToCarve !== 'function') {
        throw new Error('reveal-carve: this Carve engine has no markdownToCarve. Upgrade @markup-carve/carve.');
    }

    const config = { ...MARKDOWN_DEFAULTS, ...options };
    const horizontal = new RegExp(config.separator, 'm');
    const vertical = config.verticalSeparator ? new RegExp(config.verticalSeparator, 'm') : null;
    const warnings = [];
    let count = 0;

    const stacks = markdown.replace(/^\uFEFF/, '').split(horizontal).map((stack) => {
        // An empty chunk (a deck opening with a separator) would leave a leading
        // `---` that reads as frontmatter, so it is dropped.
        const slides = (vertical ? stack.split(vertical) : [stack])
            .filter((slide) => slide.trim())
            .map((slide) => {
                count += 1;

                return convertSlide(slide, count, config, engine, warnings);
            });

        return slides.join('\n\n--\n\n');
    }).filter(Boolean);

    return { source: `${stacks.join('\n\n---\n\n')}\n`, slides: count, warnings };
}

function convertSlide(markdown, number, config, engine, warnings) {
    const attributes = [];
    const withoutSlideComments = markdown.replace(SLIDE_COMMENT, (match, attrs) => {
        attributes.push(attrs.trim());

        return '';
    });

    if (ELEMENT_COMMENT.test(withoutSlideComments)) {
        warnings.push(
            `slide ${number}: a .element comment stays an HTML comment; move it to a Carve attribute such as {.fragment}`,
        );
    }

    const [body, notesText] = splitNotes(withoutSlideComments, new RegExp(config.notesSeparator, 'i'));
    const parts = [];

    if (attributes.length) {
        parts.push(`%% attr: ${attributes.join(' ')}`);
    }

    parts.push(convertBlock(body, number, engine, warnings));

    if (notesText) {
        parts.push(`%% notes\n\n${convertBlock(notesText, number, engine, warnings)}`);
    }

    return parts.filter(Boolean).join('\n\n');
}

/**
 * Split at the first notes separator outside a fenced block, so a `Note:` line
 * in a code sample stays code.
 */
function splitNotes(markdown, separator) {
    const lines = markdown.split('\n');
    const fenced = fencedLines(lines);
    const at = lines.findIndex((line, index) => !fenced.has(index) && separator.test(line));

    if (at === -1) {
        return [markdown, ''];
    }

    const rest = lines[at].replace(separator, '');

    return [lines.slice(0, at).join('\n'), [rest, ...lines.slice(at + 1)].join('\n').trim()];
}

/** Indices of lines inside a column-0 fence, its delimiters included. */
function fencedLines(lines) {
    const inside = new Set();
    let open = null;

    lines.forEach((line, index) => {
        const match = FENCE.exec(line);

        if (open) {
            inside.add(index);

            if (match && match[1][0] === open[0] && match[1].length >= open.length && !match[2].trim()) {
                open = null;
            }
        } else if (match) {
            open = match[1];
            inside.add(index);
        }
    });

    return inside;
}

/**
 * Column-0 fence openers, in order, skipping fence content.
 * @returns {Array<{ line: number, info: string }>}
 */
function topLevelFences(lines) {
    const openers = [];
    let open = null;

    lines.forEach((line, index) => {
        const match = FENCE.exec(line);

        if (!match) {
            return;
        }

        if (open) {
            if (match[1][0] === open[0] && match[1].length >= open.length && !match[2].trim()) {
                open = null;
            }

            return;
        }

        open = match[1];
        openers.push({ line: index, info: match[2] });
    });

    return openers;
}

/**
 * The Markdown plugin reads line steps from the info string (`js [1-3|5]`);
 * here they are a `data-line-numbers` attribute line above the fence.
 */
function moveLineSteps(markdownLines, carve, number, warnings) {
    const steps = topLevelFences(markdownLines).map(({ info }) => LINE_STEPS.exec(info)?.[2]);
    const nested = markdownLines.some((line) => /^[ \t]+(`{3,}|~{3,})/.test(line) && LINE_STEPS.test(line.trim().replace(/^(`+|~+)/, '')));

    const dropped = `slide ${number}: line highlights on a code fence were dropped; add a {data-line-numbers} attribute line`;

    if (nested) {
        warnings.push(dropped);
    }

    if (!steps.some(Boolean)) {
        return carve;
    }

    const lines = carve.split('\n');
    const fences = topLevelFences(lines);

    if (fences.length !== steps.length) {
        if (!nested) {
            warnings.push(dropped);
        }

        return carve;
    }

    for (let index = fences.length - 1; index >= 0; index -= 1) {
        if (steps[index]) {
            // The escaped pipe is the spelling `carve fmt` writes.
            lines.splice(fences[index].line, 0, `{data-line-numbers="${steps[index].replaceAll('|', '\\|')}"}`);
        }
    }

    return lines.join('\n');
}

function convertBlock(markdown, number, engine, warnings) {
    const markdownLines = markdown.trim().split(/\r?\n/);
    const stripped = markdownLines.map((line) => {
        const fence = FENCE.exec(line);
        const steps = fence && LINE_STEPS.exec(fence[2]);

        return steps ? `${fence[1]}${steps[1]}` : line;
    });
    // The writer spells a thematic break `---`, which this package would read
    // as a slide separator. `***` renders the same rule. Code keeps its lines.
    const convertedLines = engine.markdownToCarve(stripped.join('\n')).trim().split('\n');
    const fenced = fencedLines(convertedLines);
    const converted = convertedLines.map((line, index) => (line === '---' && !fenced.has(index) ? '***' : line)).join('\n');
    const carve = moveLineSteps(markdownLines, converted, number, warnings);

    for (const separator of [DEFAULTS.separator, DEFAULTS.verticalSeparator]) {
        if (new RegExp(separator).test(`\n${carve}\n`)) {
            warnings.push(`slide ${number}: a converted line reads as a slide separator; check the slide boundaries`);
            break;
        }
    }

    return carve;
}
