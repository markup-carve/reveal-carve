/**
 * Turning one Carve document into reveal.js slide markup.
 *
 * Pure string work: no file system, no DOM, no Carve engine. The caller passes a
 * render function, which is what lets the same code run in the browser plugin and
 * in the Node build step.
 */

export const DEFAULTS = {
    separator: '\\r?\\n---\\r?\\n',
    verticalSeparator: '\\r?\\n--\\r?\\n',
    classDirective: '^%%\\s*class:\\s*(.+)$',
    attrDirective: '^%%\\s*attr:\\s*(.+)$',
    notesDirective: '^%%\\s*notes\\s*$',
    fragmentDirective: '^%%\\s*fragments\\s*$',
    animateDirective: '^%%\\s*animate\\s*$',
    minutesDirective: '^%%\\s*minutes:\\s*(\\d+)\\s*$',
    tocDirective: '^%%\\s*toc\\s*$',
    animateLists: false,
    splitAtHeading: 0,
    moveCodeAttributes: true,
};

/**
 * Carve wraps every heading in `<section id="...">`. reveal.js reads a nested
 * `<section>` as a slide, so those wrappers have to go before the rendered HTML
 * is placed inside one. (The engine can leave them off with `sections: false`;
 * this stays for renderers that ignore the option.)
 *
 * A `<section role="doc-endnotes">` needs different treatment again. Keeping it
 * as a section put the footnotes on top of the rest of the slide, because
 * reveal positions every section in the deck absolutely. Dropping it lost the
 * role and the styling hook. So it becomes an `<aside>` carrying the same
 * attributes: same semantics, and reveal has no opinion about it.
 */
export function unwrapSections(html) {
    const kept = [];

    // Pull the semantic sections out first so the blunt strip below cannot eat
    // their closing tags, then put them back as asides.
    const masked = html.replace(
        /<section([^>]*\brole=[^>]*)>([\s\S]*?)<\/section>/g,
        (match, attrs, body) => {
            kept.push(`<aside${attrs}>${body}</aside>`);

            return `\u0000${kept.length - 1}\u0000`;
        },
    );

    return masked
        .replace(/<section[^>]*>|<\/section>/g, '')
        .replace(/\u0000(\d+)\u0000/g, (_, index) => kept[Number(index)])
        .trim();
}

/**
 * Attributes reveal.js expects on the `<code>` element of a highlighted block.
 * Carve puts a fence's attribute line onto the `<pre>`, so they have to move one
 * level down or the highlight plugin never sees them.
 */
export const CODE_ATTRIBUTES = [
    'data-line-numbers',
    'data-ln-start-from',
    'data-trim',
    'data-noescape',
    'data-id',
];

export function moveCodeAttributes(html, names = CODE_ATTRIBUTES) {
    return html.replace(/<pre([^>]*)>(\s*)<code([^>]*)>/g, (match, preAttrs, gap, codeAttrs) => {
        let remaining = preAttrs;
        let moved = '';

        for (const name of names) {
            const pattern = new RegExp(`\\s${name}(="[^"]*")?`, 'i');
            const found = remaining.match(pattern);

            if (found) {
                remaining = remaining.replace(pattern, '');
                moved += found[0];
            }
        }

        return moved ? `<pre${remaining}>${gap}<code${moved}${codeAttrs}>` : match;
    });
}

/**
 * Carve carries an attribute onto the list, not onto its items, so a bullet list
 * reveals in one go. This gives every item its own step instead.
 *
 * Two ways in, deliberately distinct:
 *
 * - `{.fragments}` (plural) on one list, handled here.
 * - `%% fragments` on a slide, or the `animateLists` option, which passes
 *   `{ all: true }` and animates every list on that slide.
 *
 * `{.fragment}` (singular) is left alone: in reveal that means "the whole list
 * is one step", and hijacking it would take away a control the author has.
 */
