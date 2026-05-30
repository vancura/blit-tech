/**
 * Unit tests for palette swatch hit testing, tooltip layout, and clipboard copy (VV-549).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Rect2i } from '../../utils/Rect2i';
import { Vector2i } from '../../utils/Vector2i';
import { DEFAULT_IDX_BG, DEFAULT_IDX_TEXT } from '../constants';
import { createOverlayLayout } from '../layout/layoutHelpers';
import { paletteBandY } from '../layout/layoutPlan';
import type { OverlayLayoutPlan } from '../layout/types';
import { mockFont } from '../testFixtures';
import {
    drawPaletteTooltipChrome,
    drawPaletteTooltipLabel,
    hitTestPaletteSwatch,
    layoutPaletteTooltip,
    PALETTE_COPY_STATUS_SECONDS,
    PaletteInteraction,
    writePaletteIndexToClipboard,
} from './PaletteInteraction';
import {
    computePaletteGrid,
    DEFAULT_PALETTE_SWATCH_SIZE,
    PALETTE_SWATCH_GAP_PX,
    resolvePaletteHintExclusionRect,
    writePaletteSwatchTopLeft,
} from './PaletteView';

/** Minimal layout plan with only the palette band populated. */
function paletteOnlyPlan(paletteBand: Rect2i): OverlayLayoutPlan {
    return { paletteBand } as OverlayLayoutPlan;
}

/** Builds hint exclusion for the golden 320x240 layout. */
function goldenHintExclusion(): Rect2i {
    const layout = createOverlayLayout(320, 240, 14);

    return resolvePaletteHintExclusionRect(layout.bottomTextY, layout.displayWidth, layout.lineHeight);
}

describe('hitTestPaletteSwatch', () => {
    const layout = createOverlayLayout(320, 240, 14);
    const grid = computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 256, PALETTE_SWATCH_GAP_PX);
    const paletteBandTop = paletteBandY(240, grid.totalHeight);
    const paletteBand = new Rect2i(0, paletteBandTop, 320, grid.totalHeight);
    const hintExclusion = goldenHintExclusion();

    it('maps pointer inside a swatch to its palette index', () => {
        const index = 42;
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, index, paletteBand, grid);

        const hit = hitTestPaletteSwatch(
            swatch.x + 1,
            swatch.y + 1,
            paletteBand,
            grid,
            256,
            hintExclusion,
            layout.displayWidth,
        );

        expect(hit).toBe(index);
    });

    it('returns null in horizontal and vertical gaps between swatches', () => {
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, 0, paletteBand, grid);
        const gapX = swatch.x + grid.swatchSize;

        expect(
            hitTestPaletteSwatch(gapX, swatch.y + 1, paletteBand, grid, 256, hintExclusion, layout.displayWidth),
        ).toBeNull();

        const gapY = swatch.y + grid.swatchSize;

        expect(
            hitTestPaletteSwatch(swatch.x + 1, gapY, paletteBand, grid, 256, hintExclusion, layout.displayWidth),
        ).toBeNull();
    });

    it('returns null over the hint exclusion band', () => {
        const hit = hitTestPaletteSwatch(
            hintExclusion.x + 1,
            hintExclusion.y + 1,
            paletteBand,
            grid,
            256,
            hintExclusion,
            layout.displayWidth,
        );

        expect(hit).toBeNull();
    });

    it('excludes the right scrollbar track from hits', () => {
        const trackWidth = 8;
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, 31, paletteBand, grid);

        expect(
            hitTestPaletteSwatch(
                layout.displayWidth - 1,
                swatch.y + 1,
                paletteBand,
                grid,
                256,
                hintExclusion,
                layout.displayWidth,
                0,
                trackWidth,
            ),
        ).toBeNull();
    });

    it('applies scroll row offset to visible row mapping', () => {
        const scrollRowOffset = 2;
        const index = scrollRowOffset * grid.cols + 5;
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, index, paletteBand, grid, scrollRowOffset);

        expect(
            hitTestPaletteSwatch(
                swatch.x + 1,
                swatch.y + 1,
                paletteBand,
                grid,
                256,
                hintExclusion,
                layout.displayWidth,
                scrollRowOffset,
            ),
        ).toBe(index);
    });

    it('still hits swatches inside the bottom-left toggle corner overlap', () => {
        const index = grid.cols * (grid.rows - 1);
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, index, paletteBand, grid);

        expect(
            hitTestPaletteSwatch(
                swatch.x + 1,
                swatch.y + 1,
                paletteBand,
                grid,
                256,
                hintExclusion,
                layout.displayWidth,
            ),
        ).toBe(index);
        expect(layout.toggleRect.contains(new Vector2i(swatch.x + 1, swatch.y + 1))).toBe(true);
    });
});

