#!/usr/bin/env node
/**
 * Enforce mutual consistency between demo files on disk, DEMO_ORDER, VINTAGE_URLS,
 * and NAV_HIDDEN_SLUGS. Failures exit 1 with clear messages – soft console.warns from
 * buildRegistry are not enough for CI / preflight.
 *
 * Rules:
 * - Every `src/*.js` matching the number-free kebab-case pattern has exactly one
 *   DEMO_ORDER entry, and every DEMO_ORDER entry has exactly one matching file.
 * - No duplicate current slugs; no current slug may equal a vintage URL key that maps
 *   elsewhere (would steal that demo's public path).
 * - Every VINTAGE_URLS target is either a live slug or listed in RETIRED_SLUGS.
 * - Every NAV_HIDDEN_SLUGS / RETIRED_SLUGS entry is still meaningful (no stale rows).
 * - Every demo carries a one-line `@description` header tag of a length that survives every
 *   social-card consumer intact (see DESCRIPTION_MIN_CHARS / DESCRIPTION_MAX_CHARS).
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEMO_ORDER } from '../plugins/demo-order.js';
import { buildRegistry, HEADER_SCAN_BYTES, NAV_HIDDEN_SLUGS } from '../plugins/demo-registry.js';
import { RETIRED_SLUGS, VINTAGE_URLS } from '../plugins/demo-vintage-urls.js';
import { OG_IMAGE_DIR, OG_SCALE_MODES } from '../plugins/social-meta.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Mirrors plugins/demo-registry.js – kept local so this script can list files without
// going through buildRegistry's soft-warn merge path.
const FILENAME_PATTERN = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.js$/;

// The ceiling is the column budget, not an SEO limit: the tag must be one line, and the
// longest prefix (" * @description ") is 16 characters, so 104 is the most that fits this
// repo's 120-column convention. That lands comfortably under every consumer's truncation
// point anyway – Google cuts a meta description around 155 characters, and Facebook's own
// guidance is under 155. The floor keeps one-word placeholders ("Sprites.") from passing the
// gate.
const DESCRIPTION_MIN_CHARS = 60;
const DESCRIPTION_MAX_CHARS = 104;

/**
 * Collect number-free kebab-case demo slugs from `src/`.
 * @returns {string[]}
 */
function listDiskSlugs() {
    const files = readdirSync(join(ROOT, 'src'));
    /** @type {string[]} */
    const slugs = [];

    for (const file of files) {
        const match = file.match(FILENAME_PATTERN);

        if (match) {
            slugs.push(match[1]);
        }
    }

    return slugs.sort((a, b) => a.localeCompare(b));
}

/**
 * Validate a demo's `@description` header tag: presence, length range, forbidden characters,
 * and sentence-final punctuation. Exported so it can be unit-tested without touching disk.
 * @param {string} slug – Demo slug, used only to shape the failure messages.
 * @param {string} description – Trimmed `@description` value, or '' when the tag is absent.
 * @returns {string[]} Failure messages, empty when the description is valid.
 */
export function findDescriptionFailures(slug, description) {
    if (description === '') {
        return [
            `src/${slug}.js has no "@description <one sentence>" header tag – required for the ` +
                `meta description and og:description, and it must appear within the first ` +
                `${HEADER_SCAN_BYTES} bytes of the file`,
        ];
    }

    /** @type {string[]} */
    const failures = [];

    // Count code points, not UTF-16 units, so one astral character is not counted as two.
    const length = [...description].length;

    if (length < DESCRIPTION_MIN_CHARS) {
        failures.push(
            `src/${slug}.js @description is ${length} chars, under the ${DESCRIPTION_MIN_CHARS}-char minimum`,
        );
    }

    if (length > DESCRIPTION_MAX_CHARS) {
        failures.push(`src/${slug}.js @description is ${length} chars, over the ${DESCRIPTION_MAX_CHARS}-char ceiling`);
    }

    if (/[<>]/.test(description)) {
        failures.push(`src/${slug}.js @description contains < or > – keep it plain prose`);
    }

    // A period specifically, not any sentence-final mark: the documented rule says period, and
    // 46 cards that punctuate the same way read better than a mix.
    if (!/\.$/.test(description)) {
        failures.push(`src/${slug}.js @description should end in a period`);
    }

    return failures;
}

