/**
 * Palette asset implementation for palette-first rendering.
 *
 * The class stores mutable indexed {@link Color32} entries, supports named
 * index aliases, handles serialization, and exposes fixed-layout conversion
 * helpers used by the upcoming GPU palette uniform pipeline.
 */

import { Color32 } from '../utils/Color32';
import { C64_HEX, CGA_HEX, GAMEBOY_HEX, NES_HEX, PICO8_HEX, VGA_HEX } from './palettes/presetData';

/** Supported palette sizes exposed by the public API. */
const VALID_PALETTE_SIZES = [2, 4, 16, 32, 64, 128, 256] as const;

/** Uniform-buffer slot count used by the renderer regardless of active palette size. */
const GPU_PALETTE_SIZE = 256;

/** Number of normalized floats stored per palette color in GPU upload buffers. */
const GPU_FLOATS_PER_COLOR = 4;

/**
 * JSON-serializable palette payload.
 *
 * `colors` stores `#RRGGBBAA` values and `names` maps friendly aliases to
 * palette indices.
 */
type PaletteJSON = {
    colors: string[];
    names?: Record<string, number>;
    size: number;
};

/**
 * Checks whether a palette size is one of the supported indexed formats.
 *
 * @param size - Candidate palette size.
 * @returns `true` when the size is supported.
 */
function isValidPaletteSize(size: number): boolean {
    return VALID_PALETTE_SIZES.includes(size as (typeof VALID_PALETTE_SIZES)[number]);
}

/**
 * Validates a palette size and throws for unsupported values.
 *
 * @param size - Palette size to validate.
 * @throws Error if the size is not one of the supported indexed formats.
 */
function validatePaletteSize(size: number): void {
    if (!isValidPaletteSize(size)) {
        throw new Error(`Invalid palette size: ${size}. Must be 2, 4, 16, 32, 64, 128, or 256.`);
    }
}

/**
 * Reads a preset or serialized hex color string at a known index.
 *
 * @param hexColors - Source hex color collection.
 * @param index - Entry index to read.
 * @param context - Human-readable context for thrown errors.
 * @returns Hex color string.
 * @throws Error if the requested entry is missing.
 */
function readHexColor(hexColors: readonly string[], index: number, context: string): string {
    // eslint-disable-next-line security/detect-object-injection -- Index is validated by the preset/serialization loops before access
    const hex = hexColors[index];

    if (hex === undefined) {
        throw new Error(`${context} color ${index} is missing`);
    }

    return hex;
}

/**
 * Reads a byte from a typed array and throws if it is unexpectedly missing.
 *
 * @param data - Source byte array.
 * @param index - Byte index to read.
 * @returns Byte value.
 * @throws Error if the requested byte is missing.
 */
function readByte(data: Uint8Array, index: number): number {
    // eslint-disable-next-line security/detect-object-injection -- Index is derived from validated RGB triplet offsets
    const value = data[index];

    if (value === undefined) {
        throw new Error(`Palette byte ${index} is missing`);
    }

    return value;
}

/**
 * Creates a palette preset from hex color data.
 *
 * Index `0` remains the reserved transparent entry. Preset data therefore
 * begins at index `1`.
 *
 * @param hexColors - Preset color data in `RRGGBB` format.
 * @param size - Palette size to construct.
 * @returns New palette populated with the preset colors.
 */
function createPreset(hexColors: readonly string[], size: number): Palette {
    const palette = new Palette(size);

    for (let i = 1; i < Math.min(size, hexColors.length); i++) {
        palette.set(i, Color32.fromHex(readHexColor(hexColors, i, 'Palette preset')));
    }

    return palette;
}

/**
 * Mutable palette of indexed {@link Color32} entries.
 */
export class Palette {
    /** Number of usable palette entries. */
    public readonly size: number;

    /** Mutable indexed color entries. Index `0` is always transparent. */
    public readonly colors: Color32[];

    /** Optional human-readable aliases for palette indices. */
    private readonly namedIndices = new Map<string, number>();

    /**
     * Creates a new palette with the requested indexed size.
     *
     * @param size - Palette size. Must be one of `2, 4, 16, 32, 64, 128, 256`.
     */
    constructor(size: number = GPU_PALETTE_SIZE) {
        validatePaletteSize(size);

        this.size = size;
        this.colors = new Array<Color32>(size);
        this.colors[0] = Color32.transparent();

        for (let i = 1; i < size; i++) {
            // eslint-disable-next-line security/detect-object-injection -- Constructor initializes all indices from 1 to size - 1
            this.colors[i] = Color32.black().clone();
        }
    }

