import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
        let createCount = 0;

        beforeEach(() => {
            createCount = 0;

            vi.stubGlobal(
                'Image',
                class {
                    onload: (() => void) | null = null;
                    onerror: (() => void) | null = null;
                    width = 100;
                    height = 100;

                    private _src = '';

                    get src(): string {
                        return this._src;
                    }

                    set src(value: string) {
                        this._src = value;
                        createCount++;
                        this.onload?.();
                    }
                },
            );
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should load a single image from a URL', async () => {
            const img = await AssetLoader.loadImage('test.png');
            expect(img).toBeDefined();
            expect(AssetLoader.isLoaded('test.png')).toBe(true);
        });

        it('should return the cached image on subsequent calls', async () => {
            const first = await AssetLoader.loadImage('cached.png');
            const second = await AssetLoader.loadImage('cached.png');
            expect(second).toBe(first);
            expect(createCount).toBe(1);
        });

        it('should load multiple images in parallel', async () => {
            const images = await AssetLoader.loadImages(['img-a.png', 'img-b.png']);
            expect(images).toHaveLength(2);
            expect(AssetLoader.isLoaded('img-a.png')).toBe(true);
            expect(AssetLoader.isLoaded('img-b.png')).toBe(true);
        });

        it('should deduplicate concurrent requests for the same URL', async () => {
            const [first, second] = await Promise.all([
                AssetLoader.loadImage('shared.png'),
                AssetLoader.loadImage('shared.png'),
            ]);
            expect(first).toBe(second);
            expect(createCount).toBe(1);
        });
    });

    // #endregion
});
