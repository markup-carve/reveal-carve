import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as carve from '@markup-carve/carve';
import { moveCodeAttributes, renderSlide } from '../src/slice.js';

const source = '{.line-numbers data-line-start=42 data-highlight=1,3-5}\n```php "src/app.php"\n$a = 1;\n$b = 2;\n```\n';

test('Carve line options reach reveal on plain and captioned blocks', () => {
    for (const input of [source, source + '^ Listing #: sample\n']) {
        const slide = renderSlide(input, (text) => carve.render(text));
        assert.match(slide, /<code[^>]*data-line-numbers="1,3-5"/);
        assert.match(slide, /<code[^>]*data-ln-start-from="42"/);
    }
});

test('author reveal steps win and invalid Carve options do not become reveal options', () => {
    const explicit = '<pre class="line-numbers" data-line-numbers="1-4|2" data-highlight="1,3-5" data-line-start="42"><code>x</code></pre>';
    assert.match(moveCodeAttributes(explicit), /<code[^>]*data-line-numbers="1-4\|2"/);
    assert.equal((moveCodeAttributes(explicit).match(/data-line-numbers=/g) ?? []).length, 1);
    const invalid = moveCodeAttributes('<pre data-line-start="auto" data-highlight="1,a"><code>x</code></pre>');
    assert.doesNotMatch(invalid, /<code[^>]*data-line-numbers|<code[^>]*data-ln-start-from/);
    const captioned = renderSlide('{.line-numbers data-line-numbers="1-4|2" data-highlight=3}\n```js\nx\n```\n^ sample\n', (text) => carve.render(text));
    assert.match(captioned, /<code[^>]*data-line-numbers="1-4\|2"/);
    assert.equal((captioned.match(/<code[^>]*data-line-numbers=/g) ?? []).length, 1);
});
