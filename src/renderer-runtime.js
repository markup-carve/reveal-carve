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
                    for (const block of root.querySelectorAll('.mermaid:not([data-carve-rendered])')) {
                        // render() measures in a visible scratch node, including for hidden slides.
                        const { svg, bindFunctions } = await window.mermaid.render(`carve-diagram-${window.carveDiagramId = (window.carveDiagramId || 0) + 1}`, block.textContent.trim());
                        block.innerHTML = svg;
                        // Keep neutral diagram lines readable after a theme switch.
                        block.querySelector('svg').style.backgroundColor = '#fff';
                        bindFunctions?.(block);
                        block.dataset.carveRendered = 'true';
                    }
                }
                if (names.includes('katex')) {
                    if (!window.katex) throw new Error('KaTeX failed to load. Run npm install katex.');
                    for (const block of root.querySelectorAll('.math:not([data-carve-rendered])')) {
                        const source = block.textContent.trim().replace(/^\\\[|\\\]$/g, '').replace(/^\\\(|\\\)$/g, '');
                        window.katex.render(source, block, { displayMode: block.classList.contains('display'), throwOnError: true, trust: false });
                        block.dataset.carveRendered = 'true';
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

