/**
 * Unit tests for {@link Palette}.
 *
 * Covers supported palette sizes, transparent index behavior, named entries,
 * cloning and copying semantics, serialization, preset factories, and the
 * fixed-size GPU upload format required by the palette rendering pipeline.
 */
import { describe, expect, it } from 'vitest';

import { Color32 } from '../utils/Color32';
import { Palette } from './Palette';

// #region Palette

describe('Palette', () => {
    /** Verifies that every supported indexed palette size constructs cleanly. */
    it('constructs all valid palette sizes', () => {
        expect(new Palette(2).size).toBe(2);
        expect(new Palette(4).size).toBe(4);
        expect(new Palette(16).size).toBe(16);
        expect(new Palette(32).size).toBe(32);
        expect(new Palette(64).size).toBe(64);
        expect(new Palette(128).size).toBe(128);
        expect(new Palette(256).size).toBe(256);
    });

    it('rejects invalid palette sizes', () => {
        expect(() => new Palette(3)).toThrow('Invalid palette size: 3. Must be 2, 4, 16, 32, 64, 128, or 256');
    });

    /** Confirms that palette entry zero remains the reserved transparent slot. */
    it('keeps index 0 transparent and rejects opaque writes there', () => {
        const palette = new Palette(16);

        expect(palette.get(0).equals(Color32.transparent())).toBe(true);
        expect(() => palette.set(0, Color32.red())).toThrow('Palette index 0 is reserved for transparency');

        palette.set(0, new Color32(12, 34, 56, 0));

        expect(palette.get(0).equals(Color32.transparent())).toBe(true);

        // get() returns a clone, so mutating the result must not change the stored entry.
        const copy = palette.get(0);
        copy.r = 99;
        expect(palette.get(0).equals(Color32.transparent())).toBe(true);
    });

    it('sets and gets entries within range and throws out of range', () => {
        const palette = new Palette(16);
        const color = new Color32(10, 20, 30, 255);

        palette.set(5, color);

        expect(palette.get(5).equals(color)).toBe(true);
        expect(palette.get(5)).not.toBe(color);
        expect(() => palette.get(16)).toThrow('Palette index 16 out of range (palette size: 16)');
        expect(() => palette.set(-1, color)).toThrow('Palette index -1 out of range (palette size: 16)');
    });

    it('get() returns a defensive copy — mutating the result does not change the stored entry', () => {
        const palette = new Palette(16);

        palette.set(3, new Color32(10, 20, 30, 255));

        const copy = palette.get(3);
        copy.r = 99;
        copy.g = 99;
        copy.b = 99;

        expect(palette.get(3).equals(new Color32(10, 20, 30, 255))).toBe(true);
    });

    it('supports named indices and named color lookups', () => {
        const palette = new Palette(16);
        const color = new Color32(99, 88, 77, 255);

        palette.set(3, color);
        palette.setNamed('uiAccent', 3);

        expect(palette.getNamed('uiAccent')).toBe(3);
        expect(palette.getNamedColor('uiAccent').equals(color)).toBe(true);
        expect(() => palette.getNamed('missing')).toThrow("Unknown palette color name: 'missing'");
    });

    it('finds exact matching colors and returns -1 when absent', () => {
        const palette = new Palette(16);
        const color = new Color32(40, 50, 60, 255);

        palette.set(7, color);

        expect(palette.findColor(color)).toBe(7);
        expect(palette.findColor(Color32.blue())).toBe(-1);
    });

    it('clones palettes without sharing mutable entries', () => {
        const palette = new Palette(16);

        palette.set(2, new Color32(1, 2, 3, 255));
        palette.setNamed('player', 2);

        const clone = palette.clone();

        clone.get(2).r = 99;
        clone.setNamed('enemy', 4);

        expect(palette.get(2).r).toBe(1);
        expect(palette.getNamed('player')).toBe(2);
        expect(() => palette.getNamed('enemy')).toThrow();
    });

    it('copies entries and names from another palette', () => {
        const source = new Palette(16);
        const target = new Palette(16);

        source.set(4, new Color32(9, 8, 7, 255));
        source.setNamed('wall', 4);
        target.set(4, new Color32(1, 1, 1, 255));

        target.copyFrom(source);

        expect(target.get(4).equals(source.get(4))).toBe(true);
        expect(target.get(4)).not.toBe(source.get(4));
        expect(target.getNamed('wall')).toBe(4);
    });

    it('roundtrips through JSON serialization', () => {
        const palette = new Palette(16);

        palette.set(1, new Color32(11, 22, 33, 255));
        palette.setNamed('primary', 1);

        const restored = Palette.fromJSON(palette.toJSON());

        expect(restored.size).toBe(16);
        expect(restored.get(1).equals(new Color32(11, 22, 33, 255))).toBe(true);
        expect(restored.getNamed('primary')).toBe(1);
        expect(restored.get(0).equals(Color32.transparent())).toBe(true);
    });

    it('rejects invalid JSON payloads', () => {
        expect(() => Palette.fromJSON({ colors: ['#000000ff'] })).toThrow('Invalid palette JSON');
        expect(() => Palette.fromJSON({ size: 16 })).toThrow('Invalid palette JSON');
        expect(() => Palette.fromJSON({ colors: ['#00000000'], size: 16 })).toThrow(
            'Palette JSON color count 1 does not match size 16',
        );
    });

    it('rejects missing JSON color entries and invalid named indices', () => {
        const invalidColors = new Array<string>(16);

        invalidColors[0] = '#00000000';
        invalidColors[1] = '#ffffff00';

        expect(() => Palette.fromJSON({ colors: invalidColors, size: 16 })).toThrow('Palette JSON color 2 is missing');
        expect(() =>
            Palette.fromJSON({ colors: new Array(16).fill('#00000000'), names: { bad: 16 }, size: 16 }),
        ).toThrow('Palette index 16 out of range (palette size: 16)');
    });

    it('roundtrips through raw RGB bytes', () => {
        const palette = new Palette(16);

        palette.set(1, new Color32(1, 2, 3, 255));
        palette.set(15, new Color32(250, 251, 252, 255));

        const restored = Palette.fromUint8Array(palette.toUint8Array());

        expect(restored.size).toBe(16);
        expect(restored.get(1).equals(new Color32(1, 2, 3, 255))).toBe(true);
        expect(restored.get(15).equals(new Color32(250, 251, 252, 255))).toBe(true);
        expect(restored.get(0).equals(Color32.transparent())).toBe(true);
    });

    it('rejects invalid raw RGB byte payloads', () => {
        expect(() => Palette.fromUint8Array(new Uint8Array([1, 2, 3, 4]))).toThrow(
            'Palette byte array length 4 is not divisible by 3',
        );
        expect(() => Palette.fromUint8Array(new Uint8Array(48), 32)).toThrow(
            'Palette byte array length 48 does not match palette size 32',
        );
        expect(() => Palette.fromUint8Array(new Uint8Array(9))).toThrow(
            'Invalid palette size: 3. Must be 2, 4, 16, 32, 64, 128, or 256',
        );
    });

    it('copies between different palette sizes predictably', () => {
        const source = new Palette(16);
        const target = new Palette(32);
        const smallTarget = new Palette(4);

        source.set(1, new Color32(10, 20, 30, 255));
        source.set(15, new Color32(200, 210, 220, 255));
        source.setNamed('first', 1);
        source.setNamed('last', 15);

        target.copyFrom(source);
        smallTarget.copyFrom(source);

        expect(target.get(1).equals(new Color32(10, 20, 30, 255))).toBe(true);
        expect(target.get(15).equals(new Color32(200, 210, 220, 255))).toBe(true);
        expect(target.get(16).equals(Color32.transparent())).toBe(true);
        expect(target.getNamed('last')).toBe(15);

        expect(smallTarget.get(1).equals(new Color32(10, 20, 30, 255))).toBe(true);
        expect(() => smallTarget.getNamed('last')).toThrow("Unknown palette color name: 'last'");
    });

    it('always produces a 256-entry float buffer for GPU upload', () => {
        const palette = new Palette(16);

        palette.set(1, new Color32(255, 128, 0, 255));

        const floats = palette.toFloat32Array();

        expect(floats).toHaveLength(256 * 4);
        expect(floats[4]).toBe(1);
        expect(floats[5]).toBeCloseTo(128 / 255);
        expect(floats[6]).toBe(0);
        expect(floats[7]).toBe(1);
        expect(floats[16 * 4]).toBe(0);
        expect(floats[16 * 4 + 3]).toBe(0);
    });

    it('returns a readable debug string', () => {
        const palette = new Palette(16);

        palette.setNamed('accent', 1);

        expect(palette.toString()).toBe('Palette(size=16, colors=16, names=1)');
    });

    it('exposes built-in preset palettes', () => {
        expect(Palette.vga().size).toBe(256);
        expect(Palette.c64().size).toBe(16);
        expect(Palette.cga().size).toBe(16);
        expect(Palette.gameboy().size).toBe(4);
        expect(Palette.pico8().size).toBe(16);
        expect(Palette.nes().size).toBe(64);
        expect(Palette.c64().findColor(Color32.fromHex('#813338'))).toBe(2);
        expect(Palette.vga().get(0).equals(Color32.transparent())).toBe(true);
        expect(Palette.gameboy().get(1).equals(Color32.fromHex('#306230'))).toBe(true);
        expect(Palette.nes().get(1).equals(Color32.fromHex('#0000fc'))).toBe(true);
        expect(Palette.pico8().get(12).equals(Color32.fromHex('#29adff'))).toBe(true);
    });
});

