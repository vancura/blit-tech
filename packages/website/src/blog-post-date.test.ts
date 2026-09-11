/**
 * Covers `getPostDate`, the frontmatter `date` reader `feedPlugin` and the blog index share,
 * and `blogPostDateAdapter`, which hands the same reader to fumapress's own blog layouts.
 *
 * The function exists because `date` crosses the Vite dev/RSC boundary as an ISO string rather
 * than the `Date` the framework adapter looks for, so both representations have to work. The
 * epoch case is the one worth keeping: `0` is a valid timestamp and a falsy number, so a
 * truthiness check instead of a `NaN` check would silently drop it.
 */

import { describe, expect, it } from 'vitest';
import { blogPostDateAdapter, getPostDate } from './blog-post-date';

describe('getPostDate', () => {
    describe('accepts', () => {
        it('a Date instance, returned unchanged', () => {
            const date = new Date('2026-07-04T12:00:00.000Z');

            expect(getPostDate({ data: { date } })).toBe(date);
        });

        it('an ISO string', () => {
            expect(getPostDate({ data: { date: '2026-07-04' } })?.toISOString()).toBe('2026-07-04T00:00:00.000Z');
        });

        it('an epoch number', () => {
            expect(getPostDate({ data: { date: 1_767_225_600_000 } })?.getTime()).toBe(1_767_225_600_000);
        });

        it('the epoch itself, which is falsy but valid', () => {
            expect(getPostDate({ data: { date: 0 } })?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
        });
    });

    describe('rejects', () => {
        it.each([
            ['an invalid Date instance', new Date('nope')],
            ['a string that cannot be parsed', 'not a date'],
            ['NaN', Number.NaN],
            ['null', null],
            ['a boolean', true],
            ['an object', {}],
        ])('%s', (_label, date) => {
            expect(getPostDate({ data: { date } })).toBeUndefined();
        });

        it('frontmatter with no date field', () => {
            expect(getPostDate({ data: {} })).toBeUndefined();
        });

        it.each([
            ['null data', null],
            ['undefined data', undefined],
        ])('%s', (_label, data) => {
            expect(getPostDate({ data })).toBeUndefined();
        });
    });
});

/**
 * Regression guard for the tag pages (`/blog/tags/<tag>`), which are fumapress's stock
 * `createBlogTagPage()`. Its `OrderedBlogGrid` resolves each card's date through the adapter
 * chain and substitutes `new Date(Date.now())` when nothing answers, so before this adapter
 * existed every card on every tag page showed today's date while `/blog` showed the right one.
 * The ISO-string case is the one that regressed: it is what an `async: true` doc collection
 * actually puts in `page.data.date`, and the mdx adapter's `instanceof Date` check misses it.
 */
describe('blogPostDateAdapter', () => {
    // The hook declares a fumapress `AppContext` `this` it never reads (it only touches its
    // `page` argument), so the tests bind a placeholder rather than building a real context.
    const CONTEXT = {} as never;
    const getCreationDate = blogPostDateAdapter()['core:get-creation-date'];

    it('implements core:get-creation-date', () => {
        expect(getCreationDate).toBeTypeOf('function');
    });

    it('resolves an ISO-string date, which the mdx adapter drops', () => {
        const page = { data: { date: '2026-07-13T00:00:00.000Z' } } as never;

        expect((getCreationDate?.call(CONTEXT, page) as Date | undefined)?.toISOString()).toBe(
            '2026-07-13T00:00:00.000Z',
        );
    });

    it('resolves a Date instance unchanged', () => {
        const date = new Date('2026-09-01T00:00:00.000Z');
        const page = { data: { date } } as never;

        expect(getCreationDate?.call(CONTEXT, page)).toBe(date);
    });

    it.each([
        ['a page with no date frontmatter', {}],
        ['a page whose date cannot be parsed', { date: 'not a date' }],
    ])('returns undefined for %s, leaving the next adapter to answer', (_label, data) => {
        expect(getCreationDate?.call(CONTEXT, { data } as never)).toBeUndefined();
    });
});