    /**
     * Reconstructs a palette from JSON data produced by {@link Palette.toJSON}.
     *
     * @param data - Serialized palette payload.
     * @returns Reconstructed palette.
     * @throws Error if the payload shape or size is invalid.
     */
    public static fromJSON(data: object): Palette {
        const json = data as Partial<PaletteJSON>;
        const { colors, names, size } = json;

        if (!Array.isArray(colors) || typeof size !== 'number') {
            throw new Error('Invalid palette JSON');
        }

        const palette = new Palette(size);

        if (colors.length !== size) {
            throw new Error(`Palette JSON color count ${colors.length} does not match size ${size}`);
        }

        for (let i = 1; i < colors.length; i++) {
            palette.set(i, Color32.fromHex(readHexColor(colors, i, 'Palette JSON')));
        }

        if (names) {
            for (const [name, index] of Object.entries(names)) {
                palette.setNamed(name, index);
            }
        }

        return palette;
    }

    /**
     * Creates a palette from packed RGB bytes.
     *
     * @param data - Byte array containing RGB triplets.
     * @param size - Optional explicit palette size. When omitted, it is
     * inferred from `data.length / 3`.
     * @returns Reconstructed palette.
     * @throws Error if the byte length or palette size is invalid.
     */
    public static fromUint8Array(data: Uint8Array, size?: number): Palette {
        if (data.length % 3 !== 0) {
            throw new Error(`Palette byte array length ${data.length} is not divisible by 3`);
        }

        const inferredSize = data.length / 3;
        const resolvedSize = size ?? inferredSize;

        validatePaletteSize(resolvedSize);

        if (data.length !== resolvedSize * 3) {
            throw new Error(`Palette byte array length ${data.length} does not match palette size ${resolvedSize}`);
        }

        const palette = new Palette(resolvedSize);

        for (let i = 1; i < resolvedSize; i++) {
            const offset = i * 3;

            palette.set(
                i,
                Color32.fromRGBAUnchecked(
                    readByte(data, offset),
                    readByte(data, offset + 1),
                    readByte(data, offset + 2),
                    255,
                ),
            );
        }

        return palette;
    }

    /**
     * Creates the default VGA-style 256-color palette.
     *
     * @returns New VGA preset palette.
     */
    public static vga(): Palette {
        return createPreset(VGA_HEX, 256);
    }

    /**
     * Creates the classic CGA 16-color palette.
     *
     * @returns New CGA preset palette.
     */
    public static cga(): Palette {
        return createPreset(CGA_HEX, 16);
    }

    /**
     * Creates the Commodore 64 16-color palette.
     *
     * @returns New C64 preset palette.
     */
    public static c64(): Palette {
        return createPreset(C64_HEX, 16);
    }

    /**
     * Creates a four-shade Game Boy palette.
     *
     * @returns New Game Boy preset palette.
     */
    public static gameboy(): Palette {
        return createPreset(GAMEBOY_HEX, 4);
    }

    /**
     * Creates the PICO-8 16-color palette.
     *
     * @returns New PICO-8 preset palette.
     */
    public static pico8(): Palette {
        return createPreset(PICO8_HEX, 16);
    }

    /**
     * Creates a 64-slot NES palette.
     *
     * @returns New NES preset palette.
     */
    public static nes(): Palette {
        return createPreset(NES_HEX, 64);
    }

    /**
     * Writes a color into a palette slot.
     *
     * @param index - Palette index to overwrite.
     * @param color - Color to store.
     * @throws Error if the index is invalid or if index `0` is set opaque.
     */
    public set(index: number, color: Color32): void {
        this.assertIndexInRange(index);

        if (index === 0) {
            if (color.a !== 0) {
                throw new Error('Palette index 0 is reserved for transparency');
            }

            this.colors[0] = Color32.transparent();

            return;
        }

        // eslint-disable-next-line security/detect-object-injection -- Index range is validated by assertIndexInRange above
        this.colors[index] = color.clone();
    }

    /**
     * Returns the color stored at a palette index.
     *
     * @param index - Palette index to read.
     * @returns Stored color entry.
     * @throws Error if the index is invalid.
     */
    public get(index: number): Color32 {
        this.assertIndexInRange(index);

        return this.colorAt(index);
    }

    /**
     * Associates a human-readable name with a palette index.
     *
     * @param name - Name to register.
     * @param index - Palette index referenced by the name.
     * @throws Error if the index is invalid.
     */
    public setNamed(name: string, index: number): void {
        this.assertIndexInRange(index);
        this.namedIndices.set(name, index);
    }

    /**
     * Looks up a previously named palette index.
     *
     * @param name - Registered color name.
     * @returns Palette index bound to the name.
     * @throws Error if the name is unknown.
     */
    public getNamed(name: string): number {
        const index = this.namedIndices.get(name);

        if (index === undefined) {
            throw new Error(`Unknown palette color name: '${name}'`);
        }

        return index;
    }