// #endregion

// #region Palette dirty flag

describe('Palette dirty flag', () => {
    it('starts clean after construction', () => {
        expect(new Palette(16).dirty).toBe(false);
    });

    it('becomes dirty after set()', () => {
        const palette = new Palette(16);

        palette.set(1, new Color32(255, 0, 0, 255));

        expect(palette.dirty).toBe(true);
    });

    it('clearDirty() resets the flag', () => {
        const palette = new Palette(16);

        palette.set(1, new Color32(255, 0, 0, 255));
        palette.clearDirty();

        expect(palette.dirty).toBe(false);
    });

    it('becomes dirty after copyFrom()', () => {
        const src = new Palette(16);
        const dest = new Palette(16);

        dest.copyFrom(src);

        expect(dest.dirty).toBe(true);
    });

    it('clone() returns a non-dirty palette regardless of source state', () => {
        const palette = new Palette(16);

        palette.set(1, new Color32(255, 0, 0, 255));

        expect(palette.dirty).toBe(true);
        expect(palette.clone().dirty).toBe(false);
    });

    it('setting index 0 to transparent does not mark dirty', () => {
        const palette = new Palette(16);

        palette.set(0, new Color32(0, 0, 0, 0));

        expect(palette.dirty).toBe(false);
    });

    it('remains dirty through multiple set() calls until cleared', () => {
        const palette = new Palette(16);

        palette.set(1, new Color32(255, 0, 0, 255));
        palette.set(2, new Color32(0, 255, 0, 255));
        palette.set(3, new Color32(0, 0, 255, 255));
        palette.clearDirty();

        expect(palette.dirty).toBe(false);

        palette.set(4, new Color32(255, 255, 0, 255));

        expect(palette.dirty).toBe(true);
    });
});

// #endregion
