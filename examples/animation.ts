/**
 * Animation & Timing Demo
 *
 * Demonstrates tick-based animation and timing mechanics in Blit–Tech.
 * Shows how to use BT.ticks() for frame-based game logic including:
 * - Sprite animation with frame cycling
 * - Animation state machines
 * - Cooldown timers and event scheduling
 * - Deterministic frame-based logic
 */

import {
    BitmapFont,
    BT,
    Color32,
    type HardwareSettings,
    type IBlitTechGame,
    Rect2i,
    SpriteSheet,
    Vector2i,
} from '../src/BlitTech';

/**
 * Animation states for the character.
 */
enum AnimState {
    Idle = 'Idle',
    Walking = 'Walking',
    Jumping = 'Jumping',
}

/**
 * Character animation data.
 */
interface CharacterAnimation {
    state: AnimState;
    frameIndex: number;
    frameDuration: number; // Ticks per frame
    lastFrameChangeTick: number;
}

/**
 * Demonstrates tick-based animation timing and state management.
 */
class AnimationDemo implements IBlitTechGame {
    // #region Module State

    /** Bitmap font for UI text. */
    private font: BitmapFont | null = null;

    /** Sprite sheet for animated character. */
    private spriteSheet: SpriteSheet | null = null;

    /** Character animation state. */
    private animation: CharacterAnimation = {
        state: AnimState.Idle,
        frameIndex: 0,
        frameDuration: 8, // 8 ticks per frame
        lastFrameChangeTick: 0,
    };

    /** Character position. */
    private charPos: Vector2i = new Vector2i(80, 100);

    /** Ability cooldown timer (in ticks). */
    private abilityCooldownTicks: number = 0;
    private readonly abilityCooldownDuration: number = 120; // 2 seconds at 60 FPS

    /** Spawn timer for periodic events. */
    private lastSpawnTick: number = 0;
    private readonly spawnInterval: number = 180; // 3 seconds at 60 FPS

    /** Particle effects spawned periodically. */
    private particles: Array<{ pos: Vector2i; spawnTick: number }> = [];

    /** Jump animation timer. */
    private jumpStartTick: number = 0;
    private readonly jumpDuration: number = 60; // 1 second at 60 FPS

    // #endregion

    // #region IBlitTechGame Implementation

    /**
     * Configures hardware settings for this game.
     * Sets up a 320×240 internal resolution with 2x CSS upscaling.
     *
     * @returns Hardware configuration specifying display size and target FPS.
     */
    queryHardware(): HardwareSettings {
        return {
            displaySize: new Vector2i(320, 240),
            canvasDisplaySize: new Vector2i(640, 480),
            targetFPS: 60,
        };
    }

    /**
     * Initializes game state after the engine is ready.
     *
     * @returns Promise resolving to true when initialization succeeds.
     */
    async initialize(): Promise<boolean> {
        console.log('[AnimationDemo] Initializing...');

        // Load font
        try {
            this.font = await BitmapFont.load('fonts/PragmataPro14.btfont');
            console.log(`[AnimationDemo] Loaded font: ${this.font.name}`);
        } catch (error: unknown) {
            console.error('[AnimationDemo] Failed to load font:', error);
            return false;
        }

        // Create sprite sheet for character animation
        this.spriteSheet = await this.createAnimatedSpriteSheet();
        console.log('[AnimationDemo] Created sprite sheet');

        console.log('[AnimationDemo] Initialization complete!');
        return true;
    }

    /**
     * Updates animation state based on ticks.
     * Demonstrates frame-based logic and timing.
     */
    update(): void {
        const currentTick = BT.ticks();

        // Update character animation frame
        this.updateAnimation(currentTick);

        // Update ability cooldown
        if (this.abilityCooldownTicks > 0) {
            this.abilityCooldownTicks--;
        }

        // Periodic particle spawning
        if (currentTick - this.lastSpawnTick >= this.spawnInterval) {
            this.spawnParticle();
            this.lastSpawnTick = currentTick;
        }

        // Remove old particles (after 3 seconds)
        this.particles = this.particles.filter((p) => currentTick - p.spawnTick < 180);

        // Auto-cycle animation states for demonstration
        this.autoCycleStates(currentTick);
    }

    /**
     * Renders game graphics (animated character and UI).
     */
    render(): void {
        // Clear screen
        BT.clear(new Color32(30, 20, 40));

        if (!this.font || !this.spriteSheet) {
            BT.print(new Vector2i(10, 10), Color32.white(), 'Loading...');
            return;
        }

        // Draw ground
        BT.drawRectFill(new Rect2i(0, 150, 320, 90), new Color32(40, 60, 40));

        // Draw animated character
        this.drawCharacter();

        // Draw particles
        this.drawParticles();

        // Draw UI
        this.drawUI();
    }

