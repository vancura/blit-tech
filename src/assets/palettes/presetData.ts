/**
 * Built-in preset palette data used by {@link Palette} factory methods.
 *
 * Each array stores colors as `RRGGBB` hex strings. Palette construction keeps
 * index `0` reserved for transparency, so preset values are copied starting at
 * palette index `1`.
 */

const HEX_DIGITS = '0123456789abcdef';

/**
 * Converts an 8-bit channel value to a two-digit lowercase hex string.
 *
 * @param value - Byte value to convert.
 * @returns Two-character lowercase hex string.
 */
function byteToHex(value: number): string {
    const byte = value & 0xff;

    return `${HEX_DIGITS[(byte >> 4) & 0xf]}${HEX_DIGITS[byte & 0xf]}`;
}

/**
 * Formats three RGB bytes into a compact `RRGGBB` hex string.
 *
 * @param r - Red channel.
 * @param g - Green channel.
 * @param b - Blue channel.
 * @returns RGB color string without a leading `#`.
 */
function rgbToHex(r: number, g: number, b: number): string {
    return `${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
}

/**
 * Builds the default VGA 256-color table.
 *
 * The data includes the classic 16-color base palette, the 6x6x6 color cube,
 * and the grayscale ramp used by standard VGA palettes.
 *
 * @returns VGA palette data as `RRGGBB` hex strings.
 */
function buildVgaHex(): string[] {
    const hex: string[] = [
        '000000',
        '800000',
        '008000',
        '808000',
        '000080',
        '800080',
        '008080',
        'c0c0c0',
        '808080',
        'ff0000',
        '00ff00',
        'ffff00',
        '0000ff',
        'ff00ff',
        '00ffff',
        'ffffff',
    ];

    const cubeSteps = [0, 95, 135, 175, 215, 255];

    for (const r of cubeSteps) {
        for (const g of cubeSteps) {
            for (const b of cubeSteps) {
                hex.push(rgbToHex(r, g, b));
            }
        }
    }

    for (let i = 0; i < 24; i++) {
        const level = 8 + i * 10;

        hex.push(rgbToHex(level, level, level));
    }

    return hex;
}

/** Default VGA 256-color preset data. */
export const VGA_HEX = buildVgaHex();

/** Classic CGA 16-color preset data. */
// cspell:disable
export const CGA_HEX = [
    '000000',
    '0000aa',
    '00aa00',
    '00aaaa',
    'aa0000',
    'aa00aa',
    'aa5500',
    'aaaaaa',
    '555555',
    '5555ff',
    '55ff55',
    '55ffff',
    'ff5555',
    'ff55ff',
    'ffff55',
    'ffffff',
];
// cspell:enable

/** Commodore 64 16-color preset data. */
// cspell:disable
export const C64_HEX = [
    '000000',
    'ffffff',
    '813338',
    '75cec8',
    '8e3c97',
    '56ac4d',
    '2e2c9b',
    'edf171',
    '8e5029',
    '553800',
    'c46c71',
    '4a4a4a',
    '7b7b7b',
    'a9ff9f',
    '706deb',
    'b2b2b2',
];
// cspell:enable

/** Four-shade Game Boy preset data. */
// cspell:disable
export const GAMEBOY_HEX = ['0f380f', '306230', '8bac0f', '9bbc0f'];
// cspell:enable

/** PICO-8 16-color preset data. */
// cspell:disable
export const PICO8_HEX = [
    '000000',
    '1d2b53',
    '7e2553',
    '008751',
    'ab5236',
    '5f574f',
    'c2c3c7',
    'fff1e8',
    'ff004d',
    'ffa300',
    'ffec27',
    '00e436',
    '29adff',
    '83769c',
    'ff77a8',
    'ffccaa',
];
// cspell:enable

/** NES 64-slot preset data. */
// cspell:disable
export const NES_HEX = [
    '7c7c7c',
    '0000fc',
    '0000bc',
    '4428bc',
    '940084',
    'a80020',
    'a81000',
    '881400',
    '503000',
    '007800',
    '006800',
    '005800',
    '004058',
    '000000',
    '000000',
    '000000',
    'bcbcbc',
    '0078f8',
    '0058f8',
    '6844fc',
    'd800cc',
    'e40058',
    'f83800',
    'e45c10',
    'ac7c00',
    '00b800',
    '00a800',
    '00a844',
    '008888',
    '000000',
    '000000',
    '000000',
    'f8f8f8',
    '3cbcfc',
    '6888fc',
    '9878f8',
    'f878f8',
    'f85898',
    'f87858',
    'fca044',
    'f8b800',
    'b8f818',
    '58d854',
    '58f898',
    '00e8d8',
    '787878',
    '000000',
    '000000',
    'fcfcfc',
    'a4e4fc',
    'b8b8f8',
    'd8b8f8',
    'f8b8f8',
    'f8a4c0',
    'f0d0b0',
    'fce0a8',
];
// cspell:enable
