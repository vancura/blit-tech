# Performance Best Practices

This guide explains when and how to optimize your Blit-Tech games for performance, with a focus on object allocation
patterns and rendering efficiency.

## Table of Contents

- [Introduction](#introduction)
- [Object Allocation Patterns](#object-allocation-patterns)
- [Drawing Performance](#drawing-performance)
- [Game Loop Best Practices](#game-loop-best-practices)
- [Common Pitfalls](#common-pitfalls)
- [Performance Rules of Thumb](#performance-rules-of-thumb)
- [Example References](#example-references)

---

## Introduction

### When to Optimize

**Profile first, optimize second.** Premature optimization often leads to complex, hard-to-maintain code without
meaningful performance gains. Follow this approach:

1. **Write clear, simple code first** - Use inline object creation (`new Vector2i(x, y)`)
2. **Measure performance** - Use browser dev tools to identify bottlenecks
3. **Optimize hot paths only** - Focus on code that runs 50+ times per frame
4. **Keep it simple elsewhere** - Clarity matters more than micro-optimizations in UI code

### Frame Budget

At 60 FPS, each frame must complete in **16.66ms** (1000ms / 60). This includes:

- Fixed update logic (~2-4ms)
- Rendering (~8-12ms)
- Browser overhead (~2-4ms)

If your frame time exceeds this budget, you'll drop frames and see stuttering.

---

## Object Allocation Patterns

JavaScript's garbage collector can cause frame hitches if you allocate many objects per frame. Blit-Tech provides two
patterns for managing allocations:

### Inline Allocation (Simple & Clear)

**When to use:** UI code, one-time operations, and anywhere readability matters more than performance.

```typescript
// Clear and readable
BT.drawPixel(new Vector2i(x, y), color);
BT.drawRect(new Rect2i(10, 10, 50, 50), Color32.white());
BT.printFont(font, new Vector2i(10, 20), 'Hello', Color32.white());
```

**Pros:**

- Easy to read and understand
- No boilerplate
- Self-documenting code

**Cons:**

- Creates new objects each call
- Can cause GC pressure in tight loops

### Pre-allocation with `.set()` (Performance-Focused)

**When to use:** Tight loops that run 50+ times per frame.

```typescript
class MyGame implements IBlitTechGame {
  // Pre-allocate reusable objects
  private readonly tempVec = new Vector2i(0, 0);
  private readonly tempRect = new Rect2i(0, 0, 0, 0);

  render(): void {
    // Reuse in tight loop
    for (let i = 0; i < 200; i++) {
      this.tempVec.set(x, y);
      BT.drawPixel(this.tempVec, color);
    }
  }
}
```

**Pros:**

- Zero allocations in hot paths
- Reduces GC pressure
- Predictable performance

**Cons:**

- More boilerplate
- Harder to read
- Must track object reuse

### Comparison

For a loop drawing 200 pixels per frame at 60 FPS:

| Pattern        | Allocations/sec | GC Impact                          |
| -------------- | --------------- | ---------------------------------- |
| Inline         | 12,000/sec      | Moderate GC pauses every ~1 second |
| Pre-allocation | 0/sec           | Minimal GC activity                |

**Real-world impact:** On modern browsers, inline allocation is fine for <50 operations/frame. Beyond that,
pre-allocation provides measurable benefits.

---

## Drawing Performance

### Batching

Blit-Tech automatically batches draw calls for optimal GPU performance:

- **Primitive batching:** All primitives (pixels, lines, rects) are batched together
- **Texture batching:** Sprites from the same `SpriteSheet` are batched
- **Batch breaks:** Changing sprite sheets breaks batching

**Optimization tips:**

```typescript
// Good: All sprites from same sheet
for (const enemy of enemies) {
  BT.drawSprite(enemySheet, enemy.sprite, enemy.pos, enemy.tint);
}

// Less optimal: Switching between sheets
BT.drawSprite(enemySheet, sprite1, pos1);
BT.drawSprite(playerSheet, sprite2, pos2); // Batch break!
BT.drawSprite(enemySheet, sprite3, pos3); // Batch break!
```

### Sprite Sheet Organization

**Pack related sprites into single sheets:**

```text
Good:
- enemies.png (all enemy sprites)
- ui.png (all UI elements)
- environment.png (tiles, props)

Less optimal:
- enemy1.png, enemy2.png, enemy3.png (separate files)
```

### Tinting Performance

**Tinting is essentially free!** All color multiplication happens in the GPU shader, so:

```typescript
// Both have the same performance
BT.drawSprite(sheet, sprite, pos, Color32.white());
BT.drawSprite(sheet, sprite, pos, new Color32(255, 100, 100, 200));
```

Use tinting liberally for visual effects - it doesn't impact performance.

### Line Rendering Costs

The Renderer has been optimized to reduce vertex overhead: axis-aligned lines now render as single quads (6 vertices),
while diagonal lines use Bresenham's algorithm. This section explains the cost tradeoffs and when optimization matters.

Line rendering performance varies significantly based on line orientation:

| Line Type             | Vertices Used           | Example (100px line) |
| --------------------- | ----------------------- | -------------------- |
| Horizontal / Vertical | 6 (single quad)         | 6 vertices           |
| Diagonal              | 6 per pixel (Bresenham) | ~600 vertices        |

**Why diagonal lines cost more:**

Diagonal lines use Bresenham's algorithm to achieve authentic pixel-art rendering where each pixel is a discrete unit.
This produces the classic "staircase" look expected in retro games but requires rendering each pixel as a separate quad.

**Optimization tips for diagonal lines:**

```typescript
// GOOD: Grid lines (axis-aligned) are very cheap
for (let x = 0; x < 800; x += 40) {
  BT.drawLine(new Vector2i(x, 0), new Vector2i(x, 600), color); // 6 vertices each
}

// EXPENSIVE: Many diagonal lines (e.g., Lissajous curves, circles)
// Each segment uses ~6 vertices per pixel
for (let i = 0; i < 200; i++) {
  BT.drawLine(p1, p2, color); // Could be 600+ vertices per line
}

// ALTERNATIVE: Use filled rectangles for thick diagonal lines
// Or pre-render complex patterns to a texture
```

**When diagonal line cost matters:**

- Drawing 10-20 short diagonal lines per frame: Fine
- Drawing 100+ diagonal line segments (curves, circles): Consider alternatives
- Static complex patterns: Pre-render to a sprite sheet

---

## Game Loop Best Practices

### Fixed Timestep

Blit-Tech uses a fixed 60 FPS timestep by default. This provides:

- **Deterministic behavior:** Same inputs always produce same results
- **Predictable physics:** No need to multiply by delta time
- **Simplified logic:** Frame-based counters and timers

### Using Ticks for Timing

```typescript
// Frame-based timer (recommended)
if (BT.ticks() - lastActionTick >= 60) {
  performAction();
  lastActionTick = BT.ticks();
}

// Alternative: Delta time (more complex)
elapsedTime += deltaTime;
if (elapsedTime >= 1.0) {
  performAction();
  elapsedTime = 0;
}
```

**Ticks are simpler and more deterministic** for most game logic.

### Frame Budget Management

If your `update()` or `render()` takes too long:

1. **Profile with browser dev tools** - Find the actual bottleneck
2. **Reduce draw calls** - Cull off-screen objects
3. **Optimize hot loops** - Use pre-allocation in tight loops
4. **Simplify logic** - Can you defer expensive operations?

---

## Common Pitfalls

### 1. Premature Optimization

```typescript
// BAD: Over-engineering simple UI code
private readonly uiVec = new Vector2i(0, 0);

drawUI(): void {
    this.uiVec.set(10, 10);
    BT.printFont(font, this.uiVec, "Score: 0"); // Only called once per frame!
}

// GOOD: Keep it simple
drawUI(): void {
    BT.printFont(font, new Vector2i(10, 10), "Score: 0");
}
```

### 2. Ignoring the Profiler

Don't guess what's slow - **measure it**. Use:

- Chrome DevTools Performance tab
- `console.time()` / `console.timeEnd()`
- FPS counter: `BT.fps()`

### 3. Allocating in Hot Paths

```typescript
// BAD: Creating colors in tight loop
for (let i = 0; i < 1000; i++) {
  BT.drawPixel(pos, new Color32(255, 0, 0)); // 60,000 allocations/sec!
}

// GOOD: Reuse color
const red = new Color32(255, 0, 0);
for (let i = 0; i < 1000; i++) {
  BT.drawPixel(pos, red);
}
```

### 4. Excessive String Concatenation

```typescript
// BAD: Creates new string every frame
render(): void {
    BT.printFont(font, pos, "Score: " + this.score); // String allocation!
}

// BETTER: Template strings (still allocates, but cleaner)
render(): void {
    BT.printFont(font, pos, `Score: ${this.score}`);
}

// BEST: Only update when score changes
updateScore(newScore: number): void {
    this.scoreText = `Score: ${newScore}`;
}

render(): void {
    BT.printFont(font, pos, this.scoreText); // Reuse string
}
```

---

## Performance Rules of Thumb

### Object Allocation Guidelines

| Operations/Frame | Recommendation             | Example                                   |
| ---------------- | -------------------------- | ----------------------------------------- |
| < 10             | Inline allocation fine     | UI text, menu rendering                   |
| 10-50            | Borderline, prefer clarity | Simple animations, small particle systems |
| 50-100           | Consider pre-allocation    | Complex scenes, medium particle systems   |
| 100+             | Definitely pre-allocate    | Pattern demos, large particle systems     |

### When to Use Each Pattern

**Use inline allocation for:**

- UI rendering (< 10 operations)
- Menu systems
- Initialization code
- Debug rendering
- Anything that runs once or rarely

**Use pre-allocation for:**

- Particle systems (100+ particles)
- Complex pattern rendering
- Large scrolling worlds (camera example)
- Per-entity operations with 50+ entities
- Physics simulations

---

## Example References

The Blit-Tech examples demonstrate both approaches:

### Clarity-First Examples (Inline Allocation)

- **`basics.ts`** - Entry-level example teaching core concepts
- **`fonts.ts`** - Font rendering demonstrations
- **`primitives.ts`** - Drawing primitive shapes
- **`sprites.ts`** - Sprite rendering and tinting

These prioritize **readability and learning** over micro-optimizations.

### Performance-Optimized Examples (Pre-allocation)

- **`patterns.ts`** - Complex animations with 200+ operations/frame
- **`camera.ts`** - Scrolling world with many buildings

These demonstrate **when and how to optimize** for performance-critical scenarios.

### New Examples

- **`animation.ts`** - Tick-based timing (inline allocation, focus on clarity)
- **`sprite-effects.ts`** - Tinting effects (inline allocation, effects are GPU-free)

---

## Conclusion

**Start simple, optimize when needed:**

1. Write clear code with inline allocation
2. Profile to find actual bottlenecks
3. Optimize hot paths with pre-allocation
4. Keep UI and one-time code simple

Remember: **Clear code that runs at 60 FPS is better than complex code that runs at 65 FPS.**