    // #endregion

    // #region Animation Logic

    /**
     * Updates animation frame based on tick counter.
     */
    private updateAnimation(currentTick: number): void {
        // Check if it's time to advance the frame
        if (currentTick - this.animation.lastFrameChangeTick >= this.animation.frameDuration) {
            this.animation.frameIndex = (this.animation.frameIndex + 1) % this.getFrameCount(this.animation.state);
            this.animation.lastFrameChangeTick = currentTick;
        }

        // Update jump animation offset
        if (this.animation.state === AnimState.Jumping) {
            const jumpProgress = (currentTick - this.jumpStartTick) / this.jumpDuration;
            if (jumpProgress >= 1.0) {
                this.changeState(AnimState.Idle);
            }
        }
    }

    /**
     * Changes animation state and resets frame.
     */
    private changeState(newState: AnimState): void {
        if (this.animation.state !== newState) {
            this.animation.state = newState;
            this.animation.frameIndex = 0;
            this.animation.lastFrameChangeTick = BT.ticks();

            if (newState === AnimState.Jumping) {
                this.jumpStartTick = BT.ticks();
            }
        }
    }

    /**
     * Auto-cycles through animation states for demonstration.
     */
    private autoCycleStates(currentTick: number): void {
        const cycleTime = (currentTick % 360) / 60; // 6-second cycle

        if (cycleTime < 2) {
            if (this.animation.state !== AnimState.Idle) {
                this.changeState(AnimState.Idle);
            }
        } else if (cycleTime < 4) {
            if (this.animation.state !== AnimState.Walking) {
                this.changeState(AnimState.Walking);
            }
        } else {
            if (this.animation.state !== AnimState.Jumping) {
                this.changeState(AnimState.Jumping);
                // Trigger ability cooldown when jumping
                if (this.abilityCooldownTicks === 0) {
                    this.abilityCooldownTicks = this.abilityCooldownDuration;
                }
            }
        }
    }

    /**
     * Gets the number of frames for an animation state.
     */
    private getFrameCount(state: AnimState): number {
        switch (state) {
            case AnimState.Idle:
                return 4;
            case AnimState.Walking:
                return 6;
            case AnimState.Jumping:
                return 4;
        }
    }

    // #endregion

    // #region Rendering

    /**
     * Draws the animated character with current frame and state.
     */
    private drawCharacter(): void {
        if (!this.spriteSheet) return;

        // Calculate sprite position in sheet
        const stateRow = this.getStateRow(this.animation.state);
        const spriteSize = 32;
        const srcRect = new Rect2i(
            this.animation.frameIndex * spriteSize,
            stateRow * spriteSize,
            spriteSize,
            spriteSize,
        );

        // Calculate Y offset for jump animation
        let yOffset = 0;
        if (this.animation.state === AnimState.Jumping) {
            const jumpProgress = (BT.ticks() - this.jumpStartTick) / this.jumpDuration;
            yOffset = -Math.abs(Math.sin(jumpProgress * Math.PI) * 30);
        }

        // Draw character sprite
        const drawPos = new Vector2i(this.charPos.x, this.charPos.y + yOffset);
        BT.drawSprite(this.spriteSheet, srcRect, drawPos, Color32.white());

        // Draw shadow
        const shadowColor = new Color32(0, 0, 0, 100);
        const shadowY = this.charPos.y + spriteSize - 4;
        BT.drawRectFill(new Rect2i(this.charPos.x + 8, shadowY, 16, 4), shadowColor);
    }

    /**
     * Gets the sprite sheet row for an animation state.
     */
    private getStateRow(state: AnimState): number {
        switch (state) {
            case AnimState.Idle:
                return 0;
            case AnimState.Walking:
                return 1;
            case AnimState.Jumping:
                return 2;
        }
    }

    /**
     * Spawns a particle at a random position.
     */
    private spawnParticle(): void {
        const x = Math.floor(Math.random() * 300) + 10;
        const y = Math.floor(Math.random() * 100) + 30;
        this.particles.push({
            pos: new Vector2i(x, y),
            spawnTick: BT.ticks(),
        });
    }

