/**
 * Unit tests for {@link AssetLoader}.
 *
 * Verifies the image-loading contract exposed to the rest of the asset
 * pipeline:
 * - cache inspection and reset helpers
 * - single, batched, and concurrent image loads
 * - deduplication of in-flight requests
 * - rejection and cache cleanup when loads fail
 *
 * Browser image loading is simulated with stubbed `Image` globals so the suite
 * stays deterministic and does not depend on network or DOM behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetLoader } from './AssetLoader';

afterEach(() => {
    AssetLoader.clear();
});

describe('AssetLoader', () => {
    // #region Cache Management

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

        it('should report getImage as null after clear', async () => {
            vi.stubGlobal(
                'Image',
                class {
                    onload: (() => void) | null = null;
                    onerror: (() => void) | null = null;
                    width = 100;
                    height = 100;

                    set src(_: string) {
                        this.onload?.();
                    }
                },
            );

            try {
                await AssetLoader.loadImage('before-clear.png');

                expect(AssetLoader.isLoaded('before-clear.png')).toBe(true);

                AssetLoader.clear();

                expect(AssetLoader.getImage('before-clear.png')).toBeNull();
            } finally {
                vi.unstubAllGlobals();
            }
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

    // #region Error Handling

    describe('error handling', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'Image',
                class {
                    onload: (() => void) | null = null;
                    onerror: (() => void) | null = null;
                    private _src = '';

                    get src(): string {
                        return this._src;
                    }

                    set src(value: string) {
                        this._src = value;

                        // Simulate error for URLs containing 'fail'
                        if (value.includes('fail')) {
                            this.onerror?.();
                        } else {
                            this.onload?.();
                        }
                    }
                },
            );
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should reject when the image fails to load', async () => {
            await expect(AssetLoader.loadImage('fail.png')).rejects.toThrow('Failed to load image: fail.png');
        });

        it('should not cache images that failed to load', async () => {
            try {
                await AssetLoader.loadImage('fail.png');
            } catch {
                // Expected
            }

            expect(AssetLoader.isLoaded('fail.png')).toBe(false);
            expect(AssetLoader.getImage('fail.png')).toBeNull();
        });

        it('should reject loadImages when any image fails', async () => {
            await expect(AssetLoader.loadImages(['ok.png', 'fail.png'])).rejects.toThrow(
                'Failed to load image: fail.png',
            );
        });
    });

    // #endregion
});
