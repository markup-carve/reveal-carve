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

// Reveal awaits plugin initialization before measuring slides for print.
export function managedRenderers(names) {
    return {
        id: 'carve-renderers',
        async init(deck) {
            window.carveRenderers = { ready: false, error: null };
            try {
                const root = deck.getSlidesElement();
                if (names.includes('mermaid')) {
                    if (!window.mermaid) throw new Error('Mermaid failed to load. Run npm install mermaid.');
                    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
                    for (const [index, block] of [...root.querySelectorAll('.mermaid')].entries()) {
                        // render() measures in a visible scratch node, including for hidden slides.
                        const { svg, bindFunctions } = await window.mermaid.render(`carve-diagram-${index}`, block.textContent.trim());
                        block.innerHTML = svg;
                        // Keep neutral diagram lines readable after a theme switch.
                        block.querySelector('svg').style.backgroundColor = '#fff';
                        bindFunctions?.(block);
                    }
                }
                if (names.includes('katex')) {
                    if (!window.katex) throw new Error('KaTeX failed to load. Run npm install katex.');
                    for (const block of root.querySelectorAll('.math')) {
                        const source = block.textContent.trim().replace(/^\\\[|\\\]$/g, '').replace(/^\\\(|\\\)$/g, '');
                        window.katex.render(source, block, { displayMode: block.classList.contains('display'), throwOnError: true, trust: false });
                    }
                }
                await document.fonts.ready;
                window.carveRenderers.ready = true;
            } catch (error) {
                window.carveRenderers.error = error.message;
                const message = document.createElement('pre');
                message.className = 'carve-renderer-error';
                message.textContent = `Rendering failed: ${error.message}`;
                document.body.prepend(message);
                console.error(error);
                throw error;
            }
        },
    };
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
