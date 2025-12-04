// #region Imports

import { Vector2i } from './Vector2i';

// #endregion

/**
 * Integer rectangle for pixel-perfect bounds and regions.
 * Inspired by RetroBlit's Rect2i.
 */
export class Rect2i {
    // #region Constructor

    /**
     * Creates a new integer rectangle.
     * All values are automatically floored to ensure pixel-perfect bounds.
     *
     * @param x - Left edge X coordinate (defaults to 0).
     * @param y - Top edge Y coordinate (defaults to 0).
     * @param width - Width in pixels (defaults to 0).
     * @param height - Height in pixels (defaults to 0).
     */
    constructor(
        /** Left edge X coordinate (defaults to 0). */
        public x: number = 0,

        /** Top edge Y coordinate (defaults to 0). */
        public y: number = 0,

        /** Width in pixels (defaults to 0). */
        public width: number = 0,

        /** Height in pixels (defaults to 0). */
        public height: number = 0,
    ) {
        this.x = Math.floor(x);
        this.y = Math.floor(y);
        this.width = Math.floor(width);
        this.height = Math.floor(height);
    }

    // #endregion

    // #region Computed Properties

    /**
     * Gets the top-left corner of the rectangle.
     *
     * @returns Vector2i representing (x, y).
     */
    get min(): Vector2i {
        return new Vector2i(this.x, this.y);
    }

    /**
     * Gets the bottom-right corner of the rectangle (exclusive).
     *
     * @returns Vector2i representing (x + width, y + height).
     */
    get max(): Vector2i {
        return new Vector2i(this.x + this.width, this.y + this.height);
    }

    /**
     * Gets the center point of the rectangle.
     *
     * @returns Vector2i at the rectangle's center (floored).
     */
    get center(): Vector2i {
        return new Vector2i(Math.floor(this.x + this.width / 2), Math.floor(this.y + this.height / 2));
    }

    /**
     * Gets the position (top-left corner) as a vector.
     *
     * @returns Vector2i representing (x, y).
     */
    get position(): Vector2i {
        return new Vector2i(this.x, this.y);
    }

    /**
     * Sets the position (top-left corner) from a vector.
     *
     * @param value - New position vector.
     */
    set position(value: Vector2i) {
        this.x = value.x;
        this.y = value.y;
    }

    /**
     * Gets the size (width, height) as a vector.
     *
     * @returns Vector2i representing (width, height).
     */
    get size(): Vector2i {
        return new Vector2i(this.width, this.height);
    }

    /**
     * Sets the size from a vector.
     *
     * @param value - New size vector (x=width, y=height).
     */
    set size(value: Vector2i) {
        this.width = value.x;
        this.height = value.y;
    }

    // #endregion

    // #region Intersection Tests

    /**
     * Tests if a point lies within this rectangle.
     * Uses half-open interval: includes min, excludes max.
     *
     * @param point - Point to test.
     * @returns True if point is inside the rectangle.
     */
    contains(point: Vector2i): boolean {
        return (
            point.x >= this.x && point.x < this.x + this.width && point.y >= this.y && point.y < this.y + this.height
        );
    }

    /**
     * Tests if this rectangle overlaps with another.
     *
     * @param other - Rectangle to test against.
     * @returns True if rectangles overlap.
     */
    intersects(other: Rect2i): boolean {
        return !(
            other.x >= this.x + this.width ||
            other.x + other.width <= this.x ||
            other.y >= this.y + this.height ||
            other.y + other.height <= this.y
        );
    }

    /**
     * Calculates the overlapping region of two rectangles.
     *
     * @param other - Rectangle to intersect with.
     * @returns New rectangle representing the overlap, or null if no overlap.
     */
    intersection(other: Rect2i): Rect2i | null {
        if (!this.intersects(other)) {
            return null;
        }

        const x1 = Math.max(this.x, other.x);
        const y1 = Math.max(this.y, other.y);
        const x2 = Math.min(this.x + this.width, other.x + other.width);
        const y2 = Math.min(this.y + this.height, other.y + other.height);

        return new Rect2i(x1, y1, x2 - x1, y2 - y1);
    }

    /**
     * Calculates intersection depth for collision resolution.
     * Returns how much the rectangles overlap in each axis.
     * Useful for pushing objects apart after collision detection.
     *
     * @param other - Rectangle to measure overlap with.
     * @returns Vector with overlap depth in X and Y axes.
     */
    intersectionDepth(other: Rect2i): Vector2i {
        const centerA = this.center;
        const centerB = other.center;
        const xDepth = centerA.x < centerB.x ? this.x + this.width - other.x : other.x + other.width - this.x;
        const yDepth = centerA.y < centerB.y ? this.y + this.height - other.y : other.y + other.height - this.y;

        return new Vector2i(xDepth, yDepth);
    }

    // #endregion

    // #region Utility

    /**
     * Checks if this rectangle equals another (all components match).
     *
     * @param other - Rectangle to compare with.
     * @returns True if position and size are identical.
     */
    equals(other: Rect2i): boolean {
        return this.x === other.x && this.y === other.y && this.width === other.width && this.height === other.height;
    }

    /**
     * Creates an independent copy of this rectangle.
     *
     * @returns New rectangle with same bounds.
     */
    clone(): Rect2i {
        return new Rect2i(this.x, this.y, this.width, this.height);
    }

    /**
     * Formats the rectangle as a readable string.
     *
     * @returns String in format "Rect2i(x, y, width, height)".
     */
    toString(): string {
        return `Rect2i(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
    }

    // #endregion

    // #region Static Constructors

    /**
     * Creates a zero-sized rectangle at origin.
     *
     * @returns New rectangle at (0, 0) with size (0, 0).
     */
    static zero(): Rect2i {
        return new Rect2i(0, 0, 0, 0);
    }

    /**
     * Creates a rectangle from two corner points.
     *
     * @param min - Top-left corner.
     * @param max - Bottom-right corner.
     * @returns New rectangle spanning from min to max.
     */
    static fromMinMax(min: Vector2i, max: Vector2i): Rect2i {
        return new Rect2i(min.x, min.y, max.x - min.x, max.y - min.y);
    }

    /**
     * Creates a rectangle centered on a point with given size.
     *
     * @param center - Center point of the rectangle.
     * @param size - Width and height as a vector.
     * @returns New rectangle centered on the given point.
     */
    static fromCenterSize(center: Vector2i, size: Vector2i): Rect2i {
        const halfWidth = Math.floor(size.x / 2);
        const halfHeight = Math.floor(size.y / 2);
        return new Rect2i(center.x - halfWidth, center.y - halfHeight, size.x, size.y);
    }

    // #endregion
}
