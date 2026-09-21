#!/usr/bin/env bash
# Scan the repository for plaintext occurrences of the values held in
# cluster-secrets.sops.yaml. This repo is public and those values are only ever
# meant to appear as ${VAR} substitutions, never literally.
#
#   staged            files staged for commit, read from the index (pre-commit)
#   push <rev-args>   commits in the range about to be pushed (pre-push)
#   tree              every tracked file
#   history           every commit reachable from any ref
#
# The needles come from the same SOPS file Flux substitutes from, so there is no
# second copy of the domain to keep in sync -- and nothing secret is committed.
# Findings name the file and the key, never the value: terminal scrollback and
# CI logs on a public repo are not a safe place for it.
set -euo pipefail
set +x

readonly SECRETS_FILE="kubernetes/components/common/cluster-secrets.sops.yaml"
readonly ALLOW_FILE=".githooks/leak-allow.txt"
# Public by nature -- github.com and friends are in image refs everywhere.
readonly SKIP_KEYS="SECRET_TIMEZONE FORGE_GIT_HOST FORGE_API_HOST"
readonly MIN_LEN=5

mode="${1:-tree}"
declare -a range=("${@:2}")
cd "$(git rev-parse --show-toplevel)"

# git run from an editor's UI inherits none of mise's environment, so sops, yq
# and the age key all have to be found the hard way or every GUI commit dies on
# "sops not on PATH".
shims="${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims"
[[ -d "$shims" ]] && PATH="$shims:$PATH"
export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$PWD/age.key}"

for tool in sops yq; do
  command -v "$tool" >/dev/null \
    || { echo "scan-secret-leaks: $tool not found (mise install, or add its shims to PATH)" >&2; exit 2; }
done
[[ -r "$SOPS_AGE_KEY_FILE" ]] \
  || { echo "scan-secret-leaks: cannot read age key at $SOPS_AGE_KEY_FILE" >&2; exit 2; }

# Held in shell memory only: no temp file and no process argument, so the
# plaintext never reaches disk or another user's ps output.
#
# Checked explicitly rather than leant on set -e: a failure inside the process
# substitution below does not reach the parent shell, so a broken sops would
# leave pairs empty and the scan would cheerfully report "clean" -- failing open
# is the one outcome a guard like this must never have.
if ! plain=$(sops decrypt "$SECRETS_FILE" 2>&1); then
  printf 'scan-secret-leaks: cannot decrypt %s\n%s\n' "$SECRETS_FILE" "$plain" >&2
  exit 2
fi
mapfile -t pairs < <(yq -r '.stringData | to_entries[] | [.key, .value] | @tsv' <<<"$plain")
unset plain
if (( ${#pairs[@]} < 2 )); then
  echo "scan-secret-leaks: read ${#pairs[@]} keys from $SECRETS_FILE, expected several" >&2
  exit 2
fi

declare -a allow=()
[[ -f "$ALLOW_FILE" ]] && mapfile -t allow < <(grep -vE '^[[:space:]]*(#|$)' "$ALLOW_FILE" || true)

is_allowed() { # <file> <key>
  local entry
  for entry in ${allow[@]+"${allow[@]}"}; do
    [[ "$1:$2" == $entry ]] && return 0
  done
  return 1
}

declare -a staged=()
if [[ "$mode" == staged ]]; then
  mapfile -t staged < <(git diff --cached --name-only --diff-filter=ACMR)
  [[ ${#staged[@]} -eq 0 ]] && { echo "scan-secret-leaks: nothing staged"; exit 0; }
fi

# --cached reads the index, so it sees exactly what the commit will contain --
# not the working tree, which may hold unstaged fixes that mask a leak.
#
# push uses the pickaxe over just the outgoing range: a value introduced and
# then removed within those commits still counts, since pushing publishes the
# blob either way. Scanning full history instead would block every push, this
# repo having carried the domain since 2025-05.
search() {
  case "$mode" in
    staged)  git grep --cached -I -n --no-color -F -e "$1" -- ${staged[@]+"${staged[@]}"} || true ;;
    tree)    git grep -I -n --no-color -F -e "$1" -- . || true ;;
    push)    git log --oneline -S"$1" ${range[@]+"${range[@]}"} || true ;;
    history) git log --all --oneline -S"$1" || true ;;
    *) echo "scan-secret-leaks: unknown mode '$mode' (staged|push|tree|history)" >&2; exit 2 ;;
  esac
}

findings=0
for pair in ${pairs[@]+"${pairs[@]}"}; do
  key="${pair%%$'\t'*}"
  value="${pair#*$'\t'}"
  [[ " $SKIP_KEYS " == *" $key "* ]] && continue
  (( ${#value} < MIN_LEN )) && continue

  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    if [[ "$mode" == history || "$mode" == push ]]; then
      location="commit ${hit%% *}"
      file=""
    else
      file="${hit%%:*}"
      location="$file:$(cut -d: -f2 <<<"$hit")"
    fi
    [[ -n "$file" ]] && is_allowed "$file" "$key" && continue
    printf '  %-70s %s\n' "$location" "$key"
    findings=$((findings + 1))
  done < <(search "$value")
done

if (( findings > 0 )); then
  cat >&2 <<EOF

$findings plaintext secret value(s) found in mode '$mode'.
Replace each with its \${KEY} substitution, or add a '<path>:<KEY>' line to
$ALLOW_FILE if the match is a false positive.
EOF
  exit 1
fi

echo "scan-secret-leaks: clean ($mode)"
