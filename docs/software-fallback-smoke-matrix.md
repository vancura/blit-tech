# Software Fallback Smoke Matrix

This checklist is for quick manual verification of the software renderer. Originally written for `VV-490` (MVP); updated
for auto-fallback and the engine stats overlay (backend shown on the top bar when `statsOverlayEnabled` is true).

## Scope

- Backend under test: `software` (auto-fallback when WebGPU unavailable, `?renderer=software`, or
  `configure().renderer = 'software'`)
- Resolution target: low-res scenes (for example `320x240`)
- In scope: auto-fallback detection, stats overlay backend line, clear, clearRect, primitives, sprites, system text,
  bitmap text, camera offset, frame capture
- Out of scope: fullscreen shader/post-process effects (`effectAdd`, `effectRemove`, `effectClear`) in software mode

## Environment

- Browser: latest Chrome or Edge
- URL override for software mode:
  - `?renderer=software`
- Optional baseline comparison:
  - same page without override (WebGPU path)

## Matrix

| Scene                                   | What to verify                                   | Software expected result                                    | Notes                                     |
| --------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------- |
| Any page without `?renderer=software`   | Auto-fallback when WebGPU is absent              | Demo boots; `BT.activeBackend` = `'software'`               | No error page or hard stop                |
| Any page with software active           | Stats overlay top bar shows `software`           | Top bar reads `software \| WxH` (toggle with `~` or corner) | Disable with `statsOverlayEnabled: false` |
| `tests/visual/fixtures/primitives.html` | clear + clearRect + primitive rasterization      | Matches expected primitive layout and colors                | Check pixel edges are crisp               |
| `tests/visual/fixtures/camera.html`     | camera offset applied to all draw calls          | Geometry is shifted consistently by camera offset           | No partial drift between primitives       |
| `tests/visual/fixtures/sprites.html`    | indexed sprites + palette offsets + transparency | Sprite shapes/colors match expected output                  | Transparent pixels stay see-through       |
| `tests/visual/fixtures/fonts.html`      | system text + bitmap font rendering              | Text positions and glyph colors are correct                 | No missing glyph blocks                   |
| `tests/visual/fixtures/mixed.html`      | primitives + sprites + layering order            | Same stacking as WebGPU for this fixture                    | Parity covered by Playwright snapshot     |
| Frame capture via `BT.captureFrame()`   | PNG export in software mode                      | Promise resolves with PNG blob                              | Repeat capture across multiple frames     |

## Automated regression

Visual parity for software mode is exercised by Playwright under `tests/visual/` (`primitives`, `camera`, `sprites`,
`fonts`, `mixed` specs load fixtures with `?renderer=software`). Run `pnpm run test:visual` after renderer changes that
affect pixel output.

## Known exclusions (expected in MVP)

- Calling fullscreen effects APIs in software mode should fail clearly:
  - `BT.effectAdd(...)`
  - `BT.effectRemove(...)`
  - `BT.effectClear()`
- Expected message intent: software mode does not support fullscreen effects and suggests switching to WebGPU.

## Pass criteria

- All rows in the matrix pass in software mode.
- Software output is visually stable run-to-run for the same scene.
- Effect API failures are clear and actionable.
