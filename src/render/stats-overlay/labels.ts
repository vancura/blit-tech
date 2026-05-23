/** Matches demo registry titles: "Blit-Tech Demo 006 - Patterns". */
const REGISTRY_TITLE_PATTERN = /^Blit-Tech Demo\s+.+?\s+-\s+(.+)$/;

/**
 * Turns the browser page title into a short top-left overlay label.
 *
 * @param pageTitle - Browser document title when available.
 * @returns Short label for the top-left bar (registry titles such as
 *   `Blit-Tech Demo 002 - Primitives` become `Primitives Demo`).
 */
export function resolveStatsTopLeftLabel(pageTitle: string | undefined): string {
    const raw = typeof pageTitle === 'string' ? pageTitle.trim() : '';

    if (raw.length === 0) {
        return 'Demo';
    }

    const match = raw.match(REGISTRY_TITLE_PATTERN);

    if (match) {
        return `${match[1]} Demo`;
    }

    return raw;
}
