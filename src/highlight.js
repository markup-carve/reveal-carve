import carve from '@markup-carve/carve-grammars/highlightjs/carve.js';
import { csv, tsv } from '@markup-carve/carve-grammars/highlightjs/delimited.js';

export function registerCarveLanguages(hljs) {
    hljs.registerLanguage('carve', carve);
    hljs.registerLanguage('csv', csv);
    hljs.registerLanguage('tsv', tsv);
}