export function animateListItems(html, options = {}) {
    return html.replace(/<(ul|ol)([^>]*)>([\s\S]*?)<\/\1>/g, (match, tag, attrs, body) => {
        const marked = /class="[^"]*\bfragments\b/.test(attrs);

        if (!marked && !options.all) {
            return match;
        }

        // A list the author already marked as a single fragment keeps that meaning.
        if (!marked && /class="[^"]*\bfragment\b/.test(attrs)) {
            return match;
        }

        const withoutFragment = attrs
            .replace(/\s*class="([^"]*)"/, (_, classes) => {
                const rest = classes.split(/\s+/).filter((name) => name && name !== 'fragments');

                return rest.length ? ` class="${rest.join(' ')}"` : '';
            });

        const items = body.replace(/<li(\s[^>]*)?>/g, (openTag, itemAttrs = '') => {
            if (/class="/.test(openTag)) {
                return openTag.replace(/class="([^"]*)"/, 'class="$1 fragment"');
            }

            return `<li class="fragment"${itemAttrs || ''}>`;
        });

        return `<${tag}${withoutFragment}>${items}</${tag}>`;
    });
}

/**
 * Render a container class as a different element.
 *
 * Carve gives you `<div class="card">` for `{.card}` plus `:::`. Sometimes the
 * slide wants a `<figure>`, an `<aside>` or a `<blockquote>` - semantics a
 * screen reader and a printed handout both care about.
 *
 * The alternative is raw HTML in the source, which only the HTML target
 * understands: plain text, ANSI and the Markdown handout all drop it. Mapping
 * the class instead keeps the source pure Carve, and any other Carve tool still
 * sees a sensible `div`.
 *
 * @param {string} html
 * @param {Record<string, string>} map e.g. { card: 'figure', sidebar: 'aside' }
 */
export function mapElements(html, map) {
    const names = Object.keys(map || {});

    if (!names.length) {
        return html;
    }

    let result = html;

    for (const name of names) {
        const element = map[name];
        const opening = new RegExp(`<div([^>]*\\bclass="[^"]*\\b${name}\\b[^"]*"[^>]*)>`, 'g');
        const positions = [];
        let match;

        while ((match = opening.exec(result)) !== null) {
            positions.push({ start: match.index, length: match[0].length, attrs: match[1] });
        }

        // Walk backwards so earlier offsets stay valid while rewriting.
        for (const { start, length, attrs } of positions.reverse()) {
            const close = matchingCloseTag(result, start + length);

            if (close === -1) {
                continue;
            }

            result = result.slice(0, close)
                + `</${element}>`
                + result.slice(close + '</div>'.length);
            result = result.slice(0, start)
                + `<${element}${attrs}>`
                + result.slice(start + length);
        }
    }

    return result;
}

/**
 * Index of the `</div>` that closes the `<div>` whose body starts at `from`.
 */
function matchingCloseTag(html, from) {
    const tag = /<(\/?)div\b[^>]*>/g;
    tag.lastIndex = from;
    let depth = 0;
    let match;

    while ((match = tag.exec(html)) !== null) {
        if (match[1] === '/') {
            if (depth === 0) {
                return match.index;
            }

            depth -= 1;
        } else {
            depth += 1;
        }
    }

    return -1;
}

/**
 * reveal's highlight plugin escapes the content of a code block unless the
 * element says otherwise, which turns Carve's callout markers into visible
 * `<b class="callout">` text - measured on the built deck. A block that carries
 * markup from an extension therefore has to opt out of that escaping.
 */
export function keepInlineCodeMarkup(html) {
    return html.replace(/<code(?![^>]*data-noescape)([^>]*)>([\s\S]*?)<\/code>/g, (match, attrs, body) => {
        if (!/<b class="callout"/.test(body)) {
            return match;
        }

        return `<code data-noescape${attrs}>${body}</code>`;
    });
}

function directive(pattern) {
    return new RegExp(pattern, 'm');
}