    /**
     * Draws particles with fade-out effect.
     */
    private drawParticles(): void {
        const currentTick = BT.ticks();

        for (const particle of this.particles) {
            const age = currentTick - particle.spawnTick;
            const lifetime = 180;
            const alpha = Math.floor(255 * (1 - age / lifetime));

            // Rainbow color based on spawn time
            const hue = (particle.spawnTick * 3) % 360;
            const color = this.hslToRgb(hue, 100, 60);
            color.a = alpha;

            BT.drawRectFill(new Rect2i(particle.pos.x - 2, particle.pos.y - 2, 4, 4), color);
        }
    }

    /**
     * Draws UI showing timing information.
     */
    private drawUI(): void {
        if (!this.font) return;

        // Title
        BT.printFont(this.font, new Vector2i(10, 10), 'ANIMATION & TIMING DEMO', Color32.white());

        // Current state
        BT.printFont(this.font, new Vector2i(10, 30), `State: ${this.animation.state}`, new Color32(100, 200, 255));

        // Frame index
        BT.printFont(
            this.font,
            new Vector2i(10, 45),
            `Frame: ${this.animation.frameIndex + 1}/${this.getFrameCount(this.animation.state)}`,
            new Color32(150, 150, 150),
        );

        // Tick counter
        BT.printFont(this.font, new Vector2i(10, 60), `Ticks: ${BT.ticks()}`, new Color32(150, 150, 150));

        // Cooldown timer
        const cooldownPercent = Math.max(0, this.abilityCooldownTicks / this.abilityCooldownDuration);
        const cooldownColor = cooldownPercent > 0 ? new Color32(255, 100, 100) : new Color32(100, 255, 100);

        BT.printFont(
            this.font,
            new Vector2i(10, 75),
            `Cooldown: ${Math.ceil(this.abilityCooldownTicks / 60)}s`,
            cooldownColor,
        );

        // Cooldown progress bar
        const barWidth = 100;
        const barHeight = 8;
        const barX = 10;
        const barY = 92;

        // Bar background
        BT.drawRectFill(new Rect2i(barX, barY, barWidth, barHeight), new Color32(40, 40, 40));

        // Bar fill
        if (cooldownPercent > 0) {
            const fillWidth = Math.floor(barWidth * cooldownPercent);
            BT.drawRectFill(new Rect2i(barX, barY, fillWidth, barHeight), new Color32(255, 100, 100));
        }

        // Bar outline
        BT.drawRect(new Rect2i(barX, barY, barWidth, barHeight), new Color32(150, 150, 150));

        // Next spawn timer
        const ticksUntilSpawn = this.spawnInterval - (BT.ticks() - this.lastSpawnTick);
        BT.printFont(
            this.font,
            new Vector2i(10, 110),
            `Next spawn: ${Math.ceil(ticksUntilSpawn / 60)}s`,
            new Color32(200, 200, 100),
        );

        // Active particles
        BT.printFont(
            this.font,
            new Vector2i(10, 125),
            `Particles: ${this.particles.length}`,
            new Color32(150, 150, 150),
        );

        // Info box
        BT.printFont(this.font, new Vector2i(10, 165), 'Tick-based Animation:', new Color32(255, 200, 100));
        BT.printFont(this.font, new Vector2i(10, 180), '- Deterministic frame timing', new Color32(180, 180, 180));
        BT.printFont(this.font, new Vector2i(10, 195), '- Cooldown & event scheduling', new Color32(180, 180, 180));
        BT.printFont(this.font, new Vector2i(10, 210), '- State machine transitions', new Color32(180, 180, 180));

        // FPS counter
        BT.printFont(this.font, new Vector2i(250, 225), `FPS: ${BT.fps()}`, new Color32(100, 100, 100));
    }

    // #endregion

    // #region Sprite Sheet Creation

    /**
     * Creates a sprite sheet with animated character frames.
     * In production, load from an image file instead.
     */
    private async createAnimatedSpriteSheet(): Promise<SpriteSheet> {
        const canvas = document.createElement('canvas');
        const spriteSize = 32;
        const cols = 6; // Max frames per row
        const rows = 3; // Number of animation states

        canvas.width = cols * spriteSize;
        canvas.height = rows * spriteSize;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('[AnimationDemo] Failed to acquire 2D canvas context');
        }

        // Clear background
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';

        // Row 0: Idle animation (4 frames)
        for (let i = 0; i < 4; i++) {
            this.drawIdleFrame(ctx, i * spriteSize, 0, spriteSize, i);
        }

        // Row 1: Walking animation (6 frames)
        for (let i = 0; i < 6; i++) {
            this.drawWalkFrame(ctx, i * spriteSize, spriteSize, spriteSize, i);
        }

