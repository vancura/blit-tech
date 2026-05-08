import { describe, expect, it } from 'vitest';

import {
    CANVAS_NOT_FOUND_MESSAGE,
    INIT_FAILED_MESSAGE,
    WEBGPU_ADAPTER_MESSAGE,
    WEBGPU_DEVICE_MESSAGE,
} from './errorMessages';

describe('errorMessages', () => {
    describe('CANVAS_NOT_FOUND_MESSAGE', () => {
        it('should interpolate the canvas ID into the message', () => {
            expect(CANVAS_NOT_FOUND_MESSAGE('blit-tech-canvas')).toContain('blit-tech-canvas');
        });

        it('should produce different messages for different canvas IDs', () => {
            expect(CANVAS_NOT_FOUND_MESSAGE('canvas-a')).not.toBe(CANVAS_NOT_FOUND_MESSAGE('canvas-b'));
        });

        it('should mention canvas element syntax', () => {
            expect(CANVAS_NOT_FOUND_MESSAGE('my-canvas')).toContain('<canvas');
        });
    });

    describe('INIT_FAILED_MESSAGE', () => {
        it('should be a non-empty string', () => {
            expect(typeof INIT_FAILED_MESSAGE).toBe('string');
            expect(INIT_FAILED_MESSAGE.length).toBeGreaterThan(0);
        });

        it('should mention F12 for console access', () => {
            expect(INIT_FAILED_MESSAGE).toContain('F12');
        });
    });

    describe('WEBGPU_ADAPTER_MESSAGE', () => {
        it('should be a non-empty string', () => {
            expect(typeof WEBGPU_ADAPTER_MESSAGE).toBe('string');
            expect(WEBGPU_ADAPTER_MESSAGE.length).toBeGreaterThan(0);
        });

        it('should mention hardware acceleration', () => {
            expect(WEBGPU_ADAPTER_MESSAGE).toContain('hardware acceleration');
        });
    });

    describe('WEBGPU_DEVICE_MESSAGE', () => {
        it('should be a non-empty string', () => {
            expect(typeof WEBGPU_DEVICE_MESSAGE).toBe('string');
            expect(WEBGPU_DEVICE_MESSAGE.length).toBeGreaterThan(0);
        });

        it('should suggest closing other tabs or restarting', () => {
            expect(WEBGPU_DEVICE_MESSAGE).toContain('closing other tabs');
        });
    });
});
