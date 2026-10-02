/**
 * Where the headless browser is.
 *
 * The lookup exists because nothing guarantees a browser under one name: a CI
 * image carries `chromium` one week and `google-chrome` the next, and a
 * contributor's machine may carry neither. CHROME_PATH or CHROME_BIN names the
 * binary outright and wins over the search.
 */

import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';

const CANDIDATES = [
    process.env.CHROME_PATH,
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chrome',
    'chromium',
    'chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export async function findChrome() {
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

    throw new Error(`reveal-carve: no Chrome or Chromium found. Tried ${CANDIDATES.join(', ')}. Set CHROME_PATH to the binary.`);
}

/**
 * Extra launch flags.
 *
 * Chrome will not start sandboxed where the kernel denies it an unprivileged
 * user namespace, or where its own SUID helper is not setuid root. Both are
 * normal in CI and in a container, and neither is something the script can
 * repair. CHROME_NO_SANDBOX=1 drops the sandbox for exactly those places; the
 * default keeps it, because a reader running `reveal-carve pdf` over their own
 * deck has no reason to lose it.
 */
export function sandboxFlags() {
    const asked = process.env.CHROME_NO_SANDBOX;

    return asked && asked !== '0' && asked !== 'false' ? ['--no-sandbox'] : [];
}
