/**
 * PDF export: reveal's own `?print-pdf` mode, printed by headless Chrome.
 *
 * Everybody who hands out slides ends up writing this, usually wrong: the export
 * only looks right when the page is printed at the deck's own dimensions with
 * background graphics on.
 */

import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const CANDIDATES = [
    process.env.CHROME_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function findChrome() {
    for (const candidate of CANDIDATES) {
        if (candidate.includes('/')) {
            try {
                await access(candidate, constants.X_OK);

                return candidate;
            } catch {
                continue;
            }
        }

        const found = await new Promise((done) => {
            const which = spawn('which', [candidate]);
            which.on('close', (code) => done(code === 0 ? candidate : null));
            which.on('error', () => done(null));
        });

        if (found) {
            return found;
        }
    }

    throw new Error(
        'reveal-carve: no Chrome or Chromium found. Set CHROME_PATH to the binary.',
    );
}

/**
 * @param {string} deck Path to the built HTML deck
 * @param {string} target Path to write the PDF to
 * @param {object} [options]
 * @param {string} [options.chrome] Binary to use
 * @param {number} [options.wait] Milliseconds to let the deck settle, default 2000
 */
export async function exportPdf(deck, target, options = {}) {
    const binary = options.chrome || (await findChrome());
    const url = deck.startsWith('http')
        ? `${deck}${deck.includes('?') ? '&' : '?'}print-pdf`
        : `file://${isAbsolute(deck) ? deck : resolve(deck)}?print-pdf`;

    const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--virtual-time-budget=${options.wait || 2000}`,
        `--print-to-pdf=${isAbsolute(target) ? target : resolve(target)}`,
        url,
    ];

    await new Promise((done, fail) => {
        const chrome = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';

        chrome.stderr.on('data', (chunk) => {
            stderr += chunk;
        });

        chrome.on('close', (code) => {
            if (code === 0) {
                done();

                return;
            }

            fail(new Error(`reveal-carve: Chrome exited with ${code}\n${stderr.trim()}`));
        });

        chrome.on('error', fail);
    });

    return target;
}