    /**
     * Resolves a named color directly to its stored {@link Color32}.
     *
     * @param name - Registered color name.
     * @returns Color stored at the named index.
     * @throws Error if the name is unknown.
     */
    public getNamedColor(name: string): Color32 {
        return this.get(this.getNamed(name));
    }

    /**
     * Creates a deep copy of the palette, including named indices.
     *
     * @returns Independent palette clone.
     */
    public clone(): Palette {
        const clone = new Palette(this.size);

        clone.copyFrom(this);

        return clone;
    }

    /**
     * Copies colors and named indices from another palette into this one.
     *
     * Entries outside the source palette range are reset to transparent in the
     * destination. Named indices that do not fit inside the destination size
     * are ignored.
     *
     * @param other - Source palette to copy from.
     */
    public copyFrom(other: Palette): void {
        const copyCount = Math.min(this.size, other.size);

        this.colors[0] = Color32.transparent();

        for (let i = 1; i < copyCount; i++) {
            // eslint-disable-next-line security/detect-object-injection -- Loop bounds restrict i to valid initialized source and destination indices
            this.colors[i] = other.colorAt(i).clone();
        }

        for (let i = copyCount; i < this.size; i++) {
            // eslint-disable-next-line security/detect-object-injection -- Loop bounds restrict i to valid destination indices
            this.colors[i] = Color32.transparent().clone();
        }

        this.namedIndices.clear();

        for (const [name, index] of other.namedIndices.entries()) {
            if (index < this.size) {
                this.namedIndices.set(name, index);
            }
        }
    }

    /**
     * Serializes the palette into a JSON-friendly structure.
     *
     * @returns Plain object containing size, colors, and optional names.
     */
    public toJSON(): PaletteJSON {
        return {
            colors: this.colors.map((color) => color.toHex()),
            names: Object.fromEntries(this.namedIndices.entries()),
            size: this.size,
        };
    }

    /**
     * Exports palette colors as packed RGB bytes.
     *
     * Alpha is intentionally omitted because palette serialization for sprite
     * indexization only needs raw RGB triplets.
     *
     * @returns Byte array with `size * 3` entries.
     */
    public toUint8Array(): Uint8Array {
        const bytes = new Uint8Array(this.size * 3);

        for (let i = 0; i < this.size; i++) {
            const color = this.colorAt(i);
            const offset = i * 3;

            // eslint-disable-next-line security/detect-object-injection -- Offset is computed within the allocated Uint8Array bounds
            bytes[offset] = color.r;
            bytes[offset + 1] = color.g;
            bytes[offset + 2] = color.b;
        }

        return bytes;
    }

    /**
     * Converts the palette into the fixed-size GPU uniform layout.
     *
     * The returned buffer always contains `256 * 4` floats, so the renderer can
     * upload a stable 4 KB uniform block regardless of the active palette size.
     *
     * @returns Float buffer containing normalized RGBA values.
     */
    public toFloat32Array(): Float32Array {
        const floats = new Float32Array(GPU_PALETTE_SIZE * GPU_FLOATS_PER_COLOR);

        for (let i = 0; i < this.size; i++) {
            this.colorAt(i).writeToFloat32Array(floats, i * GPU_FLOATS_PER_COLOR);
        }

        return floats;
    }

    /**
     * Searches the palette for an exact color match.
     *
     * @param color - Color to search for.
     * @returns Matching palette index, or `-1` when no exact match exists.
     */
    public findColor(color: Color32): number {
        for (let i = 0; i < this.size; i++) {
            if (this.colorAt(i).equals(color)) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Formats the palette as a short debugging string.
     *
     * @returns Human-readable summary.
     */
    public toString(): string {
        return `Palette(size=${this.size}, colors=${this.size}, names=${this.namedIndices.size})`;
    }

    /**
     * Validates that a palette index is within the active palette size.
     *
     * @param index - Palette index to validate.
     * @throws Error if the index is outside the active palette size.
     */
    private assertIndexInRange(index: number): void {
        if (!Number.isInteger(index) || index < 0 || index >= this.size) {
            throw new Error(`Palette index ${index} out of range (palette size: ${this.size})`);
        }
    }

    /**
     * Returns a palette color after initialization checks.
     *
     * @param index - Palette index to resolve.
     * @returns Stored color instance.
     * @throws Error if the entry is unexpectedly uninitialized.
     */
    private colorAt(index: number): Color32 {
        // eslint-disable-next-line security/detect-object-injection -- Callers validate indices before lookup
        const color = this.colors[index];

        if (color === undefined) {
            throw new Error(`Palette color ${index} is not initialized`);
        }

        return color;
    }
}
