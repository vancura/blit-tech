import { afterEach, describe, expect, it } from 'vitest';

import { AssetLoader } from './AssetLoader';

afterEach(() => {
    AssetLoader.clear();
});

// #region Cache Management

describe('AssetLoader', () => {
    describe('cache management', () => {
        it('should report isLoaded as false for an unloaded URL', () => {
            expect(AssetLoader.isLoaded('never-loaded.png')).toBe(false);
        });

        it('should return null from getImage for an unloaded URL', () => {
            expect(AssetLoader.getImage('never-loaded.png')).toBeNull();
        });

        it('should clear the cache', () => {
            // Verify clear doesn't throw on empty cache.
            AssetLoader.clear();
            expect(AssetLoader.isLoaded('test.png')).toBe(false);
        });

        it('should report getImage as null after clear', () => {
            AssetLoader.clear();
            expect(AssetLoader.getImage('any-url.png')).toBeNull();
        });
    });

    // #endregion

    // #region Image Loading

    describe('image loading', () => {
        // Image loading tests are skipped in Node/happy-dom because
        // Image.onload does not fire for data URIs in this environment.
        // These are covered by Playwright visual regression tests.

        it.todo('should load a single image from a URL');
        it.todo('should return the cached image on subsequent calls');
        it.todo('should load multiple images in parallel');
        it.todo('should deduplicate concurrent requests');
    });

    // #endregion
});
