# Changesets & Changelog Guide

This guide explains how to use changesets for version management and changelog generation in Blit-Tech.

## Quick Reference

```bash
# Create changeset (document changes)
pnpm changeset

# Check what would be bumped
pnpm changeset status

# Bump version and update CHANGELOG
pnpm version:bump

# Publish to npm
pnpm release
```

---

## How Changesets Work

### The Workflow

```
1. Make changes to library code
   ↓
2. Run: pnpm changeset
   ↓ Creates: .changeset/random-name.md
   ↓
3. Commit the changeset file
   ↓
4. (Later) Run: pnpm version:bump
   ↓ Consumes all .md files in .changeset/
   ↓ Updates package.json version
   ↓ Updates CHANGELOG.md
   ↓ Deletes the .md files
   ↓
5. Commit the version bump
   ↓
6. Run: pnpm release (publish to npm)
```

---

## Understanding Random Names

Changesets generates **random friendly names** from adjectives and animals:

```
[adjective]-[animal]-[verb].md

Examples:
- bumpy-tigers-try.md
- brave-lions-dance.md
- silly-pandas-jump.md
- clever-owls-sleep.md
```

**Why random names?**

- ✓ Avoid conflicts - Multiple changesets can exist simultaneously
- ✓ Human-friendly - Easier to reference than UUIDs
- ✓ Memorable - Similar to Docker container names
- ✓ Git-friendly - No merge conflicts when multiple devs create changesets

---

## Changeset File Structure

Inside `.changeset/bumpy-tigers-try.md`:

```markdown
---
'blit-tech': patch
---

Your summary message here (what you typed during the wizard)
```

**Components:**

- **Frontmatter** (between `---`): Metadata
  - Package name: `"blit-tech"`
  - Version bump type: `patch` | `minor` | `major`
- **Body**: Human-readable summary of changes

---

## Multiple Changesets

You can have several pending changesets:

```
.changeset/
├── config.json
├── README.md
├── bumpy-tigers-try.md      # Fix: sprite rendering bug
├── clever-owls-dance.md     # Feat: add rotation support
└── silly-pandas-jump.md     # Feat: add audio system
```

When you run `pnpm version:bump`:

1. **Collects all changesets**
2. **Determines highest version bump:**
   - `bumpy-tigers-try.md` → patch
   - `clever-owls-dance.md` → minor
   - `silly-pandas-jump.md` → minor
   - **Result:** minor bump (0.0.1 → 0.1.0)

3. **Generates CHANGELOG:**

   ```markdown
   ## 0.1.0

   ### Minor Changes

   - Add rotation support
   - Add audio system

   ### Patch Changes

   - Fix sprite rendering bug
   ```

4. **Deletes all .md files**
5. **Updates package.json** to 0.1.0

---

## Semantic Versioning

Choose the right bump type when creating changesets:

| Type      | Bump          | Use When                  | Example              |
| --------- | ------------- | ------------------------- | -------------------- |
| **patch** | 0.0.1 → 0.0.2 | Bug fixes, small tweaks   | Fix rendering glitch |
| **minor** | 0.0.1 → 0.1.0 | New features (compatible) | Add sprite rotation  |
| **major** | 0.0.1 → 1.0.0 | Breaking changes          | Change API signature |

**Guidelines:**

- **patch**: Backwards-compatible bug fixes
- **minor**: Backwards-compatible new features
- **major**: Breaking changes to public API

---

## Commands Reference

### Development Commands

```bash
# Create a changeset
pnpm changeset
# Interactive prompts:
# - Select packages (blit-tech)
# - Choose bump type (major/minor/patch)
# - Enter summary message

# See pending changesets
pnpm changeset status

# Preview what would be bumped
ls -la .changeset/
```

### Release Commands

```bash
# Bump version (consumes changesets)
pnpm version:bump
# This runs:
# - changeset version (update package.json, CHANGELOG.md)
# - pnpm install --no-frozen-lockfile (update lock file)

# Publish to npm (manual trigger)
pnpm release
# This runs:
# - pnpm build:lib
# - changeset publish
```

---

## Full Workflow Example

### Scenario: Adding Sprite Rotation

**1. Create feature branch**

```bash
git checkout -b feat/sprite-rotation
```

**2. Make changes**

```bash
# Edit src/BlitTech.ts
# Add rotation parameter to drawSprite()
```

**3. Create changeset**

```bash
pnpm changeset

# Prompts:
# ✓ Which packages? → blit-tech
# ✓ What type? → minor (new feature)
# ✓ Summary: → "Add sprite rotation support"

# Creates: .changeset/clever-owls-dance.md
```

**4. Commit both code and changeset**

```bash
git add src/BlitTech.ts .changeset/clever-owls-dance.md
git commit -m "feat(renderer): add sprite rotation"
git push origin feat/sprite-rotation
```

**5. Merge PR**

```bash
# PR is reviewed and merged to main
# changeset file is now in main branch
```

**6. When ready to release (later)**

```bash
git checkout main
git pull origin main

# Consume changesets
pnpm version:bump

# Review changes
git diff
# Should show:
# - package.json version bumped
# - CHANGELOG.md updated
# - .changeset/clever-owls-dance.md deleted

# Commit version bump
git add .
git commit -m "chore: release v0.1.0"
git push origin main
```

