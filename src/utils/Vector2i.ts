/**
 * Integer 2D vector for pixel-perfect positioning.
 * Inspired by RetroBlit's Vector2i.
 */
export class Vector2i {
    /**
     * Creates a new integer 2D vector.
     * Values are automatically floored to ensure integer coordinates.
     * @param x - Horizontal component (defaults to 0).
     * @param y - Vertical component (defaults to 0).
     */
    constructor(
        public x: number = 0,
        public y: number = 0,
    ) {
        // Ensure integer values
        this.x = Math.floor(x);
        this.y = Math.floor(y);
    }

    // Aliases for convenience
    /**
     * Alias for x component, useful when treating vector as dimensions.
     * @returns The x component as width.
     */
    get width(): number {
        return this.x;
    }
    /**
     * Sets width (x component), automatically floored.
     * @param value - The new width value.
     */
    set width(value: number) {
        this.x = Math.floor(value);
    }

    /**
     * Alias for y component, useful when treating vector as dimensions.
     * @returns The y component as height.
     */
    get height(): number {
        return this.y;
    }
    /**
     * Sets height (y component), automatically floored.
     * @param value - The new height value.
     */
    set height(value: number) {
        this.y = Math.floor(value);
    }

    // Vector operations
    /**
     * Adds another vector to this one, returning a new vector.
     * @param other - Vector to add.
     * @returns New vector with summed components.
     */
    add(other: Vector2i): Vector2i {
        return new Vector2i(this.x + other.x, this.y + other.y);
    }

    /**
     * Subtracts another vector from this one, returning a new vector.
     * @param other - Vector to subtract.
     * @returns New vector with difference of components.
     */
    sub(other: Vector2i): Vector2i {
        return new Vector2i(this.x - other.x, this.y - other.y);
    }

    /**
     * Multiplies this vector by a scalar, returning a new vector.
     * @param scalar - Value to multiply both components by.
     * @returns New vector with scaled components.
     */
    mul(scalar: number): Vector2i {
        return new Vector2i(this.x * scalar, this.y * scalar);
    }

    /**
     * Component-wise multiplication with another vector.
     * @param other - Vector to multiply with.
     * @returns New vector with multiplied components.
     */
    mulVec(other: Vector2i): Vector2i {
        return new Vector2i(this.x * other.x, this.y * other.y);
    }

    /**
     * Divides this vector by a scalar, flooring the result.
     * @param scalar - Value to divide both components by.
     * @returns New vector with divided and floored components.
     */
    div(scalar: number): Vector2i {
        return new Vector2i(Math.floor(this.x / scalar), Math.floor(this.y / scalar));
    }

    /**
     * Returns a new vector with negated components.
     * @returns New vector pointing in opposite direction.
     */
    negate(): Vector2i {
        return new Vector2i(-this.x, -this.y);
    }

    // Magnitude calculations
    /**
     * Calculates the Euclidean length of this vector.
     * @returns Distance from origin (0,0) to this point.
     */
    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Calculates the squared magnitude (avoids sqrt for performance).
     * Useful for distance comparisons without the sqrt overhead.
     * @returns Squared distance from origin.
     */
    sqrMagnitude(): number {
        return this.x * this.x + this.y * this.y;
    }

    // Normalization
    /**
     * Returns a unit vector pointing in the same direction.
     * Note: Result is floored, so may not be exactly unit length.
     * @returns New normalized vector, or zero vector if magnitude is 0.
     */
    normalized(): Vector2i {
        const mag = this.magnitude();
        if (mag === 0) return Vector2i.zero();
        return new Vector2i(this.x / mag, this.y / mag);
    }

    // Comparison
    /**
     * Checks if this vector equals another vector component-wise.
     * @param other - Vector to compare with.
     * @returns True if both x and y components are equal.
     */
    equals(other: Vector2i): boolean {
        return this.x === other.x && this.y === other.y;
    }

    // Utility
    /**
     * Creates an independent copy of this vector.
     * @returns New vector with same x and y values.
     */
    clone(): Vector2i {
        return new Vector2i(this.x, this.y);
    }

    /**
     * Formats the vector as a readable string.
     * @returns String in format "(x, y)".
     */
    toString(): string {
        return `(${this.x}, ${this.y})`;
    }

    // Static constructors
    /**
     * Creates a zero vector (0, 0).
     * @returns New vector at origin.
     */
    static zero(): Vector2i {
        return new Vector2i(0, 0);
    }

    /**
     * Creates a unit vector (1, 1).
     * @returns New vector with both components set to 1.
     */
    static one(): Vector2i {
        return new Vector2i(1, 1);
    }

    /**
     * Creates an up direction vector (0, -1).
     * In screen coordinates, Y increases downward, so up is negative.
     * @returns New vector pointing up.
     */
    static up(): Vector2i {
        return new Vector2i(0, -1);
    }

    /**
     * Creates a down direction vector (0, 1).
     * @returns New vector pointing down.
     */
    static down(): Vector2i {
        return new Vector2i(0, 1);
    }

    /**
     * Creates a left direction vector (-1, 0).
     * @returns New vector pointing left.
     */
    static left(): Vector2i {
        return new Vector2i(-1, 0);
    }

    /**
     * Creates a right direction vector (1, 0).
     * @returns New vector pointing right.
     */
    static right(): Vector2i {
        return new Vector2i(1, 0);
    }

    // Convert from float vector
    /**
     * Creates an integer vector from floating-point coordinates.
     * Both values are floored to integers.
     * @param x - Floating-point x coordinate.
     * @param y - Floating-point y coordinate.
     * @returns New integer vector.
     */
    static fromFloat(x: number, y: number): Vector2i {
        return new Vector2i(Math.floor(x), Math.floor(y));
    }
}
