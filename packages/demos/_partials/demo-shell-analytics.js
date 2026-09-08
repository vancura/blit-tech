/**
 * Plausible analytics bootstrap for the demo shell document.
 *
 * Loaded only on the shell document (never inside embed iframes or demo swaps) so pageviews
 * are not double-counted. See `demo-shell.js` for how this is wired into the shell bootstrap.
 */

/**
 * Load Plausible only on the shell document so embed iframes (and demo swaps) do not
 * double-count pageviews.
 * @returns {void}
 */
export function initAnalytics() {
    const plausibleScript = document.createElement('script');

    plausibleScript.async = true;
    plausibleScript.src = 'https://plausible.io/js/pa-Jy-1Ffqwh5Zpp2YOMEBr5.js';

    document.head.appendChild(plausibleScript);

    // Modules are strict: use window.plausible (bare `plausible` is not a binding here).
    // Plausible's snippet queues calls until the remote script loads.
    window.plausible =
        window.plausible ||
        ((...args) => {
            const queue = window.plausible.q || [];

            window.plausible.q = queue;
            queue.push(args);
        });

    window.plausible.init =
        window.plausible.init ||
        ((i) => {
            window.plausible.o = i || {};
        });

    window.plausible.init();
}
