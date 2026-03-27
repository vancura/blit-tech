---
description: Quickly format all code files without verification steps.
---

# Quick Format

Rapidly format all code files using the project’s formatters - streamlined version of `/format` that skips verification
steps for maximum speed.

## Usage

```text
/quick-format
```

## Steps

1. **Run formatters**
   - Execute `pnpm format` which runs:
     - Biome for TypeScript/JavaScript/JSON/CSS
     - Prettier for Markdown/YAML

2. **Brief confirmation**
   - Report completion
   - Note any files that couldn’t be formatted (usually indicate syntax errors)

## When to Use

- A quick cleanup after manual edits
- Before running other checks
- When you know you just need formatting (not verification)
- To fix formatting issues reported by CI or hooks
