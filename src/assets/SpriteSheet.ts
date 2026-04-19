import { Color32 } from '../utils/Color32';
import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { AssetLoader } from './AssetLoader';
import type { Palette } from './Palette';

/**
 * Sprite-sheet wrapper around a loaded image asset.
 *
 * The class keeps the original image available for CPU-side inspection while
 * lazily creating and caching a GPU texture for rendering. When possible,
 * `load()` also pre-decodes the source into an `ImageBitmap` so texture uploads
 * preserve pixel-art alpha and color values more reliably.
 *
 * After calling `indexize()`, the sheet stores palette indices rather than RGBA
 * data. The GPU texture becomes an `r8uint` format uploaded via `writeTexture`.
 * The original RGBA bytes are retained so `reindexize()` can re-convert without
 * reloading the image.
 */
export class SpriteSheet {
    // #region Module State

    /** Sprite sheet dimensions in pixels. */
    public readonly size: Vector2i;

    /** Source HTML image element (null for sheets created from raw indexed data). */
    private readonly image: HTMLImageElement | null;

    /** Pre-decoded image bitmap for GPU upload (created by load()). */
    private imageBitmap: ImageBitmap | null = null;

    /** GPU texture created lazily on first use. */
    private texture: GPUTexture | null = null;

    /** Retained original RGBA pixel data (set by indexize, used by reindexize). */
    private rgbaPixels: Uint8Array<ArrayBuffer> | null = null;

    /** Palette index per pixel (set by indexize, uploaded as r8uint texture). */
    private indexedPixels: Uint8Array<ArrayBuffer> | null = null;

    // #endregion

    // #region Constructor

    /**
     * Creates a sprite sheet from a loaded image.
     * Use the static load() method for easier loading from URL.
     *
     * @param image - Pre-loaded HTMLImageElement, or null for raw indexed data sheets.
     * @param size - Explicit dimensions (required when image is null).
     */
    constructor(image: HTMLImageElement | null, size?: Vector2i) {
        this.image = image;

        if (image) {
            this.size = new Vector2i(image.width, image.height);
        } else if (size) {
            this.size = size;
        } else {
            throw new Error('[SpriteSheet] Either an image or explicit size must be provided.');
        }
    }

    // #endregion

    // #region Static Factory

    /**
     * Loads a sprite sheet from an image URL.
     *
     * Attempts to create an `ImageBitmap` with explicit alpha and color-space
     * settings for more predictable GPU uploads. If bitmap creation fails, the
     * instance still works and falls back to uploading the `HTMLImageElement`.
     *
     * @param url - Path or URL to the image file.
     * @returns Promise resolving to the loaded SpriteSheet.
     */
    static async load(url: string): Promise<SpriteSheet> {
        const image = await AssetLoader.loadImage(url);
        const sheet = new SpriteSheet(image);

        // Create ImageBitmap with explicit alpha handling.
        // - premultiplyAlpha: 'none' preserves original alpha values (avoids dark fringes)
        // - colorSpaceConversion: 'none' preserves exact RGB values for pixel art
        try {
            sheet.imageBitmap = await createImageBitmap(image, {
                premultiplyAlpha: 'none',
                colorSpaceConversion: 'none',
            });
        } catch (error) {
            // Fall back to HTMLImageElement if ImageBitmap creation fails.
            console.warn(
                `[SpriteSheet] ImageBitmap creation failed for ${url}, using HTMLImageElement fallback:`,
                error,
            );
        }

        return sheet;
    }

    /**
     * Walks a PNG's pixels and registers every unique opaque color into the
     * supplied palette starting at `startSlot`.
     *
     * Pixels with alpha 0 are skipped — they map to the engine's transparent
     * sentinel slot 0 at draw time. Opaque pixels are deduplicated on RGB and
     * stored with alpha forced to 255, matching the lookup performed by
     * `indexize()` so a subsequent `sheet.indexize(palette)` call resolves
     * without throwing on missing colors.
     *
     * By default colors are sorted darkest-first by perceived luminance
     * (`0.299*r + 0.587*g + 0.114*b`); pass `{ sort: 'none' }` to keep the
     * row-major scan order of the source image.
     *
     * Image loading goes through {@link AssetLoader.loadImage}, so the call
     * shares cache and in-flight deduplication with {@link SpriteSheet.load}.
     *
     * The destination range is validated before any write, so the palette is
     * never left partially mutated: if the collected colors would not fit
     * (`startSlot < 1` or `startSlot + count > palette.size`), the method
     * throws without touching any slot.
     *
     * @param url - Path or URL to the PNG file.
     * @param palette - Target palette to populate.
     * @param startSlot - First palette slot to write into.
     * @param options - Optional configuration.
     * @param options.sort - Color ordering. Defaults to `'luminance'`.
     * @returns Registered colors in palette-write order.
     * @throws Error if the image cannot be loaded.
     * @throws RangeError if the discovered colors do not fit in the palette starting at `startSlot`.
     */
    static async loadColorsIntoPalette(
        url: string,
        palette: Palette,
        startSlot: number,
        options?: { sort?: 'luminance' | 'none' },
    ): Promise<Color32[]> {
        const image = await AssetLoader.loadImage(url);
        const w = image.width;
        const h = image.height;

        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0);

