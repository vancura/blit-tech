# Developer Experience Guide

This guide covers the contributing workflow, code style conventions, IDE setup, and maintenance checklists for the
Blit-Tech project.

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor workflow. Key points:

- Fork the repository and create a feature branch from `main`.
- Use **Node.js** >=22.18.0 and **pnpm** 10.26.2+ (see `engines` and `packageManager` in `package.json`).
- Run `pnpm install` and confirm `pnpm preflight` passes before opening a PR.
- All commits require a DCO sign-off: use `git commit -s`.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
- Open a pull request against `main`. CI must be green before merge.

---

## Repository Scripts

These commands apply when building or maintaining **blit-tech** from a repository checkout (not when consuming the npm
package).

| Command                     | Description                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| `pnpm build`                | Build the library for npm distribution                                   |
| `pnpm lint`                 | Run ESLint                                                               |
| `pnpm lint:fix`             | Run ESLint with auto-fix                                                 |
| `pnpm format`               | Format all code (Biome + Prettier)                                       |
| `pnpm format:check`         | Check all formatting without changes                                     |
| `pnpm format:biome`         | Format TS/JS/JSON/CSS only (Biome)                                       |
| `pnpm format:prettier`      | Format Markdown/YAML/HTML/HBS (Prettier)                                 |
| `pnpm typecheck`            | Run TypeScript type checking                                             |
| `pnpm spellcheck`           | Check spelling in source files                                           |
| `pnpm test`                 | Run all unit tests (alias for `test:unit`)                               |
| `pnpm test:unit`            | Run all unit tests                                                       |
| `pnpm test:unit:watch`      | Run unit tests in watch mode                                             |
| `pnpm test:unit:coverage`   | Run unit tests with coverage report (80% threshold)                      |
| `pnpm test:visual`          | Playwright visual regression tests (requires Chrome with WebGPU)         |
| `pnpm test:visual:update`   | Update visual test baseline screenshots                                  |
| `pnpm test:visual:coverage` | Run visual tests with Istanbul coverage report                           |
| `pnpm bench`                | Run Tier 1 CPU benchmarks (Vitest bench)                                 |
| `pnpm bench:json`           | Run Tier 1 benchmarks and write `benchmark-results.json`                 |
| `pnpm preflight`            | Run all quality checks (format, lint, typecheck, spellcheck, knip, test) |
| `pnpm knip`                 | Find unused exports and dependencies                                     |
| `pnpm knip:fix`             | Auto-fix unused exports and dependencies                                 |
| `pnpm clean`                | Remove dist and cache directories                                        |
| `pnpm release`              | Build library and publish to npm                                         |
| `pnpm convert-font`         | Convert BMFont to .btfont format                                         |
| `pnpm system-font:export`   | Export system font data to PNG atlas (`assets/system-font.png`)          |
| `pnpm system-font:convert`  | Regenerate `systemFontData.ts` from edited PNG atlas                     |
| `pnpm security:audit`       | Run dependency security audit                                            |
| `pnpm security:audit:fix`   | Run dependency security audit and auto-fix                               |

---

## Documentation Index

| Guide                                                       | What it covers                                         |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| [API: Core](api-core.md)                                    | bootstrap, init, game loop, camera, Timer, core types  |
| [API: Rendering](api-rendering.md)                          | primitives, sprites, text, post-process, frame capture |
| [API: Palette](api-palette.md)                              | palette setup, presets, effects, serialization         |
| [Palette Guide](palette-guide.md)                           | palette-first workflow, offsets, effects, performance  |
| [Palette Presets](palette-presets.md)                       | built-in preset reference and exact color data         |
| [API: Assets](api-assets.md)                                | sprite sheets, bitmap fonts, asset loading             |
| [Input Guide](input.md)                                     | pointer, keyboard, gamepad                             |
| [Post-Process Effects](post-process-effects.md)             | effect chain, built-in effects, custom effects         |
| [Bitmap Fonts](bitmap-fonts.md)                             | .btfont format, BMFont conversion                      |
| [Testing](testing.md)                                       | test tiers, WebGPU mocks, visual regression            |
| [Performance Testing](performance-testing.md)               | CPU benchmarks, CI regression checks                   |
| [Performance Best Practices](performance-best-practices.md) | optimization guidelines                                |
| [Developer Experience](developer-experience-guide.md)       | contributing workflow, IDE setup                       |
| [Tooling](tooling.md)                                       | TypeScript pin, declaration checks, CI enforcement     |
| [Voice Guide](voice.md)                                     | error messages and user-facing string style            |

---

## Commit Guidelines

Format: `<type>(<scope>): <description>`

**Types:**

| Type       | When to use                                 |
| ---------- | ------------------------------------------- |
| `feat`     | New feature                                 |
| `fix`      | Bug fix                                     |
| `refactor` | Code change that is neither fix nor feature |
| `docs`     | Documentation only                          |
| `test`     | Tests only                                  |
| `chore`    | Build, config, tooling                      |
| `perf`     | Performance improvement                     |
| `ci`       | CI / workflow changes                       |

