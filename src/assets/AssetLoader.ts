// #region Module State

/**
 * Cache of loaded images by URL.
 * Prevents reloading the same image multiple times.
 */
const loadedImages = new Map<string, HTMLImageElement>();

/**
 * Map of in-progress image load promises by URL.
 * Deduplicates concurrent requests for the same image.
 */
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

// #endregion

/**
 * Simple asset loader for images and other resources.
 * Provides caching and parallel loading capabilities.
 */
export class AssetLoader {
    // #region Image loading

    /**
     * Loads an image from a URL with automatic caching.
     * Returns cached image immediately if already loaded.
     * Deduplicates concurrent requests for the same URL.
     *
     * @param url - Path or URL to the image file.
     * @returns Promise resolving to the loaded HTMLImageElement.
     * @throws Error if image fails to load.
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
     * Loads multiple images in parallel for faster loading.
     * All images are loaded concurrently using Promise.all.
     *
     * @param urls - Array of image paths or URLs.
     * @returns Promise resolving to an array of loaded images in same order.
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
     * @returns True if image is in cache and ready to use.
     */
    static isLoaded(url: string): boolean {
        return loadedImages.has(url);
    }

    /**
     * Gets a previously loaded image from the cache.
     * Doesn't trigger a new load if not found.
     *
     * @param url - Path or URL of the cached image.
     * @returns The cached image, or null if not loaded.
     */
    static getImage(url: string): HTMLImageElement | null {
        return loadedImages.get(url) || null;
    }

    /**
     * Clears all in-memory caches. In-flight image requests aren't aborted
     * and may repopulate the cache once complete.
     *
     * @returns void
     */
    static clear(): void {
        loadedImages.clear();
        loadingPromises.clear();
    }

    // #endregion
}
