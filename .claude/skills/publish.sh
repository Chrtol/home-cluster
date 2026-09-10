#!/usr/bin/env bash
# Build an uploadable .skill zip from a filesystem skill, stamping a content version
# so drift between this repo and a hosted upload is detectable.
#
#   ./.claude/skills/publish.sh project-docs-system [outdir]
#
# Filesystem clients (Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Copilot...) read
# the source directory directly and need no build. Only hosted claude.ai/Desktop/mobile
# needs the zip, because it has no API and no export.
set -euo pipefail

NAME="${1:?usage: publish.sh <skill-name> [outdir]}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$NAME"
OUT="${2:-$(cd "$SRC/../../.." && pwd)/ai-activity/ai_workflow_optimization}"
[ -f "$SRC/SKILL.md" ] || { echo "no SKILL.md in $SRC" >&2; exit 1; }

# Hash every file with any existing stamp stripped, so the stamp never feeds its own hash.
HASH="$(
  find "$SRC" -type f | sort | while read -r f; do
    sed '/^_Version: /d' "$f"
  done | sha256sum | cut -c1-8
)"
STAMP="_Version: $(date +%Y-%m-%d) · content ${HASH} · built by .claude/skills/publish.sh_"

# Rewrite the stamp in place: replace if present, else insert under the H1.
python3 - "$SRC/SKILL.md" "$STAMP" <<'PY'
import re, sys
path, stamp = sys.argv[1], sys.argv[2]
s = open(path).read()
if re.search(r'^_Version: .*$', s, re.M):
    s = re.sub(r'^_Version: .*$', stamp, s, count=1, flags=re.M)
else:
    s = re.sub(r'^(# .+\n)', r'\1\n' + stamp + '\n', s, count=1, flags=re.M)
open(path, 'w').write(s)
PY

mkdir -p "$OUT"
ZIP="$OUT/$NAME.skill"
rm -f "$ZIP"
# python zipfile rather than zip(1): not installed on every box, and this keeps
# entry names relative to the skill dir, which is the layout the uploader expects.
python3 - "$SRC" "$ZIP" <<'PY'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
root = os.path.dirname(src)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, _, files in os.walk(src):
        for f in sorted(files):
            if f == ".DS_Store":
                continue
            full = os.path.join(dirpath, f)
            z.write(full, os.path.relpath(full, root))
PY

echo "$STAMP"
echo "built: $ZIP"
echo
echo "Upload it at claude.ai -> Settings -> Capabilities -> Skills (replaces the existing one)."
echo "Then on any surface ask: \"which version of $NAME is loaded?\" and compare the hash."
