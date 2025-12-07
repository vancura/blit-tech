import type { Rect2i } from '../utils/Rect2i';
import { Vector2i } from '../utils/Vector2i';
import { AssetLoader } from './AssetLoader';

/**
 * Sprite sheet asset for GPU-accelerated sprite rendering.
 * Manages an image and its corresponding GPU texture.
 * Provides UV coordinate calculation for sprite regions.
 */
export class SpriteSheet {
    // #region Module State

    /** Source HTML image element. */
    private image: HTMLImageElement;

    /** Pre-decoded image bitmap for GPU upload (created by load()). */
    private imageBitmap: ImageBitmap | null = null;

    /** GPU texture created lazily on first use. */
    private texture: GPUTexture | null = null;

    /** Sprite sheet dimensions in pixels. */
    public readonly size: Vector2i;

    // #endregion

    // #region Constructor

    /**
     * Creates a sprite sheet from a loaded image.
     * Use the static load() method for easier loading from URL.
     *
     * @param image - Pre-loaded HTMLImageElement.
     */
    constructor(image: HTMLImageElement) {
        this.image = image;
        this.size = new Vector2i(image.width, image.height);
    }

    // #endregion

    // #region Static Factory

    /**
     * Loads a sprite sheet from an image URL.
     * Creates an ImageBitmap with proper alpha handling for pixel-perfect rendering.
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

    // #endregion

    // #region Accessors

    // noinspection JSUnusedGlobalSymbols
    /**
     * Gets the source HTMLImageElement.
     *
     * @returns The underlying image element.
     */
    getImage(): HTMLImageElement {
        return this.image;
    }

    /**
     * Gets or lazily creates the GPU texture for this sprite sheet.
     * Texture is created on first access and cached for the reuse.
     *
     * @param device - WebGPU device for texture creation.
     * @returns GPU texture ready for rendering.
     */
    getTexture(device: GPUDevice): GPUTexture {
        if (!this.texture) {
            this.createTexture(device);
        }

        // Safe assertion: createTexture always initializes this.texture.
        return this.texture as GPUTexture;
    }

    // #endregion

    // #region Texture Creation

    /**
     * Creates and uploads the GPU texture from the image.
     * Uses ImageBitmap if available (from load()), otherwise falls back to HTMLImageElement.
     *
     * @param device - WebGPU device for texture creation.
     */
    private createTexture(device: GPUDevice): void {
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

    // noinspection JSUnusedGlobalSymbols
    /**
     * Releases the GPU texture from memory.
     * Call when the sprite sheet is no longer needed.
     *
     * @returns void
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
    }
}