describe('layoutPaletteTooltip', () => {
    const layoutScratch = {
        body: new Rect2i(),
        swatch: new Rect2i(),
        textPos: new Vector2i(),
    };

    it('clamps tooltip body inside the display on the right edge', () => {
        const swatch = new Rect2i(300, 180, 7, 7);
        const label = '255';

        layoutPaletteTooltip(layoutScratch, swatch, label, 320, 240);

        expect(layoutScratch.body.x + layoutScratch.body.width).toBeLessThanOrEqual(320);
        expect(layoutScratch.body.x).toBeGreaterThanOrEqual(0);
    });

    it('clamps tooltip body inside the display on the left edge', () => {
        const swatch = new Rect2i(0, 180, 7, 7);
        const label = '255';

        layoutPaletteTooltip(layoutScratch, swatch, label, 320, 240);

        expect(layoutScratch.body.x).toBeGreaterThanOrEqual(0);
    });

    it('places tooltip body above the swatch with a one-pixel gap', () => {
        const swatch = new Rect2i(40, 180, 7, 7);

        layoutPaletteTooltip(layoutScratch, swatch, '12', 320, 240);

        expect(layoutScratch.body.y + layoutScratch.body.height).toBe(swatch.y - 1);
    });

    it('keeps tooltip body fully inside the display on the bottom edge', () => {
        const swatch = new Rect2i(0, 235, 7, 7);

        layoutPaletteTooltip(layoutScratch, swatch, '12', 320, 240);

        expect(layoutScratch.body.y + layoutScratch.body.height).toBeLessThanOrEqual(240);
        expect(layoutScratch.body.y).toBeGreaterThanOrEqual(0);
    });
});

describe('drawPaletteTooltipChrome', () => {
    it('draws tooltip body and border via drawBarFillOnTop', () => {
        const layoutScratch = {
            body: new Rect2i(),
            swatch: new Rect2i(40, 180, 7, 7),
            textPos: new Vector2i(),
        };
        const layout = layoutPaletteTooltip(layoutScratch, layoutScratch.swatch, '42', 320, 240);
        const target = {
            drawBarFill: vi.fn(),
            drawBarFillOnTop: vi.fn(),
            drawLabel: vi.fn(),
            drawLabelOnTop: vi.fn(),
        };

        drawPaletteTooltipChrome(target, layout, DEFAULT_IDX_BG, DEFAULT_IDX_TEXT);

        expect(target.drawBarFillOnTop).toHaveBeenCalled();
        expect(target.drawBarFill).not.toHaveBeenCalled();
        expect(target.drawLabelOnTop).not.toHaveBeenCalled();
    });
});

describe('drawPaletteTooltipLabel', () => {
    it('draws tooltip text via drawLabelOnTop', () => {
        const layoutScratch = {
            body: new Rect2i(),
            swatch: new Rect2i(40, 180, 7, 7),
            textPos: new Vector2i(),
        };
        const layout = layoutPaletteTooltip(layoutScratch, layoutScratch.swatch, '42', 320, 240);
        const target = {
            drawBarFill: vi.fn(),
            drawBarFillOnTop: vi.fn(),
            drawLabel: vi.fn(),
            drawLabelOnTop: vi.fn(),
        };

        drawPaletteTooltipLabel(target, mockFont, layout, '42', DEFAULT_IDX_TEXT);

        expect(target.drawLabelOnTop).toHaveBeenCalled();
        expect(target.drawBarFill).not.toHaveBeenCalled();
        expect(target.drawBarFillOnTop).not.toHaveBeenCalled();
    });
});

