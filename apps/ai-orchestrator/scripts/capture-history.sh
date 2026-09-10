#!/usr/bin/env bash
# Pull one workflow history out of the cluster into the replay corpus.
#
#   scripts/capture-history.sh <workflow-id> [run-id] [output-name]
#
# With no run id, Temporal returns the *latest* run of that workflow id. Pass
# one explicitly when capturing a specific incident -- `temporal workflow list`
# in the admintools pod shows them, and a Continue-As-New leaves several.
#
# A history captured from a *running* workflow is the more useful fixture: a
# finished workflow can no longer be wedged by a bad deploy.
#
# Verify the result before committing it:
#
#   .venv/bin/python -m pytest tests/test_replay.py -q
#
# A history that fails is not a corpus entry -- it belongs in
# tests/histories/nondeterministic/, and only with a note saying what diverged.

set -euo pipefail

WORKFLOW_ID="${1:?usage: capture-history.sh <workflow-id> [run-id] [output-name]}"
RUN_ID="${2:-}"
NAME="${3:-${WORKFLOW_ID}}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${REPO_ROOT}/tests/histories/${NAME}.json"
NAMESPACE="${TEMPORAL_NAMESPACE:-ai-coding}"

args=(--namespace "${NAMESPACE}" --workflow-id "${WORKFLOW_ID}" -o json)
[[ -n "${RUN_ID}" ]] && args+=(--run-id "${RUN_ID}")

kubectl exec -n ai deploy/temporal-admintools -c admin-tools -- \
  temporal workflow show "${args[@]}" > "${OUT}"

# The CLI writes its own diagnostics to stderr and can exit 0 on an empty
# result, so check the file rather than the exit status.
python3 - "${OUT}" <<'PY'
import json, sys, pathlib
path = pathlib.Path(sys.argv[1])
events = json.loads(path.read_text()).get("events")
if not events:
    path.unlink(missing_ok=True)
    raise SystemExit("no events returned; nothing written")
print(f"{path}: {len(events)} events")
PY
