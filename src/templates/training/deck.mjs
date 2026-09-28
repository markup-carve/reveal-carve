import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./src/cli.js', pathToFileURL(createRequire(import.meta.url).resolve('@markup-carve/reveal-carve/package.json'))));
const command = process.argv[2] || 'watch';
const run = (args) => {
    const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', cwd: fileURLToPath(new URL('.', import.meta.url)) });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
};

const common = [
    '--reveal-base', 'vendor/reveal',
    '--css', 'vendor/reveal-carve.css',
    '--js', 'vendor/reveal-carve.js',
    '--dark-css', 'vendor/reveal-carve-dark.css',
];

if (['build', 'watch', 'pdf'].includes(command)) {
    run(['vendor', 'vendor', '--no-renderers']);
    run([command, 'deck.crv', command === 'pdf' ? 'handout.pdf' : 'index.html', ...common]);
} else if (command === 'handout') {
    run(['handout', 'deck.crv', 'handout.md']);
} else if (['check', 'agenda'].includes(command)) {
    run([command, 'deck.crv']);
    if (command === 'check') run(['check', 'slides']);
} else {
    throw new Error(`Unknown command: ${command}`);
}
