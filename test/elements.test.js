import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapElements, renderSlide } from '../src/slice.js';

test('renders a mapped container as the configured element', () => {
    const html = mapElements('<div class="card"><p>a</p></div>', { card: 'figure' });

    assert.equal(html, '<figure class="card"><p>a</p></figure>');
});

test('keeps the other classes and attributes', () => {
    const html = mapElements('<div id="x" class="card wide"><p>a</p></div>', { card: 'figure' });

    assert.equal(html, '<figure id="x" class="card wide"><p>a</p></figure>');
});

test('closes the right tag when containers are nested', () => {
    const html = mapElements(
        '<div class="card"><div class="inner">b</div></div>',
        { card: 'figure' },
    );

    assert.equal(html, '<figure class="card"><div class="inner">b</div></figure>');
});

test('maps two nested containers independently', () => {
    const html = mapElements(
        '<div class="card"><div class="quote">b</div></div>',
        { card: 'figure', quote: 'blockquote' },
    );

    assert.equal(html, '<figure class="card"><blockquote class="quote">b</blockquote></figure>');
});

test('leaves a class that only looks similar alone', () => {
    const input = '<div class="cardboard">a</div>';

    assert.equal(mapElements(input, { card: 'figure' }), input);
});

test('leaves the html alone without a map', () => {
    const input = '<div class="card">a</div>';

    assert.equal(mapElements(input, {}), input);
    assert.equal(mapElements(input, undefined), input);
});

test('an unclosed container is left as it is rather than corrupted', () => {
    const input = '<div class="card"><p>a</p>';

    assert.equal(mapElements(input, { card: 'figure' }), input);
});

test('a slide applies the map when one is configured', () => {
    const render = () => '<div class="card"><p>a</p></div>';
    const html = renderSlide('body', render, { elements: { card: 'figure' } });

    assert.match(html, /<figure class="card">/);
});