/**
 * Validate a demo's optional `@ogScale` header tag against the real OG_SCALE_MODES set.
 * Exported so it can be unit-tested without touching disk.
 * @param {string} slug – Demo slug, used only to shape the failure message.
 * @param {string} ogScale – Trimmed `@ogScale` value, or '' when the tag is absent.
 * @returns {string | null} A failure message, or null when the value is valid or absent.
 */
export function findOgScaleFailure(slug, ogScale) {
    if (ogScale !== '' && !OG_SCALE_MODES.has(ogScale)) {
        return `src/${slug}.js has @ogScale "${ogScale}", which is not one of ${[...OG_SCALE_MODES].join(', ')}`;
    }

    return null;
}

/**
 * Validate that every VINTAGE_URLS target is either a live disk slug or explicitly listed in
 * RETIRED_SLUGS (and not both), and that every RETIRED_SLUGS entry is still meaningful: absent
 * from disk and targeted by at least one VINTAGE_URLS entry. Exported so it can be
 * unit-tested without touching disk.
 * @param {Record<string, string>} vintageUrls – Vintage slug -> current slug map.
 * @param {Set<string>} diskSlugSet – Slugs with a live `src/<slug>.js` file.
 * @param {Set<string>} retiredSlugs – Slugs explicitly retired (no longer live, still redirected).
 * @returns {string[]} Failure messages, empty when everything is consistent.
 */
export function findVintageUrlFailures(vintageUrls, diskSlugSet, retiredSlugs) {
    /** @type {string[]} */
    const failures = [];
    const vintageTargets = new Set();

    for (const [vintageSlug, currentSlug] of Object.entries(vintageUrls)) {
        vintageTargets.add(currentSlug);

        const isLive = diskSlugSet.has(currentSlug);
        const isRetired = retiredSlugs.has(currentSlug);

        if (!isLive && !isRetired) {
            failures.push(
                `VINTAGE_URLS["${vintageSlug}"] → "${currentSlug}" is neither a live src/${currentSlug}.js nor listed in RETIRED_SLUGS`,
            );
        }

        if (isLive && isRetired) {
            failures.push(
                `Slug "${currentSlug}" is both live on disk and listed in RETIRED_SLUGS – remove it from RETIRED_SLUGS`,
            );
        }
    }

    for (const slug of retiredSlugs) {
        if (diskSlugSet.has(slug)) {
            failures.push(`RETIRED_SLUGS lists "${slug}" but src/${slug}.js still exists`);
        }

        if (!vintageTargets.has(slug)) {
            failures.push(`RETIRED_SLUGS lists "${slug}" but no VINTAGE_URLS entry targets it`);
        }
    }

    return failures;
}

/**
 * Validate the DEMO_ORDER ↔ disk bijection: no duplicate entries, every DEMO_ORDER slug has a
 * matching file, and every file is listed.
 * @param {string[]} diskSlugs – Slugs found on disk.
 * @param {Set<string>} diskSlugSet – Same slugs, as a set.
 * @returns {string[]} Failure messages, empty when the bijection holds.
 */
function findOrderBijectionFailures(diskSlugs, diskSlugSet) {
    /** @type {string[]} */
    const failures = [];
    const orderSeen = new Set();

    for (const slug of DEMO_ORDER) {
        if (orderSeen.has(slug)) {
            failures.push(`Duplicate DEMO_ORDER entry: "${slug}"`);
            continue;
        }

        orderSeen.add(slug);

        if (!diskSlugSet.has(slug)) {
            failures.push(`DEMO_ORDER lists "${slug}" but src/${slug}.js is missing`);
        }
    }

    for (const slug of diskSlugs) {
        if (!orderSeen.has(slug)) {
            failures.push(`src/${slug}.js is not listed in DEMO_ORDER`);
        }
    }

    return failures;
}

/**
 * Validate that no live slug collides with a vintage URL key mapping elsewhere, which would
 * steal that demo's public path.
 * @param {string[]} diskSlugs – Slugs found on disk.
 * @param {Record<string, string>} vintageUrls – Vintage slug -> current slug map.
 * @returns {string[]} Failure messages, empty when there is no collision.
 */