describe('PaletteInteraction clipboard', () => {
    beforeEach(() => {
        vi.stubGlobal('navigator', {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('writes plain index strings to the clipboard', async () => {
        await writePaletteIndexToClipboard(42);

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('42');
    });

    it('shows Copied N after successful press', async () => {
        const interaction = new PaletteInteraction(60);
        const layout = createOverlayLayout(320, 240, 14);
        const grid = computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 256, PALETTE_SWATCH_GAP_PX);
        const paletteBandTop = paletteBandY(240, grid.totalHeight);
        const plan = paletteOnlyPlan(new Rect2i(0, paletteBandTop, 320, grid.totalHeight));
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, 7, plan.paletteBand, grid);

        const consumed = interaction.handlePress(
            {
                isButtonPressed: () => true,
                getPos: () => new Vector2i(swatch.x + 1, swatch.y + 1),
            } as never,
            10,
            plan,
            grid,
            256,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
        );

        expect(consumed).toBe(true);

        await vi.waitFor(async () => {
            await Promise.resolve();
            const probe = {
                drawBarFill: vi.fn(),
                drawLabelOnTop: vi.fn(),
                drawPixel: vi.fn(),
            };

            interaction.drawTooltipLabel(
                probe as never,
                mockFont,
                plan,
                grid,
                layout.displayWidth,
                layout.displayHeight,
                DEFAULT_IDX_TEXT,
            );

            expect(probe.drawLabelOnTop).toHaveBeenCalled();
        });

        const renderer = {
            drawBarFill: vi.fn(),
            drawLabelOnTop: vi.fn(),
            drawPixel: vi.fn(),
        };

        interaction.drawTooltipLabel(
            renderer as never,
            mockFont,
            plan,
            grid,
            layout.displayWidth,
            layout.displayHeight,
            DEFAULT_IDX_TEXT,
        );

        expect(renderer.drawLabelOnTop).toHaveBeenCalledWith(
            mockFont,
            expect.any(Vector2i),
            'Copied 7',
            expect.any(Number),
        );
    });

    it('shows Copy failed when clipboard write is denied', async () => {
        vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));

        const interaction = new PaletteInteraction(60);
        const layout = createOverlayLayout(320, 240, 14);
        const grid = computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 256, PALETTE_SWATCH_GAP_PX);
        const paletteBandTop = paletteBandY(240, grid.totalHeight);
        const plan = paletteOnlyPlan(new Rect2i(0, paletteBandTop, 320, grid.totalHeight));
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, 3, plan.paletteBand, grid);

        interaction.handlePress(
            {
                isButtonPressed: () => true,
                getPos: () => new Vector2i(swatch.x + 1, swatch.y + 1),
            } as never,
            5,
            plan,
            grid,
            256,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
        );

        await vi.waitFor(() => {
            const renderer = {
                drawBarFill: vi.fn(),
                drawLabelOnTop: vi.fn(),
                drawPixel: vi.fn(),
            };

            interaction.drawTooltipLabel(
                renderer as never,
                mockFont,
                plan,
                grid,
                layout.displayWidth,
                layout.displayHeight,
                DEFAULT_IDX_TEXT,
            );

            expect(renderer.drawLabelOnTop).toHaveBeenCalledWith(
                mockFont,
                expect.any(Vector2i),
                'Copy failed',
                expect.any(Number),
            );
        });
    });

    it('clears copy status after the configured duration', async () => {
        const interaction = new PaletteInteraction(60);
        const layout = createOverlayLayout(320, 240, 14);
        const grid = computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 256, PALETTE_SWATCH_GAP_PX);
        const paletteBandTop = paletteBandY(240, grid.totalHeight);
        const plan = paletteOnlyPlan(new Rect2i(0, paletteBandTop, 320, grid.totalHeight));
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, 9, plan.paletteBand, grid);

        interaction.handlePress(
            {
                isButtonPressed: () => true,
                getPos: () => new Vector2i(swatch.x + 1, swatch.y + 1),
            } as never,
            10,
            plan,
            grid,
            256,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
        );

        await vi.waitFor(async () => {
            await Promise.resolve();
        });

        const expiryTick = 10 + Math.ceil(PALETTE_COPY_STATUS_SECONDS * 60);

        interaction.tickCopyStatus(expiryTick);

        const renderer = {
            drawBarFill: vi.fn(),
            drawLabelOnTop: vi.fn(),
            drawPixel: vi.fn(),
        };

        interaction.updateHover(
            {
                isValid: () => true,
                getPos: () => new Vector2i(swatch.x + 1, swatch.y + 1),
            } as never,
            plan,
            grid,
            256,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
        );

        interaction.drawTooltipLabel(
            renderer as never,
            mockFont,
            plan,
            grid,
            layout.displayWidth,
            layout.displayHeight,
            DEFAULT_IDX_TEXT,
        );

        expect(renderer.drawLabelOnTop).toHaveBeenCalledWith(mockFont, expect.any(Vector2i), '9', expect.any(Number));
    });

    it('starts copy-status expiry from clipboard completion tick', async () => {
        let resolveWrite!: () => void;

        vi.mocked(navigator.clipboard.writeText).mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveWrite = resolve;
                }),
        );

        const interaction = new PaletteInteraction(60);
        const layout = createOverlayLayout(320, 240, 14);
        const grid = computePaletteGrid(320, DEFAULT_PALETTE_SWATCH_SIZE, 256, PALETTE_SWATCH_GAP_PX);
        const paletteBandTop = paletteBandY(240, grid.totalHeight);
        const plan = paletteOnlyPlan(new Rect2i(0, paletteBandTop, 320, grid.totalHeight));
        const swatch = new Rect2i();

        writePaletteSwatchTopLeft(swatch, 9, plan.paletteBand, grid);

        interaction.handlePress(
            {
                isButtonPressed: () => true,
                getPos: () => new Vector2i(swatch.x + 1, swatch.y + 1),
            } as never,
            10,
            plan,
            grid,
            256,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
        );

        for (let tick = 11; tick <= 25; tick++) {
            interaction.tickCopyStatus(tick);
        }

        resolveWrite();
        await vi.waitFor(async () => {
            await Promise.resolve();

            const probe = {
                drawBarFill: vi.fn(),
                drawLabelOnTop: vi.fn(),
            };

            interaction.drawTooltipLabel(
                probe as never,
                mockFont,
                plan,
                grid,
                layout.displayWidth,
                layout.displayHeight,
                DEFAULT_IDX_TEXT,
            );

            expect(probe.drawLabelOnTop).toHaveBeenCalledWith(
                mockFont,
                expect.any(Vector2i),
                'Copied 9',
                expect.any(Number),
            );
        });

        const completionExpiryTick = 25 + Math.ceil(PALETTE_COPY_STATUS_SECONDS * 60);
        const pressExpiryTick = 10 + Math.ceil(PALETTE_COPY_STATUS_SECONDS * 60);

        const renderer = {
            drawBarFill: vi.fn(),
            drawLabelOnTop: vi.fn(),
            drawPixel: vi.fn(),
        };

        interaction.tickCopyStatus(pressExpiryTick);
        interaction.drawTooltipLabel(
            renderer as never,
            mockFont,
            plan,
            grid,
            layout.displayWidth,
            layout.displayHeight,
            DEFAULT_IDX_TEXT,
        );

        expect(renderer.drawLabelOnTop).toHaveBeenCalledWith(
            mockFont,
            expect.any(Vector2i),
            'Copied 9',
            expect.any(Number),
        );

        interaction.tickCopyStatus(completionExpiryTick);
        interaction.updateHover(
            {
                isValid: () => true,
                getPos: () => new Vector2i(swatch.x + 1, swatch.y + 1),
            } as never,
            plan,
            grid,
            256,
            layout.bottomTextY,
            layout.displayWidth,
            layout.lineHeight,
        );
        interaction.drawTooltipLabel(
            renderer as never,
            mockFont,
            plan,
            grid,
            layout.displayWidth,
            layout.displayHeight,
            DEFAULT_IDX_TEXT,
        );

        expect(renderer.drawLabelOnTop).toHaveBeenLastCalledWith(
            mockFont,
            expect.any(Vector2i),
            '9',
            expect.any(Number),
        );
    });
});