        const { data } = ctx.getImageData(0, 0, w, h);

        const seen = new Set<number>();
        const collected: Color32[] = [];

        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3] ?? 0;

            if (a === 0) {
                continue;
            }

            // eslint-disable-next-line security/detect-object-injection
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;

            // Pack RGB into a single 24-bit integer for fast Set lookup.
            const key = (r << 16) | (g << 8) | b;

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            collected.push(new Color32(r, g, b, 255));
        }

        const sortMode = options?.sort ?? 'luminance';

        if (sortMode === 'luminance') {
            collected.sort((c1, c2) => {
                const l1 = c1.r * 0.299 + c1.g * 0.587 + c1.b * 0.114;
                const l2 = c2.r * 0.299 + c2.g * 0.587 + c2.b * 0.114;
                return l1 - l2;
            });
        }

        // Validate the full destination range up front so a mid-loop palette.set()
        // throw (out-of-range slot, or opaque color at reserved slot 0) cannot
        // leave the palette partially mutated. All collected colors are opaque,
        // so startSlot must be at least 1.
        if (collected.length > 0) {
            if (startSlot < 1) {
                throw new RangeError(
                    `[SpriteSheet] loadColorsIntoPalette: startSlot ${startSlot} is invalid (slot 0 is reserved for transparency).`,
                );
            }

            const endSlot = startSlot + collected.length - 1;

            if (endSlot >= palette.size) {
                throw new RangeError(
                    `[SpriteSheet] loadColorsIntoPalette: ${collected.length} colors do not fit in palette size ${palette.size} starting at slot ${startSlot}.`,
                );
            }
        }

        collected.forEach((color, i) => {
            palette.set(startSlot + i, color);
        });

        return collected;
    }

    /**
     * Creates a sprite sheet from pre-computed palette-indexed pixel data.
     *
     * The resulting sheet is immediately indexized -- its `getTexture()` call
     * will produce an `r8uint` GPU texture without needing `indexize()`. This
     * is used for embedded assets like the built-in system font where the pixel
     * data is already expressed as palette indices.
     *
     * Sheets created this way do not support `indexize()` or `reindexize()`
     * because there is no source RGBA data to re-map.
     *
     * @param width - Texture width in pixels.
     * @param height - Texture height in pixels.
     * @param indexedPixels - Flat array of palette indices, one byte per pixel (row-major).
     * @returns Sprite sheet ready for rendering.
     */
    static fromIndexedPixels(width: number, height: number, indexedPixels: Uint8Array<ArrayBuffer>): SpriteSheet {
        const expectedLength = width * height;

        if (indexedPixels.length !== expectedLength) {
            throw new RangeError(
                `[SpriteSheet] indexedPixels length ${indexedPixels.length} does not match ${width}x${height} (expected ${expectedLength}).`,
            );
        }

        const sheet = new SpriteSheet(null, new Vector2i(width, height));

        sheet.indexedPixels = indexedPixels;

        return sheet;
    }

    // #endregion

    // #region Indexization

    /**
     * Converts the sprite sheet's RGBA pixels to palette indices.
     *
     * Each non-transparent pixel is looked up in the provided palette via exact
     * color matching. Index 0 is always transparent. The resulting indices are
     * stored internally; an `r8uint` GPU texture is created lazily on the next
     * `getTexture()` call.
     *
     * The original RGBA data is retained so `reindexize()` can re-convert after a
     * palette swap without reloading the image.
     *
     * @param palette - Active palette used for color-to-index mapping.
     * @throws If any opaque pixel's color is not present in the palette.
     */
    indexize(palette: Palette): void {
        if (!this.image) {
            throw new Error('[SpriteSheet] indexize: not available for sheets created from raw indexed data.');
        }

        const w = this.size.x;
        const h = this.size.y;

        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.image, 0, 0);

        const imageData = ctx.getImageData(0, 0, w, h);
        this.rgbaPixels = new Uint8Array(imageData.data.buffer.slice(0));

        const indexed = new Uint8Array(w * h);
        const rgba = this.rgbaPixels;

        for (let i = 0; i < w * h; i++) {
            const base = i * 4;
            const a = rgba[base + 3];

            if (a === 0) {
                // Index 0 is the transparent sentinel — the shader discards any pixel with rawIndex == 0.
                // eslint-disable-next-line security/detect-object-injection
                indexed[i] = 0;
                continue;
            }

            // eslint-disable-next-line security/detect-object-injection
            const r = rgba[base] ?? 0;
            const g = rgba[base + 1] ?? 0;
            const b = rgba[base + 2] ?? 0;
            const color = new Color32(r, g, b, 255);
            const index = palette.findColor(color);

            if (index === -1) {
                const hex =
                    '#' +
                    r.toString(16).padStart(2, '0') +
                    g.toString(16).padStart(2, '0') +
                    b.toString(16).padStart(2, '0');
                const x = i % w;
                const y = Math.floor(i / w);
                const src = this.image.src ? `'${this.image.src}'` : '(unnamed)';
                throw new Error(
                    `[SpriteSheet] ${src} pixel at (${x}, ${y}) has color ${hex} which is not in the active palette.` +
                        ` Add this color to the palette before indexizing.`,
                );
            }

            // eslint-disable-next-line security/detect-object-injection
            indexed[i] = index;
        }

        this.indexedPixels = indexed;

        // Invalidate any existing texture so getTexture() re-creates as r8uint.
        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }
    }

    /**
     * Re-converts retained RGBA pixels to palette indices using a new palette.
     *
     * Use this only when the **slot layout** of the palette has changed — that is,
     * when the same colors now live at different index positions. It works by
     * replaying the original RGBA data through `palette.findColor()` and assigning
     * each opaque pixel the index of its matching color in the new palette.
     *
     * **Do not call this to change what color a slot displays.** If you only want
     * to swap the visible color at a slot (e.g. animate a fire effect), mutate the
     * palette entry directly — the stored indices remain valid and the fragment
     * shader picks up the new color automatically on the next frame:
     *
     * ```ts
     * // Palette-value swap: change what a slot looks like.
     * // The sprite's stored indices are unchanged; no reindexize needed.
     * palette.set(FIRE_SLOT, Color32.fromHex('#ff4400'));
     * BT.paletteSet(palette);
     * ```
     *
     * ```ts
     * // Palette-layout swap: same colors, different slot positions.
     * // Sprite indices now point to wrong slots, so reindexize is required.
     * sheet.reindexize(newLayoutPalette);
     * // Or for all sheets at once:
     * BT.paletteSet(newLayoutPalette);
     * BT.spritesRefresh();
     * ```
     *
     * If the new palette does not contain a pixel's original RGBA value,
     * `palette.findColor()` returns `-1` and `reindexize()` throws an `Error`
     * with the offending color and coordinates, e.g.:
     * `[SpriteSheet] 'sheet.png' pixel at (x, y) has color #rrggbb which is not in the active palette.`
     *
     * Must be preceded by a call to `indexize()`. The GPU texture is invalidated and
     * re-created on the next `getTexture()` call.
     *
     * @param palette - New palette used for color-to-index mapping.
     * @throws If `indexize()` has not been called yet.
     * @throws If any opaque pixel's color is not found in the new palette.
     */
    reindexize(palette: Palette): void {
        if (!this.image) {
            throw new Error('[SpriteSheet] reindexize: not available for sheets created from raw indexed data.');
        }

        if (this.rgbaPixels === null) {
            throw new Error('[SpriteSheet] reindexize: indexize() must be called before reindexize().');
        }

        const w = this.size.x;
        const h = this.size.y;
        const indexed = new Uint8Array(w * h);
        const rgba = this.rgbaPixels;

        for (let i = 0; i < w * h; i++) {
            const base = i * 4;
            const a = rgba[base + 3];

            if (a === 0) {
                // Index 0 is the transparent sentinel — the shader discards any pixel with rawIndex == 0.
                // eslint-disable-next-line security/detect-object-injection
                indexed[i] = 0;
                continue;
            }

            // eslint-disable-next-line security/detect-object-injection
            const r = rgba[base] ?? 0;
            const g = rgba[base + 1] ?? 0;
            const b = rgba[base + 2] ?? 0;
            const color = new Color32(r, g, b, 255);
            const index = palette.findColor(color);

            if (index === -1) {
                const hex =
                    '#' +
                    r.toString(16).padStart(2, '0') +
                    g.toString(16).padStart(2, '0') +
                    b.toString(16).padStart(2, '0');
                const x = i % w;
                const y = Math.floor(i / w);
                const src = this.image.src ? `'${this.image.src}'` : '(unnamed)';
                throw new Error(
                    `[SpriteSheet] ${src} pixel at (${x}, ${y}) has color ${hex} which is not in the active palette.` +
                        ` Add this color to the palette before reindexizing.`,
                );
            }

            // eslint-disable-next-line security/detect-object-injection
            indexed[i] = index;
        }

        this.indexedPixels = indexed;

        // Invalidate GPU texture; it will be re-created as r8uint on next getTexture().
        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }
    }

    /**
     * Returns whether this sprite sheet has been converted to palette indices.
     *
     * @returns True if `indexize()` has been called successfully.
     */
    isIndexized(): boolean {
        return this.indexedPixels !== null;
    }

    // #endregion

    // #region Accessors

    /**
     * Gets the source HTMLImageElement.
     *
     * @returns The underlying image element.
     * @throws If the sheet was created from raw indexed data (no source image).
     */
    getImage(): HTMLImageElement {
        if (!this.image) {
            throw new Error('[SpriteSheet] getImage: not available for sheets created from raw indexed data.');
        }

        return this.image;
    }

    /**
     * Gets or lazily creates the GPU texture for this sprite sheet.
     *
     * If `indexize()` has been called, creates an `r8uint` texture from the
     * palette index data. Otherwise creates an `rgba8unorm` texture from the
     * original image. The result is cached until `destroy()` is called.
     *
     * @param device - WebGPU device for texture creation.
     * @returns GPU texture ready for rendering.
     */
    getTexture(device: GPUDevice): GPUTexture {
        if (this.indexedPixels !== null && this.texture === null) {
            this.createIndexedTexture(device);
        } else if (this.texture === null) {
            this.createTexture(device);
        }

        // Safe assertion: createTexture / createIndexedTexture always initializes this.texture.
        return this.texture as GPUTexture;
    }

    // #endregion

    // #region UV Calculation

    /**
     * Calculates normalized UV coordinates for a sprite region.
     * Converts pixel coordinates to 0.0-1.0 texture coordinate range.
     *
     * @param rect - Source rectangle in pixel coordinates.
     * @returns Object with u0, v0 (top-left) and u1, v1 (bottom-right) UV coordinates.
     */
    getUVs(rect: Rect2i): { u0: number; v0: number; u1: number; v1: number } {
        return {
            u0: rect.x / this.size.x,
            v0: rect.y / this.size.y,
            u1: (rect.x + rect.width) / this.size.x,
            v1: (rect.y + rect.height) / this.size.y,
        };
    }

    // #endregion

    // #region Cleanup

    /**
     * Releases the GPU texture from memory and clears all retained pixel data.
     *
     * Also closes any retained `ImageBitmap` that has not yet been uploaded.
     * After calling this method, a subsequent `getTexture()` call will recreate
     * the GPU texture from the original image.
     */
    destroy(): void {
        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }

        if (this.imageBitmap) {
            this.imageBitmap.close();
            this.imageBitmap = null;
        }

        this.rgbaPixels = null;
        this.indexedPixels = null;
    }

    // #endregion

    // #region Texture Creation

    /**
     * Creates and uploads the GPU texture from the image.
     *
     * Uses `ImageBitmap` when available, then releases it immediately after the
     * upload to avoid holding duplicate image resources in memory.
     *
     * @param device - WebGPU device for texture creation.
     */
    private createTexture(device: GPUDevice): void {
        if (!this.image) {
            throw new Error('[SpriteSheet] createTexture: no source image available.');
        }

        this.texture = device.createTexture({
            label: 'Sprite Sheet Texture',
            size: [this.size.x, this.size.y, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Prefer ImageBitmap (correct alpha handling) over HTMLImageElement.
        const source = this.imageBitmap ?? this.image;

        device.queue.copyExternalImageToTexture({ source }, { texture: this.texture }, [this.size.x, this.size.y]);

        // Close ImageBitmap after the upload to free resources.
        if (this.imageBitmap) {
            this.imageBitmap.close();
            this.imageBitmap = null;
        }
    }

    /**
     * Creates and uploads an `r8uint` GPU texture from the palette index data.
     *
     * Called lazily by `getTexture()` after `indexize()` has been invoked.
     * Uses `writeTexture` because `r8uint` does not support `copyExternalImageToTexture`.
     *
     * @param device - WebGPU device for texture creation.
     */
    private createIndexedTexture(device: GPUDevice): void {
        this.texture = device.createTexture({
            label: 'Sprite Sheet Indexed Texture',
            size: [this.size.x, this.size.y, 1],
            format: 'r8uint',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        // Safe assertion: createIndexedTexture is only called when indexedPixels !== null.
        device.queue.writeTexture(
            { texture: this.texture },
            this.indexedPixels as Uint8Array<ArrayBuffer>,
            { bytesPerRow: this.size.x },
            [this.size.x, this.size.y, 1],
        );
    }

    // #endregion
}
