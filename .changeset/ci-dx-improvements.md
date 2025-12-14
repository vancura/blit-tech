---
'blit-tech': patch
---

Add comprehensive CI checks and local development safeguards

- Add changeset verification workflow to enforce changelog entries on PRs
- Add PR checks for commit message linting, bundle size monitoring, and documentation links
- Add spell checking with cspell to CI and pre-commit hooks
- Add pre-push hook to run full project checks before pushing
- Add `preflight` script for running all checks locally before creating PRs
