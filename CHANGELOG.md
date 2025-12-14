# blit-tech

## 0.1.0

### Minor Changes

- Add display size and tick counter APIs to Core
- Add cache checking APIs to `AssetLoader`
- Add modern variable-width bitmap font system with `.btfont` format
- Add `ImageBitmap` support and `destroy()` method to `SpriteSheet`
- Add `TextSize` type and measurement caching to `BitmapFont`
- Enhance `Color32`, `Rect2i`, and `Vector2i` utility classes with new methods

### Patch Changes

- Add Cloudflare Pages deployment configuration
- Refactor `Renderer` texture handling and frame state management
- Add Plausible Analytics tracking to examples for production deployments
- Update developer experience guide, testing guide, and refine examples documentation
- Add new animation and sprite effects demos to examples
- 576de03: Add Electron desktop packaging for Steam Deck deployment
- Reorganize root directories and consolidate scripts into unified location
- Add `sync-rules` script to manage AI assistant rules across the project
- Fix double `requestAnimationFrame` wait for canvas initialization
- Add Uberspace auto-deployment workflow
- a9e3543: Support multiple textures per frame with proper sprite batch queue
- Upgrade dependencies including new ESLint plugins for security and code quality
