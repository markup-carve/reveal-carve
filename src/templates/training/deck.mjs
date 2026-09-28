import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./src/cli.js', pathToFileURL(createRequire(import.meta.url).resolve('@markup-carve/reveal-carve/package.json'))));
const command = process.argv[2] || 'watch';
const renderers = 'mermaid,katex';
const run = (args) => {
    const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', cwd: fileURLToPath(new URL('.', import.meta.url)) });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
};

const common = [
    '--title', 'Planning a workshop',
    '--reveal-base', 'vendor/reveal',
    '--css', 'vendor/reveal-carve.css',
    '--js', 'vendor/reveal-carve.js',
    '--dark-theme', 'black', '--dark-css', 'vendor/reveal-carve-dark.css',
    '--with', renderers,
];

if (['build', 'watch', 'pdf'].includes(command)) {
    run(['vendor', 'vendor', '--with', renderers]);
    run([command, 'slides', command === 'pdf' ? 'handout.pdf' : 'index.html', ...common]);
} else if (command === 'handout') {
    run(['handout', 'slides', 'handout.md']);
} else if (['check', 'agenda'].includes(command)) {
    run([command, 'slides']);
} else {
    throw new Error(`Unknown command: ${command}`);
}
