/**
 * Speaker timer.
 *
 * `%% minutes: 5` already put a plan on every slide; this compares it with the
 * clock while you talk. The point is not a countdown - it is knowing, at slide
 * nine of twenty, whether you are eight minutes ahead or twelve behind, while
 * there is still room to act on it.
 *
 * Shown in the speaker view by default, because a number on the projector is
 * the audience's problem, not yours.
 */

function minutesOf(slide) {
    return Number(slide?.getAttribute('data-minutes')) || 0;
}

function format(seconds) {
    const sign = seconds < 0 ? '-' : '+';
    const total = Math.abs(Math.round(seconds));
    const minutes = Math.floor(total / 60);

    return `${sign}${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Minutes planned up to and including a slide, and for the deck as a whole.
 */
export function plannedSeconds(slides, upTo) {
    let elapsed = 0;

    for (let index = 0; index <= upTo && index < slides.length; index += 1) {
        elapsed += minutesOf(slides[index]) * 60;
    }

    return elapsed;
}

/**
 * @param {object} deck reveal instance
 * @param {object} config the `carve` config block
 */
export function setupTimer(deck, config = {}) {
    if (!config.timer) {
        return null;
    }

    const element = deck.getRevealElement();
    const parent = element.parentNode || document.body;
    const slides = [...element.querySelectorAll('.slides > section')];
    const planned = slides.reduce((sum, slide) => sum + minutesOf(slide), 0);

    if (!planned) {
        return null;
    }

    const box = document.createElement('div');
    box.className = config.timerClass || 'deck-timer';
    box.setAttribute('aria-live', 'off');

    // The speaker view is a separate window that copies the deck; showing the
    // timer only there keeps it off the projector.
    if (config.timer === 'always') {
        box.classList.add('deck-timer-always');
    }

    parent.appendChild(box);

    const started = Date.now();

    const tick = () => {
        const index = slides.indexOf(deck.getCurrentSlide?.() || slides[0]);
        const elapsed = (Date.now() - started) / 1000;
        const target = plannedSeconds(slides, index);
        const drift = target - elapsed;

        box.textContent = `${Math.round(elapsed / 60)} / ${planned} min  ${format(drift)}`;
        box.dataset.state = drift < -60 ? 'behind' : drift > 60 ? 'ahead' : 'onpace';
    };

    tick();
    const handle = setInterval(tick, 1000);
    deck.on?.('slidechanged', tick);

    return {
        element: box,
        tick,
        stop() {
            clearInterval(handle);
            box.remove();
        },
    };
}
