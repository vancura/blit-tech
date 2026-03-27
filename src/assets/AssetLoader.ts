// #region Module State

/**
 * Successfully loaded images keyed by request URL.
 *
 * This acts as the resolved asset cache for callers that want instant reuse of
 * images that have already completed loading.
 */
const loadedImages = new Map<string, HTMLImageElement>();

/**
 * In-flight image requests keyed by request URL.
 *
 * Keeping pending promises here lets concurrent callers share the same browser
 * load rather than creating duplicate `Image` instances for the same asset.
 */
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

// #endregion

/**
 * Shared image-loading utility for runtime asset code.
 *
 * `AssetLoader` exposes a small static API that:
 * - loads individual images or batches of images
 * - caches successfully resolved `HTMLImageElement` instances by URL
 * - deduplicates concurrent requests for the same URL
 * - exposes cache inspection and reset helpers for engine code and tests
 */
export class AssetLoader {
    // #region Image loading

    /**
     * Loads an image and caches the resolved element by URL.
     *
     * Reuses an already-cached image immediately and shares a single in-flight
     * promise when multiple callers request the same URL concurrently.
     *
     * @param url - Path or URL to the image file.
     * @returns Loaded image element for the requested URL.
     * @throws Error if the image cannot be loaded.
     */
    static async loadImage(url: string): Promise<HTMLImageElement> {
        // Return cached image if available.
        const cachedImage = loadedImages.get(url);

        if (cachedImage) {
            return cachedImage;
        }

        // Return existing promise if already loading.
        const existingPromise = loadingPromises.get(url);

        if (existingPromise) {
            return existingPromise;
        }

        // Start loading.
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                loadedImages.set(url, img);
                loadingPromises.delete(url);
                resolve(img);
            };

            img.onerror = () => {
                loadingPromises.delete(url);
                reject(new Error(`Failed to load image: ${url}`));
            };

            img.src = url;
        });

        loadingPromises.set(url, promise);

        return promise;
    }

    /**
     * Loads multiple images concurrently.
     *
     * @param urls - Array of image paths or URLs.
     * @returns Loaded image elements in the same order as `urls`.
     * @throws Error if any requested image fails to load.
     */
    static async loadImages(urls: string[]): Promise<HTMLImageElement[]> {
        return Promise.all(urls.map((url) => AssetLoader.loadImage(url)));
    }

    // #endregion

    // #region Cache Management

    /**
     * Checks if an image is already loaded and cached.
     *
     * @param url - Path or URL to check.
     * @returns `true` if the image is already cached and ready to use.
     */
    static isLoaded(url: string): boolean {
        return loadedImages.has(url);
    }

    /**
     * Returns a previously loaded image from the cache without starting a new request.
     *
     * @param url - Path or URL of the cached image.
     * @returns The cached image, or null if not loaded.
     */
    static getImage(url: string): HTMLImageElement | null {
        return loadedImages.get(url) ?? null;
    }

    /**
     * Clears all in-memory caches. In-flight image requests aren't aborted
     * and may repopulate the cache once complete.
     *
     * Primarily intended for tests or explicit asset-lifecycle resets.
     */
    static clear(): void {
        loadedImages.clear();
        loadingPromises.clear();
    }

    // #endregion
}
