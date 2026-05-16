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

`.vscode/settings.json` and `.vscode/extensions.json` are committed to the repository — clone the repo and they appear
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
- [ ] Publish to npm (when ready)
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