function findVintageKeyCollisions(diskSlugs, vintageUrls) {
    /** @type {string[]} */
    const failures = [];
    const vintageByKey = new Map(Object.entries(vintageUrls));

    for (const slug of diskSlugs) {
        const mappedCurrent = vintageByKey.get(slug);

        if (mappedCurrent !== undefined && mappedCurrent !== slug) {
            failures.push(
                `Current slug "${slug}" collides with vintage URL key mapping to "${mappedCurrent}" (would steal /${slug})`,
            );
        }
    }

    return failures;
}

/**
 * Validate every demo's `@description` and `@ogScale` header tags.
 * @param {Array<{ slug: string, description: string, ogScale: string }>} registry
 * @returns {string[]} Failure messages, empty when every entry is valid.
 */
function findHeaderTagFailures(registry) {
    /** @type {string[]} */
    const failures = [];

    for (const entry of registry) {
        failures.push(...findDescriptionFailures(entry.slug, entry.description));

        const ogScaleFailure = findOgScaleFailure(entry.slug, entry.ogScale);

        if (ogScaleFailure) {
            failures.push(ogScaleFailure);
        }
    }

    return failures;
}

/**
 * Validate that every demo has a committed OpenGraph card. `buildSocialMeta` would fall back to
 * og-default.png for any slug missing here, so this is not needed for the page to render – it is
 * needed so a new demo does not silently ship without a real card. Capturing one needs a built
 * site, a preview server, a browser, and ffmpeg, so this stays manual (`pnpm run capture:og`, see
 * README) rather than something preflight runs itself.
 * @param {Array<{ slug: string }>} registry
 * @returns {string[]} Failure messages, empty when every demo has a card.
 */
function findMissingOgCardFailures(registry) {
    return registry
        .map((entry) => entry.slug)
        .filter((slug) => !existsSync(join(ROOT, 'public', OG_IMAGE_DIR, `og-${slug}.png`)))
        .map(
            (slug) =>
                `public/${OG_IMAGE_DIR}/og-${slug}.png is missing – capture it with \`pnpm run capture:og -- ${slug}\``,
        );
}

/**
 * Run every registry consistency check and exit 1 with clear messages on failure. Guarded by
 * the ESM entry check at the bottom of this file so importing this module for its exported pure
 * functions never scans the real disk or calls process.exit.
 * @returns {void}
 */
function main() {
    const diskSlugs = listDiskSlugs();
    const diskSlugSet = new Set(diskSlugs);

    // Mute buildRegistry's soft warns – this script reports the same issues as hard errors.
    const originalWarn = console.warn;
    console.warn = () => {};
    const registry = buildRegistry(ROOT);
    console.warn = originalWarn;

    const registrySlugSet = new Set(registry.map((entry) => entry.slug));
    const registryDrifted =
        registrySlugSet.size !== diskSlugSet.size || [...registrySlugSet].some((slug) => !diskSlugSet.has(slug));

    const errors = [
        ...(registryDrifted
            ? [
                  'buildRegistry() slug set disagrees with src/ scan — FILENAME_PATTERN may have drifted between demo-registry.js and this script.',
              ]
            : []),
        ...findOrderBijectionFailures(diskSlugs, diskSlugSet),
        ...findVintageKeyCollisions(diskSlugs, VINTAGE_URLS),
        ...findVintageUrlFailures(VINTAGE_URLS, diskSlugSet, RETIRED_SLUGS),
        ...[...NAV_HIDDEN_SLUGS]
            .filter((slug) => !diskSlugSet.has(slug))
            .map((slug) => `NAV_HIDDEN_SLUGS lists "${slug}" but src/${slug}.js is missing (stale entry)`),
        ...findHeaderTagFailures(registry),
        ...findMissingOgCardFailures(registry),
    ];

    if (errors.length > 0) {
        console.error('Demo registry check failed:\n');

        for (const message of errors) {
            console.error(`  - ${message}`);
        }

        console.error(`\n${errors.length} error(s). Fix plugins/demo-order.js, plugins/demo-vintage-urls.js,`);
        console.error('plugins/demo-registry.js (NAV_HIDDEN_SLUGS), or the matching src/*.js file(s).');
        console.error(`@description must be one line, ${DESCRIPTION_MIN_CHARS}-${DESCRIPTION_MAX_CHARS} characters.`);
        process.exit(1);
    }

    console.log(
        `Demo registry OK: ${diskSlugs.length} demos, ${Object.keys(VINTAGE_URLS).length} vintage URLs, ${NAV_HIDDEN_SLUGS.size} nav-hidden.`,
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main();
}