        // Row 2: Jumping animation (4 frames)
        for (let i = 0; i < 4; i++) {
            this.drawJumpFrame(ctx, i * spriteSize, spriteSize * 2, spriteSize, i);
        }

        // Convert to image
        const dataUrl = canvas.toDataURL();
        const image = new Image();
        await new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.src = dataUrl;
        });

        return new SpriteSheet(image);
    }

    /**
     * Draws an idle animation frame.
     */
    private drawIdleFrame(ctx: CanvasRenderingContext2D, x: number, y: number, _size: number, frame: number): void {
        // Simple bobbing animation
        const bobOffset = Math.sin(frame * 0.5) * 2;

        // Body
        ctx.fillRect(x + 12, y + 12 + bobOffset, 8, 12);

        // Head
        ctx.fillRect(x + 10, y + 8 + bobOffset, 12, 8);

        // Arms
        ctx.fillRect(x + 8, y + 14 + bobOffset, 4, 6);
        ctx.fillRect(x + 20, y + 14 + bobOffset, 4, 6);

        // Legs
        ctx.fillRect(x + 11, y + 24, 4, 6);
        ctx.fillRect(x + 17, y + 24, 4, 6);
    }

    /**
     * Draws a walking animation frame.
     */
    private drawWalkFrame(ctx: CanvasRenderingContext2D, x: number, y: number, _size: number, frame: number): void {
        // Leg positions alternate
        const leg1Y = 24 + (frame % 2 === 0 ? 2 : 0);
        const leg2Y = 24 + (frame % 2 === 1 ? 2 : 0);

        // Body
        ctx.fillRect(x + 12, y + 12, 8, 12);

        // Head
        ctx.fillRect(x + 10, y + 8, 12, 8);

        // Arms (swinging)
        const armOffset = frame % 2 === 0 ? 1 : -1;
        ctx.fillRect(x + 8, y + 14 + armOffset, 4, 6);
        ctx.fillRect(x + 20, y + 14 - armOffset, 4, 6);

        // Legs (walking)
        ctx.fillRect(x + 11, y + leg1Y, 4, 6);
        ctx.fillRect(x + 17, y + leg2Y, 4, 6);
    }

    /**
     * Draws a jumping animation frame.
     */
    private drawJumpFrame(ctx: CanvasRenderingContext2D, x: number, y: number, _size: number, _frame: number): void {
        // Body
        ctx.fillRect(x + 12, y + 12, 8, 12);

        // Head
        ctx.fillRect(x + 10, y + 8, 12, 8);

        // Arms (raised)
        ctx.fillRect(x + 8, y + 10, 4, 6);
        ctx.fillRect(x + 20, y + 10, 4, 6);

        // Legs (together)
        ctx.fillRect(x + 12, y + 24, 8, 6);
    }

    // #endregion

    // #region Helper Functions

    /**
     * Converts HSL to RGB color.
     */
    private hslToRgb(h: number, s: number, l: number): Color32 {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return new Color32(Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255));
    }

    // #endregion
}

// #region Helper Functions

function showError(title: string, message: string): void {
    const container = document.getElementById('canvas-container');
    if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText =
            'padding: 40px; text-align: center; color: #ff6b6b; background: #2a0000; border-radius: 8px;';

        const heading = document.createElement('h2');
        heading.textContent = `[X] ${title}`;
        errorDiv.appendChild(heading);

        const msg = document.createElement('p');
        msg.style.cssText = 'margin: 20px 0;';
        msg.textContent = message;
        errorDiv.appendChild(msg);

        const consoleMsg = document.createElement('p');
        consoleMsg.style.cssText = 'font-size: 0.9em; color: #ff9999;';
        consoleMsg.textContent = 'Check the browser console for more details.';
        errorDiv.appendChild(consoleMsg);

        container.innerHTML = '';
        container.appendChild(errorDiv);
    }
}

// #endregion

// #region Main Logic

async function main(): Promise<void> {
    if (!navigator.gpu) {
        showError(
            'WebGPU Not Supported',
            'Your browser does not support WebGPU. Please use Chrome/Edge 113+ or Firefox Nightly.',
        );
        return;
    }

    const canvas = document.getElementById('game-canvas');

    if (!(canvas instanceof HTMLCanvasElement)) {
        console.error('[Main] Canvas element not found or is not a <canvas>');

        return;
    }

    const game = new AnimationDemo();

    if (await BT.initialize(game, canvas)) {
        console.log('[Main] Animation demo started successfully!');
    } else {
        showError('Initialization Failed', 'Failed to initialize Blit–Tech engine. Check console for details.');
    }
}

// #endregion

// #region App Lifecycle

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

// #endregion
