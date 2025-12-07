# Developer Experience Guide

This document provides comprehensive guidance for improving developer experience, community tools, and documentation for
Blit-Tech.

## Table of Contents

- [Overview](#overview)
- [Contributing Guidelines](#contributing-guidelines)
- [GitHub Issue Templates](#github-issue-templates)
- [Pull Request Template](#pull-request-template)
- [Code of Conduct](#code-of-conduct)
- [Dependency Management](#dependency-management)
- [Astro Starlight Documentation](#astro-starlight-documentation)
- [Additional Improvements](#additional-improvements)
- [Maintenance Checklist](#maintenance-checklist)

---

## Overview

**Goal:** Create a welcoming, well-documented project that makes contributing easy and maintains high code quality
automatically.

**Deliverables:**

1. ✓ Contributing guidelines (CONTRIBUTING.md)
2. ✓ GitHub issue templates (bug, feature, question)
3. ✓ Pull request template with checklist
4. ✓ Code of Conduct (CODE_OF_CONDUCT.md)
5. ✓ Automated dependency updates (Dependabot/Renovate)
6. ✓ Astro Starlight documentation site preparation
7. ✓ Additional DX improvements

---

## Contributing Guidelines

### Create CONTRIBUTING.md

This file guides new contributors through the development workflow.

**Location:** `CONTRIBUTING.md` (root)

**Content:**

````markdown
# Contributing to Blit-Tech

Thank you for your interest in contributing to Blit-Tech! This document provides guidelines and instructions for
contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Code Style](#code-style)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js v20 or higher
- pnpm v10.24.0 or higher
- Git
- A WebGPU-compatible browser (Chrome 113+, Edge 113+, Safari 18+)

### Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/blit-tech.git
   cd blit-tech
   ```
````

````markdown
3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Create a branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

### Running the Project

- **Development server:** `pnpm dev` (opens examples gallery)
- **Type checking:** `pnpm typecheck`
- **Linting:** `pnpm lint`
- **Formatting:** `pnpm format`
- **Tests:** `pnpm test:unit` and `pnpm test:e2e`

## Development Workflow

### 1. Make Changes

- Edit source files in `src/`
- Add/update examples in `examples/`
- Write tests in `tests/`

### 2. Test Locally

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test:unit
pnpm test:e2e

# Check formatting
pnpm format:check

# Run linter
pnpm lint
```

### 3. Pre-commit Hooks

Husky runs automatically on commit:

- ✓ Biome formatting for TS/JS/JSON/CSS (auto-fix)
- ✓ Prettier formatting for Markdown/YAML (auto-fix)
- ✓ ESLint (auto-fix)
- ✓ TypeScript type checking
- ✓ Unit tests (if they exist)
- ✓ Commit message validation

If any check fails, fix the issues and try again.

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```text
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependencies
- `ci`: CI/CD changes
- `chore`: Other changes (maintenance, etc.)

### Examples

```bash
feat(renderer): add sprite rotation support
fix(camera): correct viewport offset calculation
docs(readme): update installation instructions
test(vector): add tests for magnitude calculation
```

### Scope (optional but recommended)

- `renderer` - Rendering system
- `camera` - Camera system
- `assets` - Asset loading
- `api` - Public API (BT namespace)
- `utils` - Utility classes
- `examples` - Example projects
- `ci` - CI/CD configuration
- `docs` - Documentation

## Pull Request Process

### Before Submitting

1. Ensure all tests pass
2. Update documentation if needed
3. Add changeset if making library changes:

   ```bash
   pnpm changeset
   ```

4. Rebase on latest main:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Submitting

1. Push your branch to your fork
2. Open a Pull Request on GitHub
3. Fill out the PR template completely
4. Link related issues (e.g., "Closes #123")
5. Wait for review

### Review Process

- Maintainers will review your PR
- Address feedback by pushing new commits
- Once approved, maintainers will merge

### After Merge

- Delete your branch (locally and on GitHub)
- Pull latest main:

  ```bash
  git checkout main
  git pull upstream main
  ```

## Testing

### Unit Tests

Test utility classes, asset loaders, and core functionality:

```bash
pnpm test:unit
pnpm test:unit:watch  # Watch mode
pnpm test:coverage    # With coverage
```

**Writing tests:**

- Location: `tests/unit/`
- Framework: Vitest
- See [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed testing guide

### E2E Tests

Test examples in real browsers:

```bash
pnpm test:e2e
pnpm test:e2e:ui      # Interactive UI
pnpm test:e2e:debug   # Debug mode
```

**Writing E2E tests:**

- Location: `tests/e2e/`
- Framework: Playwright
- See [TESTING_GUIDE.md](TESTING_GUIDE.md) for examples

### Coverage

Aim for:

- Overall: 70%+
- Critical paths: 90%+

View coverage report: `pnpm test:coverage` → `coverage/index.html`

## Code Style

### TypeScript

- Use strict mode (already configured)
- Prefer explicit types over `any`
- Use interfaces for public APIs
- Use types for internal structures

### Formatting

The project uses **dual formatters** for optimal coverage:

| File Type     | Formatter | Configuration        |
| ------------- | --------- | -------------------- |
| TypeScript/JS | Biome     | `biome.json`         |
| JSON/CSS      | Biome     | `biome.json`         |
| Markdown/YAML | Prettier  | `prettier.config.js` |

**Commands:**

- `pnpm format` - Format all files (Biome + Prettier)
- `pnpm format:check` - Check formatting without changes
- `pnpm format:biome` - Format only TS/JS/JSON/CSS
- `pnpm format:prettier` - Format only Markdown/YAML

**Settings:**

- 4 spaces indentation for code (2 for JSON/YAML/Markdown)
- Single quotes for strings
- Semicolons required
- Max line length: 120

### Linting

- ESLint enforces code quality
- JSDoc required for public APIs:

  ```typescript
  /**
   * Description of the function
   * @param param1 - Description
   * @returns Description
   */
  export function myFunction(param1: string): number {
    // ...
  }
  ```

### Naming Conventions

- **Classes:** PascalCase (`Vector2i`, `AssetLoader`)
- **Functions:** camelCase (`drawPixel`, `loadImage`)
- **Constants:** UPPER_SNAKE_CASE (`FLIP_H`, `ROT_90_CW`)
- **Private members:** prefix with `_` (`_internalState`)
- **Types/Interfaces:** PascalCase with `I` prefix for interfaces (`IBlitTechGame`)

## Project Structure

```text
src/
├── BlitTech.ts          # Main API export
├── main.ts              # Dev entry
├── assets/              # Asset loading
├── core/                # Core engine
├── render/              # Rendering
└── utils/               # Utilities

examples/                # Interactive examples
tests/                   # Unit & E2E tests
.github/workflows/       # CI/CD
```

## Documentation

### Code Documentation

- JSDoc for all public APIs
- Include `@example` for complex functions
- Document parameters, return values, and exceptions

### README Updates

Update README.md if you:

- Add new features
- Change public API
- Add new examples
- Update prerequisites

### Changelog

Changesets automatically generate CHANGELOG.md:

```bash
pnpm changeset
# Follow prompts to describe changes
```

## Getting Help

- **Documentation:** See README.md and phase guides
- **Issues:** Search existing issues or create new one
- **Discussions:** Use GitHub Discussions for questions
- **Discord:** (Coming soon)

## License

By contributing, you agree that your contributions will be licensed under the ISC License.
````

---

## GitHub Issue Templates

### Setup

Create `.github/ISSUE_TEMPLATE/` directory:

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

### Bug Report Template

**File:** `.github/ISSUE_TEMPLATE/bug_report.yml`

```yaml
name: Bug Report
description: Report a bug or unexpected behavior
title: '[Bug]: '
labels: ['bug', 'needs-triage']
body:
  - type: markdown
    attributes:
      value: |
        Thank you for reporting a bug! Please fill out the information below to help us investigate.

  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: A clear description of what the bug is
      placeholder: When I do X, Y happens instead of Z
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What you expected to happen
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Blit-Tech Version
      description: Which version are you using?
      placeholder: 0.0.1
    validations:
      required: true

  - type: dropdown
    id: browser
    attributes:
      label: Browser
      description: Which browser are you using?
      options:
        - Chrome
        - Edge
        - Safari
        - Firefox
        - Other
    validations:
      required: true

  - type: input
    id: browser-version
    attributes:
      label: Browser Version
      placeholder: Chrome 113
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating System
      options:
        - Windows
        - macOS
        - Linux
        - iOS
        - Android
    validations:
      required: true

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Any other information (screenshots, logs, etc.)

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I have searched existing issues
          required: true
        - label: I am using the latest version
          required: true
        - label: I have verified my browser supports WebGPU
          required: true
```

### Feature Request Template

**File:** `.github/ISSUE_TEMPLATE/feature_request.yml`

```yaml
name: Feature Request
description: Suggest a new feature or enhancement
title: '[Feature]: '
labels: ['enhancement', 'needs-triage']
body:
  - type: markdown
    attributes:
      value: |
        Thank you for suggesting a feature! Please describe your idea below.

  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: What problem does this feature solve?
      placeholder: I'm frustrated when...
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: How would you like this to work?
      placeholder: I would like to...
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: What other solutions have you considered?

  - type: textarea
    id: examples
    attributes:
      label: Examples
      description: Provide code examples or mockups if applicable
      render: typescript

  - type: dropdown
    id: area
    attributes:
      label: Area
      description: Which area does this feature relate to?
      options:
        - Rendering
        - Camera
        - Assets
        - API
        - Examples
        - Documentation
        - Build/Tooling
        - Other
    validations:
      required: true

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I have searched existing issues and discussions
          required: true
        - label: I am willing to help implement this feature
          required: false
```

### Question Template

**File:** `.github/ISSUE_TEMPLATE/question.yml`

```yaml
name: Question
description: Ask a question about using Blit-Tech
title: '[Question]: '
labels: ['question']
body:
  - type: markdown
    attributes:
      value: |
        Have a question? We're here to help!

        For general discussions, consider using [GitHub Discussions](https://github.com/vancura/blit-tech/discussions).

  - type: textarea
    id: question
    attributes:
      label: Your Question
      description: What would you like to know?
    validations:
      required: true

  - type: textarea
    id: context
    attributes:
      label: Context
      description: What are you trying to accomplish?

  - type: textarea
    id: attempted
    attributes:
      label: What Have You Tried?
      description: Have you tried anything already?

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I have checked the documentation
          required: true
        - label: I have searched existing issues and discussions
          required: true
```

### Config File

**File:** `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: GitHub Discussions
    url: https://github.com/vancura/blit-tech/discussions
    about: Ask questions and discuss ideas with the community
  - name: Documentation
    url: https://github.com/vancura/blit-tech#readme
    about: Read the documentation
```

---

## Pull Request Template

**File:** `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Description

<!-- Provide a brief description of your changes -->

## Related Issue

<!-- Link to related issue(s) if applicable -->

Closes #

## Type of Change

<!-- Check the relevant option(s) -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Performance improvement
- [ ] Build/CI change
- [ ] Other (please describe):

## Changes Made

<!-- List the main changes made in this PR -->

-
-
-

## Testing

<!-- Describe how you tested your changes -->

### Manual Testing

- [ ] Tested locally with `pnpm dev`
- [ ] Tested build with `pnpm build`
- [ ] Tested library build with `pnpm build:lib`
- [ ] Verified in WebGPU-compatible browser

### Automated Testing

- [ ] Added/updated unit tests
- [ ] Added/updated E2E tests
- [ ] All tests pass (`pnpm test:unit && pnpm test:e2e`)
- [ ] Coverage maintained or improved

## Code Quality

- [ ] Code follows project style guidelines
- [ ] TypeScript type check passes (`pnpm typecheck`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Biome formatting applied (`pnpm format` for TS/JS/JSON/CSS)
- [ ] Prettier formatting applied (auto via pre-commit for Markdown/YAML)
- [ ] Pre-commit hooks pass
- [ ] JSDoc added for public APIs
- [ ] No console.log or debug code left

## Documentation

- [ ] Updated README.md if needed
- [ ] Updated CHANGELOG.md (via changeset)
- [ ] Added code comments for complex logic
- [ ] Updated TypeScript types/interfaces

## Changeset

<!-- Required for library changes -->

- [ ] Created changeset (`pnpm changeset`)
- [ ] Or this change doesn't affect the published library

## Screenshots/Videos

<!-- If applicable, add screenshots or videos demonstrating the changes -->

## Breaking Changes

<!-- If this is a breaking change, describe what breaks and how to migrate -->

## Checklist

- [ ] My code follows the project's code style
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
- [ ] I have checked my code and corrected any misspellings
- [ ] I have rebased on the latest main branch

## Additional Notes

<!-- Any additional information for reviewers -->
```

---

## Code of Conduct

**File:** `CODE_OF_CONDUCT.md`

Use the [Contributor Covenant](https://www.contributor-covenant.org/):

```markdown
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for
everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity
and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, caste,
color, religion, or sexual identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming, diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment:

- Demonstrating empathy and kindness toward other people
- Being respectful of differing opinions, viewpoints, and experiences
- Giving and gracefully accepting constructive feedback
- Accepting responsibility and apologizing to those affected by our mistakes
- Focusing on what is best for the community

Examples of unacceptable behavior:

- The use of sexualized language or imagery, and sexual attention or advances
- Trolling, insulting or derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Enforcement Responsibilities

Project maintainers are responsible for clarifying and enforcing standards of acceptable behavior and will take
appropriate and fair corrective action in response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

## Scope

This Code of Conduct applies within all community spaces, and also applies when an individual is officially representing
the community in public spaces.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the project maintainers at
[INSERT EMAIL]. All complaints will be reviewed and investigated promptly and fairly.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org), version 2.1,
available at https://www.contributor-covenant.org/version/2/1/code_of_conduct.html
```

---

## Dependency Management

### Option 1: Dependabot (GitHub Native)

**File:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
      timezone: 'Europe/Prague'
    open-pull-requests-limit: 10
    reviewers:
      - 'vancura'
    assignees:
      - 'vancura'
    commit-message:
      prefix: 'chore(deps)'
      include: 'scope'
    labels:
      - 'dependencies'
      - 'automated'
    ignore:
      # Ignore major version updates for stable deps
      - dependency-name: 'typescript'
        update-types: ['version-update:semver-major']
      - dependency-name: 'vite'
        update-types: ['version-update:semver-major']

  # GitHub Actions
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
    commit-message:
      prefix: 'chore(ci)'
    labels:
      - 'dependencies'
      - 'ci'
      - 'automated'
```

### Option 2: Renovate (More Powerful)

**File:** `renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["before 10am on monday"],
  "timezone": "Europe/Prague",
  "labels": ["dependencies", "automated"],
  "assignees": ["vancura"],
  "reviewers": ["vancura"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "automergeType": "pr",
      "automergeStrategy": "squash"
    },
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "automerge": true
    },
    {
      "groupName": "TypeScript and ESLint",
      "matchPackagePatterns": ["^typescript$", "^eslint", "^@typescript-eslint/"]
    },
    {
      "groupName": "Vite and plugins",
      "matchPackagePatterns": ["^vite", "vite-plugin-"]
    },
    {
      "groupName": "Testing tools",
      "matchPackagePatterns": ["^vitest", "^@vitest/", "^@playwright/"]
    }
  ],
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "assignees": ["vancura"]
  }
}
```

---

## Astro Starlight Documentation

### Preparation (Don't Implement Yet)

When ready to create a documentation site, use Astro Starlight:

### Step 1: Create docs directory

```bash
mkdir docs
cd docs
pnpm create astro@latest . -- --template starlight
```

### Step 2: Configure Astro

`docs/astro.config.mjs`:

```javascript
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Blit-Tech Docs',
      description: 'WebGPU retro game engine for TypeScript',
      logo: {
        src: './public/logo.svg',
      },
      social: {
        github: 'https://github.com/vancura/blit-tech',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/guides/introduction/' },
            { label: 'Installation', link: '/guides/installation/' },
            { label: 'Quick Start', link: '/guides/quickstart/' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Game Loop', link: '/concepts/game-loop/' },
            { label: 'Rendering', link: '/concepts/rendering/' },
            { label: 'Camera', link: '/concepts/camera/' },
            { label: 'Assets', link: '/concepts/assets/' },
          ],
        },
        {
          label: 'API Reference',
          autogenerate: { directory: 'api' },
        },
        {
          label: 'Examples',
          autogenerate: { directory: 'examples' },
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
```

### Step 3: Placeholder Structure

```text
docs/
├── astro.config.mjs
├── package.json
├── public/
│   └── logo.svg
└── src/
    ├── content/
    │   └── docs/
    │       ├── guides/
    │       ├── concepts/
    │       ├── api/
    │       └── examples/
    └── styles/
        └── custom.css
```

---

## Additional Improvements

### 1. GitHub Repo Settings

**Topics:** Add GitHub topics for discoverability

```text
webgpu, typescript, game-engine, retro, pixel-art, 2d-game,
fantasy-console, vite, game-development
```

**About:** Add description and website URL

**Features:**

- ✓ Issues
- ✓ Discussions
- ✗ Projects (optional)
- ✗ Wiki (use docs instead)

### 2. npm Package Metadata

Already good in package.json, but verify:

- `keywords` - For npm search
- `homepage` - Link to docs
- `repository` - GitHub link
- `bugs` - Issue tracker

### 3. VSCode Workspace Settings

Create `.vscode/settings.json` (ignored by git):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["javascript", "typescript"],
  "files.associations": {
    "*.wgsl": "wgsl"
  }
}
```

### 4. VSCode Extensions Recommendations

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "biomejs.biome-vscode",
    "editorconfig.editorconfig",
    "ms-playwright.playwright",
    "vitest.explorer",
    "graphql.vscode-graphql-syntax"
  ]
}
```

### 5. Gitignore Updates

Already comprehensive, but ensure:

```gitignore
# Test outputs
playwright-report/
test-results/
coverage/

# Changesets (keep config, ignore temp files)
.changeset/*.md
!.changeset/README.md
!.changeset/config.json

# Docs build (when added)
docs/.astro/
docs/dist/
```

---

## Maintenance Checklist

### Weekly

- [ ] Review and merge Dependabot/Renovate PRs
- [ ] Check open issues and respond
- [ ] Review open PRs
- [ ] Update project board (if using)

### Monthly

- [ ] Review analytics/usage (if available)
- [ ] Update roadmap
- [ ] Check for security advisories
- [ ] Review and close stale issues

### Before Releases

- [ ] Run full test suite
- [ ] Update CHANGELOG.md (via changesets)
- [ ] Bump version
- [ ] Test library build
- [ ] Test examples deployment
- [ ] Create GitHub release with notes
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

## Implementation Order

1. **CONTRIBUTING.md** - Guide for contributors
2. **CODE_OF_CONDUCT.md** - Community standards
3. **Issue templates** - Bug reports, features, questions
4. **PR template** - Pull request checklist
5. **Dependabot/Renovate** - Automated updates
6. **VSCode settings** - Editor configuration
7. **Astro Starlight** - When ready for docs site (future)

---

## Next Steps

After completing this guide:

1. Review all new documentation files
2. Enable Dependabot or Renovate
3. Test issue templates by creating test issues
4. Update main README.md with contribution section
5. Consider adding SECURITY.md for vulnerability reporting
6. Plan Astro Starlight docs site (when library is more mature)

---

**Last Updated:** 2025-11-28
