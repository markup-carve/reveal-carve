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
};

/**
 * Carve wraps every heading in `<section id="...">`. reveal.js reads a nested
 * `<section>` as a vertical slide, so those wrappers have to go before the
 * rendered HTML is placed inside a slide.
 */
export function unwrapSections(html) {
    return html.replace(/<\/?section[^>]*>/g, '').trim();
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

/**
 * Split one slide's source into its body, its speaker notes and the attributes
 * declared through `%%` comment directives. The directives stay valid Carve
 * comments, so the document still renders correctly without this plugin.
 */
export function parseSlide(source, options = {}) {
    const config = { ...DEFAULTS, ...options };

    const withClass = takeDirective(source, config.classDirective);
    const withAttr = takeDirective(withClass.rest, config.attrDirective);

    const [body, ...noteParts] = withAttr.rest.split(directive(config.notesDirective));

    return {
        className: withClass.value,
        attributes: withAttr.value,
        body: body.trim(),
        notes: noteParts.join('\n').trim(),
    };
}

function openingTag(slide) {
    const parts = [];

    if (slide.className) {
        parts.push(`class="${slide.className}"`);
    }

    if (slide.attributes) {
        parts.push(slide.attributes);
    }

    return parts.length ? `<section ${parts.join(' ')}>` : '<section>';
}

/**
 * Render one slide to a `<section>`; `render` takes Carve source and returns HTML.
 */
export function renderSlide(source, render, options = {}) {
    const slide = parseSlide(source, options);
    const clean = (text) => {
        const html = unwrapSections(render(text));

        return options.moveCodeAttributes === false ? html : moveCodeAttributes(html);
    };

    const body = slide.body ? clean(slide.body) : '';
    const notes = slide.notes ? `\n<aside class="notes">\n${clean(slide.notes)}\n</aside>` : '';

    return `${openingTag(slide)}\n${body}${notes}\n</section>`;
}

/**
 * Render a whole document to the slide markup that goes inside `.reveal .slides`.
 */
export function renderDeck(source, render, options = {}) {
    const config = { ...DEFAULTS, ...options };
    const horizontal = new RegExp(config.separator, 'm');
    const vertical = new RegExp(config.verticalSeparator, 'm');

    return source
        .split(horizontal)
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
