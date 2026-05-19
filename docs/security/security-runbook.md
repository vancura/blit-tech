# Security runbook

Deterministic security workflow for Blit-Tech repos when MCP scanners are healthy, degraded, or unavailable. Use with
the `/security-run` skill and `pnpm security:mcp-preflight`.

## When to run

- Before a comprehensive security assessment or hardening pass.
- Before `/deep-review` when security tooling is in scope.
- Monthly MCP governance audit (see [Periodic governance](#periodic-governance-monthly)).

## MCP preflight (required first step)

Agents must pass the Cursor project MCP descriptor path from the session (for example
`~/.cursor/projects/<workspace-id>/mcps`).

```bash
cd /Users/vancura/Repos/_BLIT_TECH_/blit-tech

pnpm security:mcp-preflight -- \
  --mcps-dir "<cursor-project-mcps-path>" \
  --repo-root . \
  --allow-fallback \
  --output-json security-reports/mcp-preflight-latest.json
```

Governance-only (monthly):

```bash
pnpm security:mcp-preflight -- \
  --mcps-dir "<cursor-project-mcps-path>" \
  --repo-root . \
  --governance-only \
  --include-user-config \
  --output-json security-reports/mcp-governance-$(date +%Y-%m).json
```

Exit codes:

- `0` — proceed (critical MCP healthy, or `--allow-fallback` with documented fallbacks).
- `1` — missing `--mcps-dir`, invalid path, or critical MCP down without `--allow-fallback`.

Never skip the preflight silently. If a tier is unavailable, run the fallback row from the matrix below and record it in
the report.

## Fallback matrix

| Capability            | Primary MCP                   | Fallback (always available)                                                                                                                              |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency / SCA      | Opsera `security-scan`, JFrog | `pnpm security:audit`, `pnpm audit --prod --audit-level=moderate` (per repo)                                                                             |
| SAST / code patterns  | Opsera, Semgrep MCP           | `pnpm lint` (eslint-plugin-security), targeted `rg` patterns (below), optional `semgrep --config auto` only if CLI is already installed (do not install) |
| Compliance            | Opsera `compliance-audit`     | Manual checklist below                                                                                                                                   |
| Architecture          | Opsera `architecture-analyze` | `security-threat-model` and `security-ownership-map` skills under `~/.codex/skills/`                                                                     |
| Supply chain metadata | JFrog MCP                     | `pnpm outdated --format json`, `npm view <pkg> version time.modified license` for key direct deps                                                        |
| MCP governance        | —                             | `pnpm security:mcp-preflight --governance-only` plus Runlayer MCP governance rules                                                                       |

### SAST `rg` patterns (fallback)

Run from each repo root when Semgrep/Opsera SAST is unavailable:

```bash
rg -n "innerHTML|outerHTML|insertAdjacentHTML|document\\.write\\(|eval\\(|new Function|postMessage\\(|localStorage|sessionStorage" src/
rg -n "CSP|Content-Security-Policy|X-Frame-Options|frame-ancestors|Referrer-Policy" .
```

## Compliance fallback checklist

When Opsera `compliance-audit` MCP is unavailable, gather evidence manually:

| Control area                 | Evidence source                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Dependency vulnerabilities   | `pnpm security:audit`, `pnpm audit --prod --audit-level=moderate`                            |
| Code quality / static checks | `pnpm preflight`, `pnpm lint`                                                                |
| Secrets in repo              | `.gitignore`, hooks blocking `.env`; `rg` for hardcoded tokens (no secret values in reports) |
| CI integrity                 | `.github/workflows/*.yml` — pinned actions, least privilege                                  |
| Deploy headers (demos)       | `blit-tech-demos/public/_headers`, `curl -I` on deployed URLs                                |
| Ownership / bus factor       | `security-ownership-map` skill output (`summary.json`)                                       |
| MCP governance               | `pnpm security:mcp-preflight --governance-only`                                              |

## Repo-native commands

### blit-tech

```bash
cd /Users/vancura/Repos/_BLIT_TECH_/blit-tech

pnpm security:mcp-preflight -- --mcps-dir "<mcps>" --repo-root . --allow-fallback
pnpm security:audit
pnpm audit --prod --audit-level=moderate
pnpm audit --dev --audit-level=moderate
pnpm preflight
```

Key direct dependencies for supply-chain spot checks: `vite`, `typescript`, `eslint`, `vitest`, `happy-dom`.

```bash
npm view vite version time.modified license
npm view typescript version time.modified license
```

### blit-tech-demos

```bash
cd /Users/vancura/Repos/_BLIT_TECH_/blit-tech-demos

pnpm security:mcp-preflight -- \
  --mcps-dir "<mcps>" \
  --repo-root /Users/vancura/Repos/_BLIT_TECH_/blit-tech-demos \
  --allow-fallback

pnpm security:audit
pnpm audit --prod --audit-level=moderate
pnpm audit --dev --audit-level=moderate
pnpm preflight
pnpm build
```

After toolchain or dependency upgrades, always run `pnpm build` as a smoke test.

Demos can invoke the canonical preflight script from the library repo:

```bash
node ../blit-tech/scripts/security/mcp-preflight.mjs --mcps-dir "<mcps>" --repo-root . --allow-fallback
```

## Periodic governance (monthly)

1. Run governance-only preflight for **both** repos (use each repo as `--repo-root`).
2. Review shadow MCP flags; migrate or remove unmanaged servers per organizational policy.
3. Re-authenticate critical MCPs (Opsera) if status is `auth_required`.
4. Store reports under `security-reports/` (gitignored).

## Report template

Use this structure in agent output or Linear comments:

```md
## Security run report

### MCP preflight

- Opsera: <status>
- JFrog: <status>
- Semgrep: <status>
- Fallbacks used: <list>

### blit-tech

- security:audit: <pass/fail summary>
- prod audit: <pass/fail>
- preflight: <pass/fail>

### blit-tech-demos

- security:audit: <pass/fail summary>
- prod audit: <pass/fail>
- preflight: <pass/fail>
- build: <pass/fail>

### Governance

- Shadow MCPs: <count / none>
- Config paths scanned: <list>
```
