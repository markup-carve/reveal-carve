import { managedRenderers } from './renderer-runtime.js';
export { managedRenderers } from './renderer-runtime.js';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { vendorAssets } from './vendor.js';

const prepared = new Set();

export function rendererNames(value = []) {
    if (value === '') throw new Error('--with requires a value: mermaid,katex.');
    const names = [...new Set(typeof value === 'string' ? value.split(',') : value)];
    for (const name of names) {
        if (!['mermaid', 'katex'].includes(name)) {
            throw new Error(`Unknown renderer: ${name}. Choose mermaid,katex.`);
        }
    }
    return names;
}

export function rendererAssets(target, names, base) {
    names = rendererNames(names);
    if (!names.length) return { scripts: [], stylesheets: [], plugin: '' };
    const directory = base ? resolve(base) : join(dirname(resolve(target)), 'vendor');
    const key = JSON.stringify([directory, names]);
    const complete = names.every((name) => existsSync(join(directory,
        name === 'mermaid' ? 'mermaid.min.js' : 'katex/katex.min.js')));
    if (!prepared.has(key) || !complete) {
        const { missing } = vendorAssets(directory, { only: names });
        if (missing.length) {
            throw new Error(`Missing renderer assets. Run: npm install ${[...new Set(missing.map((entry) => entry.name))].join(' ')}`);
        }
        prepared.add(key);
    }
    const prefix = relative(dirname(resolve(target)), directory).split('\\').join('/') || '.';
    return {
        scripts: names.map((name) => `${prefix}/${name === 'mermaid' ? 'mermaid.min.js' : 'katex/katex.min.js'}`),
        stylesheets: names.includes('katex') ? [`${prefix}/katex/katex.min.css`] : [],
        plugin: `(${managedRenderers.toString()})(${JSON.stringify(names)})`,
    };
}
