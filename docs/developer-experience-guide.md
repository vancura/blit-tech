# Developer Experience Guide

This guide covers the contributing workflow, code style conventions, IDE setup, and maintenance checklists for the
Blit-Tech project.

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor workflow. Key points:

- Fork the repository and create a feature branch from `main`.
- Use **Node.js** >=22.18.0 and **pnpm** 10.26.2+ (see `engines` and `packageManager` in `package.json`).
- Run `pnpm install` and confirm `pnpm run preflight` passes before opening a PR.
- All commits require a DCO sign-off: use `git commit -s`.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
- Open a pull request against `main`. CI must be green before merge.

---

## Repository Scripts

These commands apply when building or maintaining **blit-tech** from a repository checkout (not when consuming the npm
package).

| Command                            | Description                                                              |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `pnpm run build`                   | Build the library for npm distribution                                   |
| `pnpm run lint`                    | Run ESLint                                                               |
| `pnpm run lint:fix`                | Run ESLint with auto-fix                                                 |
| `pnpm run format`                  | Format all code (Biome + Prettier)                                       |
| `pnpm run format:check`            | Check all formatting without changes                                     |
| `pnpm run format:biome`            | Format TS/JS/JSON/CSS only (Biome)                                       |
| `pnpm run format:prettier`         | Format Markdown/YAML/HTML/HBS (Prettier)                                 |
| `pnpm run typecheck`               | Run TypeScript type checking                                             |
| `pnpm run spellcheck`              | Check spelling in source files                                           |
| `pnpm run test`                    | Run all unit tests (alias for `test:unit`)                               |
| `pnpm run test:unit`               | Run all unit tests                                                       |
| `pnpm run test:unit:watch`         | Run unit tests in watch mode                                             |
| `pnpm run test:unit:coverage`      | Run unit tests with coverage report (80% threshold)                      |
| `pnpm run test:visual`             | Playwright visual regression tests (requires Chrome with WebGPU)         |
| `pnpm run test:visual:update`      | Update visual test baseline screenshots                                  |
| `pnpm run test:visual:coverage`    | Run visual tests with Istanbul coverage report                           |
| `pnpm run bench`                   | Run Tier 1 CPU benchmarks (Vitest bench)                                 |
| `pnpm run bench:json`              | Run Tier 1 benchmarks and write `benchmark-results.json`                 |
| `pnpm run preflight`               | Run all quality checks (format, lint, typecheck, spellcheck, knip, test) |
| `pnpm run knip`                    | Find unused exports and dependencies                                     |
| `pnpm run knip:fix`                | Auto-fix unused exports and dependencies                                 |
| `pnpm run clean`                   | Remove dist and cache directories                                        |
| `pnpm run release`                 | Build library and publish to npm                                         |
| `pnpm run convert-font`            | Convert BMFont to .btfont format                                         |
| `pnpm run system-font:export`      | Export system font data to PNG atlas (`assets/system-font.png`)          |
| `pnpm run system-font:convert`     | Regenerate `systemFontData.ts` from edited PNG atlas                     |
| `pnpm run security:audit`          | Run dependency security audit (all deps, moderate+; matches CI)          |
| `pnpm run security:audit:prod`     | Run production-only dependency audit (moderate+)                         |
| `pnpm run security:audit:fix`      | Run dependency security audit and auto-fix                               |
| `pnpm run security:mcp-preflight`  | MCP health/auth preflight and governance scan (requires `-- --mcps-dir`) |
| `pnpm run test:security-preflight` | Unit tests for MCP preflight script                                      |

Dependency audit severity policy and CI gate: [dependency-policy.md](security/dependency-policy.md). Temporary
exceptions: [audit-exceptions.md](security/audit-exceptions.md).

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
| [Security runbook](security/security-runbook.md)            | MCP preflight, fallbacks, governance, security runs    |
| [Dependency policy](security/dependency-policy.md)          | CI audit gate, severity threshold, refresh cadence     |
| [Audit exceptions](security/audit-exceptions.md)            | Temporary GHSA acceptance playbook                     |
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
- Run `pnpm run format` to auto-format; `pnpm run format:check` to verify

**Linting:**

- ESLint with perfectionist, jsdoc, security, and promise plugins
- `pnpm run lint` to check; `pnpm run lint:fix` to auto-fix

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
  reads use descriptive names (`activeBackend`, `requestedBackend`, `ticks`, `deltaSeconds`). Use `activeBackend` for
  runtime capability checks; `requestedBackend` mirrors resolved `HardwareSettings.backend` (including
  `?backend=software`).

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

CI workflows pin third-party actions by commit SHA (not `@vN` tags). See
[dependency-policy.md](security/dependency-policy.md#github-actions-pinning) for bumping SHAs and job permissions.

### Declaration tooling (TypeScript / API Extractor)

Public `.d.ts` output is produced by `vite-plugin-dts` with `rollupTypes: true`, which runs **API Extractor** during
`pnpm run build`. API Extractor currently ships against **TypeScript 5.9.3**, so the workspace pins the same version in
`package.json` (not TypeScript 6.x) to avoid compiler drift warnings and keep declaration analysis deterministic.

When bumping `typescript` or `vite-plugin-dts`, confirm `pnpm run build` logs **no** TS/API Extractor version mismatch
and that `dist/blit-tech.d.ts` still rolls up cleanly. Re-run `pnpm run typecheck` after any TypeScript line change; TS
5.9 stricter WebGPU typings may require small test/production fixes (for example `ArrayBuffer`-backed uniform buffers).

**CI guard:** the `build-library` job runs `node scripts/check-declaration-tooling.mjs` on the `pnpm run build` log
after each build. It fails on known drift-warning patterns and verifies the API Extractor bundled TypeScript version
matches `package.json`. Locally: `pnpm run build` then `node scripts/check-declaration-tooling.mjs build.log`, or run
`pnpm run test:declarations` for the checker unit tests.

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
- [ ] Run MCP governance preflight for `blit-tech` and `blit-tech-demos`
      (`pnpm run security:mcp-preflight -- --governance-only`; see
      [docs/security/security-runbook.md](security/security-runbook.md))
- [ ] Review shadow MCP flags and re-auth critical security MCPs if needed
- [ ] Review and close stale issues

### Before Releases

- [ ] Run a full test suite
- [ ] Bump version
- [ ] Test library build
- [ ] Test examples deployment
- [ ] Create a GitHub release with notes
- [ ] Publish `blit-tech` to npm (`pnpm run release` or `pnpm publish --access public` after `pnpm run build`)
- [ ] Verify package page and install flow: https://www.npmjs.com/package/blit-tech and `npm install blit-tech`

npm **provenance** is not enabled: publishing is local-only today. `pnpm publish --provenance` needs an OIDC-backed CI
publish job; see [dependency-policy.md](security/dependency-policy.md#npm-publish-provenance).

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
