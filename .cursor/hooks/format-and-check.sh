#!/bin/sh

set -u

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT_JSON="$(cat)"

FILE_PATH="$(printf '%s' "$INPUT_JSON" | jq -r '
    [.. | objects | (.file_path // .path)?]
    | map(select(. != null and . != ""))
    | first // empty
' 2>/dev/null)"

if [ -z "$FILE_PATH" ]; then
    exit 0
fi

case "$FILE_PATH" in
/*) TARGET_FILE="$FILE_PATH" ;;
*) TARGET_FILE="$REPO_ROOT/$FILE_PATH" ;;
esac

NORMALIZED_TARGET="$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$TARGET_FILE" 2>/dev/null)" || exit 0
CANONICAL_REPO_ROOT="$(python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$REPO_ROOT")"

if [ ! -f "$NORMALIZED_TARGET" ]; then
    exit 0
fi

case "$NORMALIZED_TARGET" in
"$CANONICAL_REPO_ROOT"/*) ;;
*) exit 0 ;;
esac

case "$NORMALIZED_TARGET" in
*.ts | *.tsx | *.js | *.cjs | *.mjs | *.json | *.jsonc | *.css)
    (cd "$REPO_ROOT" && pnpm exec biome check --write "$NORMALIZED_TARGET" >/dev/null 2>&1) || true
    ;;
esac

case "$NORMALIZED_TARGET" in
*.md | *.mdx | *.mdc | *.yml | *.yaml)
    (cd "$REPO_ROOT" && pnpm exec prettier --write "$NORMALIZED_TARGET" >/dev/null 2>&1) || true
    ;;
esac

exit 0