**Scopes:** `renderer`, `camera`, `assets`, `api`, `utils`, `examples`, `ci`, `docs`

AI-assisted commits add a trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

## Code Style

**Formatting:**

- 4-space indent, 120-character line width
- Single quotes, always semicolons, always trailing commas
- Biome formats TypeScript/JavaScript; Prettier formats Markdown/YAML
- Run `pnpm format` to auto-format; `pnpm format:check` to verify

**Linting:**

- ESLint with perfectionist, jsdoc, security, and promise plugins
- `pnpm lint` to check; `pnpm lint:fix` to auto-fix

**Naming conventions:**

- Public API methods: camelCase
- Types and classes: PascalCase
- Constants: `SCREAMING_SNAKE_CASE` for module-level; camelCase for local
- Named exports only; no default exports
- JSDoc required for all public API members
- **`BT` getters vs methods:** zero-argument read-only snapshots are getters (`BT.displaySize.y`); actions,
  parameterized queries, and async work are methods (`BT.cameraSet`, `BT.pointerPos(0)`). Full rules:
  [CLAUDE.md](../CLAUDE.md) (**BT API: getters vs methods**).
- **`BT` getter names** that surface `configure()` / `HardwareSettings` use the **same field names** (`displaySize`,
  `targetFPS`, `canvasDisplaySize`, …). Keep acronym spelling consistent (`targetFPS`, not `targetFps`). Runtime-only
  reads use descriptive names (`activeBackend`, `ticks`, `deltaSeconds`).

---

## IDE Setup

### Recommended extensions

| Extension                   | Purpose                |
| --------------------------- | ---------------------- |
| `dbaeumer.vscode-eslint`    | ESLint integration     |
| `biomejs.biome-vscode`      | Biome formatter        |
| `editorconfig.editorconfig` | EditorConfig support   |
| `ms-playwright.playwright`  | Playwright test runner |
| `vitest.explorer`           | Vitest test explorer   |

`.vscode/settings.json` and `.vscode/extensions.json` are committed to the repository - clone the repo and they appear
automatically in VS Code.

### Settings included

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["javascript", "typescript"],
  "files.associations": { "*.wgsl": "wgsl" }
}
```

---

## Dependency Management

Renovate is configured (`renovate.json` at the project root). Dependency update PRs open automatically each Monday
before 6 AM:

- Patch updates and GitHub Actions updates: auto-merge after 3 days
- Minor updates: manual review required
- Major updates: manual review with `major-update` label
- Vulnerability alerts are enabled

### Declaration tooling (TypeScript / API Extractor)

Public `.d.ts` output is produced by `vite-plugin-dts` with `rollupTypes: true`, which runs **API Extractor** during
`pnpm build`. API Extractor currently ships against **TypeScript 5.9.3**, so the workspace pins the same version in
`package.json` (not TypeScript 6.x) to avoid compiler drift warnings and keep declaration analysis deterministic.

When bumping `typescript` or `vite-plugin-dts`, confirm `pnpm build` logs **no** TS/API Extractor version mismatch and
that `dist/blit-tech.d.ts` still rolls up cleanly. Re-run `pnpm typecheck` after any TypeScript line change; TS 5.9
stricter WebGPU typings may require small test/production fixes (for example `ArrayBuffer`-backed uniform buffers).

**CI guard:** the `build-library` job runs `node scripts/check-declaration-tooling.mjs` on the `pnpm build` log after
each build. It fails on known drift-warning patterns and verifies the API Extractor bundled TypeScript version matches
`package.json`. Locally: `pnpm build` then `node scripts/check-declaration-tooling.mjs build.log`, or run
`pnpm test:declarations` for the checker unit tests.

---

## Maintenance Checklist

### Weekly

- [ ] Review and merge Dependabot/Renovate PRs
- [ ] Check open issues and respond
- [ ] Review open PRs
- [ ] Update the project board (if using)

### Monthly

- [ ] Review analytics/usage (if available)
- [ ] Update roadmap
- [ ] Check for security advisories
- [ ] Review and close stale issues

### Before Releases

- [ ] Run a full test suite
- [ ] Bump version
- [ ] Test library build
- [ ] Test examples deployment
- [ ] Create a GitHub release with notes
- [ ] Publish `blit-tech` to npm (`npm publish --access public`)
- [ ] Verify package page and install flow: https://www.npmjs.com/package/blit-tech and `npm install blit-tech`
- [ ] Announce on socials/discussions

### Quarterly

- [ ] Review and update documentation
- [ ] Evaluate new WebGPU features
- [ ] Performance benchmarking
- [ ] Dependency audit and cleanup
- [ ] Review contribution guidelines
- [ ] Update examples with new features

---

## Planned Improvements

The following items are tracked in Linear (VV team / Blit-Tech project) as low-priority `feat(dx)` tickets:

- GitHub issue templates (`.github/ISSUE_TEMPLATE/`)
- Pull request template (`.github/PULL_REQUEST_TEMPLATE.md`)
- Astro Starlight documentation site
- GitHub repo settings / topics

To file or view these tickets, use Linear with the VV team filter.