function takeDirective(source, pattern) {
    const match = source.match(directive(pattern));
    if (!match) {
        return { value: '', rest: source };
    }

    return {
        value: match[1].trim(),
        rest: source.replace(directive(pattern), ''),
    };
}

function takeFlag(source, pattern) {
    const expression = directive(pattern);

    if (!expression.test(source)) {
        return { present: false, rest: source };
    }

    return { present: true, rest: source.replace(expression, '') };
}

/**
 * Split one slide's source into its body, its speaker notes and the attributes
 * declared through `%%` comment directives. The directives stay valid Carve
 * comments, so the document still renders correctly without this plugin.
 */
export function parseSlide(source, options = {}) {
    const config = { ...DEFAULTS, ...options };

    const withClass = takeDirective(source, config.classDirective);
    const withAttr = takeDirective(withClass.rest, config.attrDirective);
    const withFragments = takeFlag(withAttr.rest, config.fragmentDirective);
    const withAnimate = takeFlag(withFragments.rest, config.animateDirective);
    const withToc = takeFlag(withAnimate.rest, config.tocDirective);
    const withMinutes = takeDirective(withToc.rest, config.minutesDirective);

    const [body, ...noteParts] = withMinutes.rest.split(directive(config.notesDirective));

    return {
        className: withClass.value,
        attributes: withAttr.value,
        animateLists: withFragments.present,
        autoAnimate: withAnimate.present,
        toc: withToc.present,
        minutes: withMinutes.value ? Number(withMinutes.value) : 0,
        body: body.trim(),
        notes: noteParts.join('\n').trim(),
    };
}

function openingTag(slide) {
    const parts = [];

    if (slide.className) {
        parts.push(`class="${slide.className}"`);
    }

    if (slide.autoAnimate) {
        parts.push('data-auto-animate');
    }

    if (slide.minutes) {
        parts.push(`data-minutes="${slide.minutes}"`);
    }

    if (slide.attributes) {
        parts.push(slide.attributes);
    }

    return parts.length ? `<section ${parts.join(' ')}>` : '<section>';
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * A slide that failed to render becomes a visible diagnostic rather than a
 * silently missing slide. On a projector, a short deck is the worst way to learn
 * about a typo.
 */
export function errorSlide(error, source) {
    const excerpt = source.trim().split('\n').slice(0, 5).join('\n');

    return `<section class="carve-error" data-carve-error>
<h2>Carve could not render this slide</h2>
<p><strong>${escapeHtml(error.message || error)}</strong></p>
<pre><code>${escapeHtml(excerpt)}</code></pre>
</section>`;
}

/**
 * Render one slide to a `<section>`; `render` takes Carve source and returns HTML.
 */
export function renderSlide(source, render, options = {}) {
    const config = { ...DEFAULTS, ...options };
    const slide = parseSlide(source, config);

    const clean = (text) => {
        let html = unwrapSections(render(text));

        if (config.moveCodeAttributes !== false) {
            html = moveCodeAttributes(html);
        }

        html = keepInlineCodeMarkup(html);

        html = animateListItems(html, { all: config.animateLists || slide.animateLists });

        if (config.elements) {
            html = mapElements(html, config.elements);
        }

        return html;
    };

    try {
        const body = slide.body ? clean(slide.body) : '';
        const notes = slide.notes ? `\n<aside class="notes">\n${clean(slide.notes)}\n</aside>` : '';

        return `${openingTag(slide)}\n${body}${notes}\n</section>`;
    } catch (error) {
        if (config.onError) {
            config.onError(error, source);
        }

        if (config.throwOnError) {
            throw error;
        }

        return errorSlide(error, source);
    }
}

/**
 * Split a document at headings of the given level, for prose-shaped sources that
 * would otherwise need a separator line between every slide.
 */
export function splitAtHeading(source, level) {
    const marker = new RegExp(`^(?=#{${level}}\\s)`, 'm');

    return source
        .split(marker)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
}

/**
 * Footnote definitions are a property of the document, and canonical formatting
 * moves them to its end. A slide is a fragment of that document, so a reference
 * on slide three would look for a definition that now lives on slide twelve.
 *
 * Both halves are collected here and handed to whichever slide refers to them.
 */
export function extractFootnotes(source) {
    const definitions = new Map();
    const pattern = /^\[\^([^\]]+)\]:[ \t]*([\s\S]*?)(?=\n{2,}(?!\s)|\n*$)/gm;
    const body = source.replace(pattern, (match, id, text) => {
        definitions.set(id, `[^${id}]: ${text.trim()}`);

        return '';
    });

    return { body, definitions };
}

