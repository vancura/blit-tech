# Audit exceptions playbook

Use this when a **moderate or higher** advisory cannot be remediated immediately and CI must stay green with explicit
risk acceptance.

## When to use

- Upstream has no patched release yet.
- A major toolchain bump is required and is scheduled on a tracked issue.
- `pnpm.overrides` are insufficient and the only alternative is a documented temporary ignore.

Do **not** use exceptions for low-severity findings (CI does not gate on them).

## Process

1. **Open a risk-acceptance issue** using the
   [security risk acceptance template](../../.github/ISSUE_TEMPLATE/security-risk-acceptance.yml).
2. **Link a remediation issue** (Linear or GitHub) with an owner and target date.
3. **Add the GHSA** to `package.json`:

   ```json
   "pnpm": {
     "auditConfig": {
       "ignoreGhsas": ["GHSA-xxxx-xxxx-xxxx"]
     }
   }
   ```

4. **Record the exception** in the table below (one row per GHSA).
5. **Set a review-by date** (default: 30 days; extend only with written rationale in the issue).
6. **Remove on expiry** — delete the GHSA from `ignoreGhsas`, clear the table row, and close the acceptance issue.

## Active exceptions

| GHSA   | Package / path | Severity | Accepted | Review by | Remediation issue | Owner |
| ------ | -------------- | -------- | -------- | --------- | ----------------- | ----- |
| _none_ |                |          |          |           |                   |       |

## Technical notes

- Prefer `pnpm.overrides` and direct dependency upgrades over `ignoreGhsas` when a patched version exists.
- If `minimum-release-age` in [`.npmrc`](../../.npmrc) blocks a security patch, add the package to
  `minimum-release-age-exclude[]` in the same PR as the override and document why.
- After any exception, still run `pnpm run security:audit:prod` — production dependencies must remain clean unless
  explicitly documented otherwise.
