import carve from '@markup-carve/carve-grammars/highlightjs/carve.js';
import { csv, tsv } from '@markup-carve/carve-grammars/highlightjs/delimited.js';

export function registerCarveLanguages(hljs) {
    hljs.registerLanguage('carve', () => {
        const language = carve(hljs);
        // The grammar release has not landed yet. Apply its braced cell rule to
        // both header and data rows while the dependency points at merged main.
        const bracedAlignment = {
            begin: [/(?<=(?<!\\)\|=?)\{/, /(?:[<>~][\^~v]?|\?[\^~v])/, /(?=(?:[ \t]+(?::[\w-]*|[.#]?[\w-]+(?:=(?:"(?:\\.|[^"\\\n]){0,256}"|'(?:\\.|[^'\\\n]){0,256}'|[^\s"'{}]{1,256}))?))*[ \t]*\})/],
            beginScope: { 2: 'table-alignment' },
        };

        for (const row of language.contains.filter((mode) => mode.contains?.some((cell) => cell.className === 'table-span'))) {
            const span = row.contains.findIndex((cell) => cell.className === 'table-span');
            row.contains.splice(span, 0, bracedAlignment);
        }

        return language;
    });
    hljs.registerLanguage('csv', csv);
    hljs.registerLanguage('tsv', tsv);
}
