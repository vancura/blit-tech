# Dependency security policy

Continuous dependency vulnerability gating for the `blit-tech` library repo.

## Severity gate

| Scope                         | Command                    | Fail threshold         |
| ----------------------------- | -------------------------- | ---------------------- |
| All dependencies (dev + prod) | `pnpm security:audit`      | **Moderate** and above |
| Production / runtime only     | `pnpm security:audit:prod` | **Moderate** and above |

Low and informational advisories do **not** fail CI or local gates.

CI runs both checks on every pull request and push to `main` via the **Dependency Security Audit** job in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

## Local verification

```bash
cd blit-tech
pnpm install --frozen-lockfile
pnpm security:audit
pnpm security:audit:prod
```

`pnpm security:audit` must match what CI runs. Do not rely on `pnpm audit --fix` alone before a release without
re-running both commands.

## Dependency refresh cadence

| Cadence                 | Mechanism                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Automated (weekly)**  | [Renovate](https://docs.renovatebot.com/) — Monday before 06:00 Europe/Prague; `vulnerabilityAlerts` open PRs with the `security` label |
| **Automated (monthly)** | Renovate `lockFileMaintenance` — first day of the month                                                                                 |
| **Manual (monthly)**    | Review `pnpm outdated`; run the [security runbook](./security-runbook.md) MCP preflight and audits                                      |
| **Per release**         | Run `pnpm security:audit` and `pnpm security:audit:prod` before tagging                                                                 |

Patch updates for GitHub Actions and npm patches may automerge per [renovate.json](../../renovate.json). Minor and major
updates require manual review.

## Supply-chain settings

[`.npmrc`](../../.npmrc) enables `minimum-release-age` (7 days) and related pnpm 10 hardening. Security-patched packages
blocked by release age may be listed in `minimum-release-age-exclude[]` together with `pnpm.overrides` in
[`package.json`](../../package.json). Document the reason in the PR that introduces the exclude or override.

## Temporary risk acceptance

Do not merge with a failing audit unless the finding is formally accepted:

1. Open a [security risk acceptance](../../.github/ISSUE_TEMPLATE/security-risk-acceptance.yml) issue.
2. Record the GHSA in [audit-exceptions.md](./audit-exceptions.md).
3. Add the GHSA to `pnpm.auditConfig.ignoreGhsas` in `package.json` (review and remove by the expiry date).

See [audit-exceptions.md](./audit-exceptions.md) for the full playbook.

## Related docs

- [security-runbook.md](./security-runbook.md) — MCP preflight, fallback matrix, report template
- [developer-experience-guide.md](../developer-experience-guide.md) — script reference