**7. Publish to npm**

```bash
pnpm release

# This will:
# - Build library (pnpm build:lib)
# - Publish to npm (changeset publish)
```

**8. Create GitHub release (optional)**

```bash
gh release create v0.1.0 --generate-notes
```

---

## Best Practices

### When to Create Changesets

✅ **DO create changesets for:**

- Bug fixes in library code
- New features in library code
- Breaking changes to public API
- Performance improvements
- Dependency updates that affect users

❌ **DON'T create changesets for:**

- Example updates (not part of published library)
- Documentation changes
- Internal refactoring (no API changes)
- CI/CD configuration
- Development tooling

### Changeset Messages

**Good messages:**

```
✅ "Add sprite rotation with angle parameter"
✅ "Fix camera offset calculation for negative values"
✅ "Remove deprecated drawPixelBatch function"
```

**Bad messages:**

```
❌ "Update code"
❌ "Bug fix"
❌ "Changes"
```

### Multiple Changesets in One PR

If a PR includes multiple distinct changes:

```bash
# Bug fix
pnpm changeset
# → patch: "Fix sprite tinting alpha channel"

# New feature
pnpm changeset
# → minor: "Add bitmap font line spacing control"
```

Both changesets get committed together and consumed together.

---

## Changeset Lifecycle

### Creation

```bash
$ pnpm changeset

🦋  Which packages would you like to include?
   ✓ blit-tech

🦋  Which type of change is this?
   ○ major
   ● minor
   ○ patch

🦋  Please enter a summary:
   Add sprite rotation support

🦋  Changeset added! - you can now commit it
```

### Stored as File

`.changeset/clever-owls-dance.md`:

```markdown
---
'blit-tech': minor
---

Add sprite rotation support
```

### Consumption

```bash
$ pnpm version:bump

🦋  All files have been updated. Review them and commit at your convenience
```

**Result:**

- `package.json`: `"version": "0.1.0"`
- `CHANGELOG.md`: New entry for 0.1.0
- `.changeset/clever-owls-dance.md`: **DELETED**

---

## Common Scenarios

### Scenario 1: Forgot to Create Changeset

```bash
# Already committed and pushed without changeset
git checkout -b add-changeset
pnpm changeset
# Create changeset for previous changes
git add .changeset/*.md
git commit -m "chore: add changeset for rotation feature"
git push
# Create PR for just the changeset
```

### Scenario 2: Wrong Bump Type

```bash
# Created as patch but should be minor
# Edit the .md file directly:
vim .changeset/bumpy-tigers-try.md

# Change:
# "blit-tech": patch
# To:
# "blit-tech": minor

git add .changeset/bumpy-tigers-try.md
git commit --amend
```

### Scenario 3: Remove Changeset

```bash
# Decided change isn't needed
rm .changeset/bumpy-tigers-try.md
git add .changeset/
git commit -m "chore: remove unnecessary changeset"
```

### Scenario 4: Multiple Packages (Future)

```yaml
---
'blit-tech': minor
'blit-tech-cli': patch
---
Add rotation to core library and update CLI help text
```

---

## Integration with Git

### Recommended Branch Strategy

```
main (protected)
  ↓
feature/sprite-rotation
  ├─ commits with code changes
  └─ commit with changeset file
```

### Commit Message Examples

```bash
# Feature with changeset
git commit -m "feat(renderer): add sprite rotation

Adds rotation parameter to drawSprite() function.

Closes #42"

# Just the changeset
git commit -m "chore: add changeset for sprite rotation"

# Version bump
git commit -m "chore: release v0.1.0"
```

---

## Troubleshooting

### "No changesets present"

**Problem:** Running `pnpm version:bump` with no pending changesets.

**Solution:** Create at least one changeset first with `pnpm changeset`.

### Changesets ignored by git

**Problem:** Created changeset but not showing in `git status`.

**Solution:** Check `.gitignore` - changesets should NOT be ignored. Fixed in this project: changesets are now tracked.

### Wrong version bump

**Problem:** Expected minor but got patch.

**Solution:** Check all changeset files - highest bump type wins.

```bash
# See what would happen
pnpm changeset status
```

### Can't publish to npm

**Problem:** `pnpm release` fails with auth error.

**Solution:** Login to npm first:

```bash
npm login
# Or set NPM_TOKEN in environment
export NPM_TOKEN=your_token_here
```

---

## Advanced: Automated Releases

### GitHub Action for Automated Versioning (Future)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4

      - run: pnpm install --frozen-lockfile

      - name: Create Release PR
        uses: changesets/action@v1
        with:
          version: pnpm version:bump
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**How it works:**

1. Detects pending changesets on main
2. Creates a "Version Packages" PR automatically
3. When merged, publishes to npm

---

## Summary

- ✅ Random names are normal and expected
- ✅ Changeset files are temporary (deleted when consumed)
- ✅ Content moves to CHANGELOG.md permanently
- ✅ One changeset per logical change
- ✅ Commit changesets with your code
- ✅ Multiple changesets can accumulate before release
- ✅ Highest bump type wins

**The changeset file is just documentation waiting to become changelog!**

---

**Last Updated:** 2025-11-28
