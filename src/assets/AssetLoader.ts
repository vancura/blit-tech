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

// #region Error Helpers

/**
 * Returns whether a URL is absolute or uses a special browser scheme.
 *
 * @param url - Path or URL to inspect.
 * @returns True when the URL already has an explicit scheme.
 */
function isExplicitUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return (
        lowerUrl.startsWith('//') ||
        lowerUrl.includes('://') ||
        lowerUrl.startsWith('data:') ||
        lowerUrl.startsWith('blob:')
    );
}

/**
 * Appends beginner-friendly path and extension hints for image URLs.
 *
 * @param url - Failing image path.
 * @returns Extra hint text (or empty string when no hint applies).
 */
function buildImageHints(url: string): string {
    const hints: string[] = [];

    if (!isExplicitUrl(url) && !url.startsWith('/') && !url.startsWith('./')) {
        hints.push(`Did you mean '/images/${url}' or './images/${url}'?`);
    }

    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    let cleanUrl = url;
    const cutIndex = queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);

    if (cutIndex !== -1) {
        cleanUrl = url.slice(0, cutIndex);
    }

    const slashIndex = cleanUrl.lastIndexOf('/');
    const fileName = slashIndex >= 0 ? cleanUrl.slice(slashIndex + 1) : cleanUrl;
    const dotIndex = fileName.lastIndexOf('.');
    const extension = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
    const knownImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

    if (extension === '.btfont') {
        hints.push("This looks like a font file. For images, use a file that ends with '.png'.");
    } else if (extension !== '' && !knownImageExtensions.has(extension)) {
        hints.push(`The extension '${extension}' does not look like an image file. Did you mean '.png'?`);
    }

    return hints.length > 0 ? ` ${hints.join(' ')}` : '';
}

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
                reject(
                    new Error(
                        `Can't find the image '${url}'. Make sure it's in your project folder and the path is correct.` +
                            buildImageHints(url),
                    ),
                );
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