export function attachFootnotes(chunk, definitions) {
    if (!definitions.size) {
        return chunk;
    }

    const used = [...chunk.matchAll(/\[\^([^\]]+)\]/g)].map((match) => match[1]);
    const needed = [...new Set(used)].filter((id) => definitions.has(id));

    if (!needed.length) {
        return chunk;
    }

    return `${chunk.trimEnd()}\n\n${needed.map((id) => definitions.get(id)).join('\n\n')}\n`;
}

/**
 * The first heading of a slide, which is what an agenda lists.
 */
export function headingOf(source, options = {}) {
    const slide = parseSlide(source, options);
    const match = slide.body.match(/^#{1,3}\s+(.+)$/m);

    return match ? match[1].trim() : '';
}

/**
 * Every slide's planned minutes, and their total. A two-hour block is then
 * something you planned rather than something you discovered at minute 90.
 */
export function deckMinutes(source, options = {}) {
    const config = { ...DEFAULTS, ...options };
    const slides = source
        .split(new RegExp(config.separator, 'm'))
        .flatMap((chunk) => chunk.split(new RegExp(config.verticalSeparator, 'm')))
        .filter((chunk) => chunk.trim());

    const perSlide = slides.map((chunk) => ({
        heading: headingOf(chunk, config),
        minutes: parseSlide(chunk, config).minutes,
    }));

    return {
        slides: perSlide,
        total: perSlide.reduce((sum, slide) => sum + slide.minutes, 0),
        planned: perSlide.filter((slide) => slide.minutes).length,
    };
}

/**
 * Turn a slide carrying `%% toc` into an agenda of the other slides' headings,
 * so the running order cannot drift away from the deck it describes.
 */
function withAgenda(chunk, chunks, config) {
    const headings = chunks
        .filter((other) => other !== chunk)
        .map((other) => {
            const heading = headingOf(other, config);
            const minutes = parseSlide(other, config).minutes;

            return heading && (minutes ? `${heading} [${minutes} min]` : heading);
        })
        .filter(Boolean);

    if (!headings.length) {
        return chunk;
    }

    return `${chunk.trimEnd()}\n\n${headings.map((entry) => `- ${entry}`).join('\n')}\n`;
}

/**
 * Render a whole document to the slide markup that goes inside `.reveal .slides`.
 */
export function renderDeck(source, render, options = {}) {
    const config = { ...DEFAULTS, ...options };
    const { body, definitions } = config.footnotes === false
        ? { body: source, definitions: new Map() }
        : extractFootnotes(source);
    const chunks = config.splitAtHeading
        ? splitAtHeading(body, config.splitAtHeading)
        : body.split(new RegExp(config.separator, 'm'));
    const vertical = new RegExp(config.verticalSeparator, 'm');

    return chunks
        .map((chunk) => (parseSlide(chunk, config).toc ? withAgenda(chunk, chunks, config) : chunk))
        .map((chunk) => attachFootnotes(chunk, definitions))
        .map((chunk) => {
            const stack = chunk.split(vertical).filter((part) => part.trim());

            if (stack.length > 1) {
                const inner = stack.map((part) => renderSlide(part, render, config)).join('\n');

                return `<section>\n${inner}\n</section>`;
            }

            return stack.length ? renderSlide(stack[0], render, config) : '';
        })
        .filter(Boolean);
}
