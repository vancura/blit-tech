# BT API: getters vs methods

Canonical reference: [CLAUDE.md](../../CLAUDE.md) (**BT API: getters vs methods**).

Quick rules when changing `src/BlitTech.ts` or demos:

- **Getter:** zero-arg read-only snapshot (`BT.logicalSize`, `BT.targetFPS`, `BT.ticks`, `BT.activeBackend`)
- **Method:** mutation, parameters, or async (`BT.cameraSet`, `BT.pointerPos(0)`, `await BT.captureFrame()`)
- **Never** reintroduce `BT.logicalSize()` / `BT.getActiveBackend()`-style call syntax for these reads

## Getter list

| Category | Members |
| - | - |
| Configure-time (mirror `HardwareSettings` names) | `logicalSize`, `drawingBufferSize`, `targetFPS` |
| Derived | `outputSize` (`drawingBufferSize ?? logicalSize`; no `HardwareSettings` field) |
| Configure-time (backend) | `requestedBackend` (mirrors `HardwareSettings.backend`) |
| Loop timing | `deltaSeconds`, `timeSeconds`, `ticks` |
| Runtime state | `activeBackend`, `camera`, `palette` |
| Per-frame input | `pointerScrollDelta`, `inputString`, `gamepadCount` |

`Vector2i` getters return a clone per read. `activeBackend` is what actually started after fallback, not
`configure().backend`.
`palette` is a live reference - mutating slots affects rendering on the next frame.

## Naming when adding getters

- Match `HardwareSettings` field name exactly for configure values (`targetFPS`, not `fps` or `targetFps`)
- Use a derived getter when the value is computed from configure fields (`outputSize`); do not add a matching field
- Use a runtime-descriptive name when no configure field exists (`activeBackend`, not `renderer`)

Cursor: `.cursor/rules/bt-api-getters.mdc` (always applied in this repo).
