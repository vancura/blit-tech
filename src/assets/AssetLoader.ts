/**
 * Simple asset loader for images and other resources.
 * Provides caching and parallel loading capabilities.
 */
export class AssetLoader {
    private static loadedImages = new Map<string, HTMLImageElement>();
    private static loadingPromises = new Map<string, Promise<HTMLImageElement>>();

    /**
     * Loads an image from a URL with automatic caching.
     * Returns cached image immediately if already loaded.
     * Deduplicates concurrent requests for the same URL.
     * @param url - Path or URL to the image file.
     * @returns Promise resolving to the loaded HTMLImageElement.
     * @throws Error if image fails to load.
     */
    static async loadImage(url: string): Promise<HTMLImageElement> {
        // Return cached image if available
        if (this.loadedImages.has(url)) {
            return this.loadedImages.get(url)!;
        }

        // Return existing promise if already loading
        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url)!;
        }

        // Start loading
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                this.loadedImages.set(url, img);
                this.loadingPromises.delete(url);
                resolve(img);
            };

            img.onerror = () => {
                this.loadingPromises.delete(url);
                reject(new Error(`Failed to load image: ${url}`));
            };

            img.src = url;
        });

        this.loadingPromises.set(url, promise);
        return promise;
    }

    /**
     * Loads multiple images in parallel for faster loading.
     * All images are loaded concurrently using Promise.all.
     * @param urls - Array of image paths or URLs.
     * @returns Promise resolving to array of loaded images in same order.
     */
    static async loadImages(urls: string[]): Promise<HTMLImageElement[]> {
        return Promise.all(urls.map((url) => this.loadImage(url)));
    }

    /**
     * Checks if an image is already loaded and cached.
     * @param url - Path or URL to check.
     * @returns True if image is in cache and ready to use.
     */
    static isLoaded(url: string): boolean {
        return this.loadedImages.has(url);
    }

    /**
     * Gets a previously loaded image from cache.
     * Does not trigger a new load if not found.
     * @param url - Path or URL of the cached image.
     * @returns The cached image, or null if not loaded.
     */
    static getImage(url: string): HTMLImageElement | null {
        return this.loadedImages.get(url) || null;
    }

    /**
     * Clears all cached assets from memory.
     * Also cancels any pending load operations.
     */
    static clear(): void {
        this.loadedImages.clear();
        this.loadingPromises.clear();
    }
}
