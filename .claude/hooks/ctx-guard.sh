#!/usr/bin/env bash
# PreToolUse guard for Bash: commands that tend to dump large output are
# refused with a pointer to context-mode, so only the answer enters the context.
# Allowed through: output bounded by head/tail/wc, counts (-c/-l/-q), kubectl --tail.
# A CTX_OK=1 prefix does not pass on its own: it asks the owner.
cmd=$(jq -r '.tool_input.command // ""')

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ($r + " Switch to context-mode, do not work around this. If the ctx tools are not loaded yet, load them first with ToolSearch query \"select:mcp__plugin_context-mode_context-mode__ctx_batch_execute,mcp__plugin_context-mode_context-mode__ctx_execute,mcp__plugin_context-mode_context-mode__ctx_execute_file,mcp__plugin_context-mode_context-mode__ctx_search\". Then run the command via ctx_execute (language: shell) or ctx_batch_execute and print only what you need.")}}'
  exit 0
}

case "$cmd" in CTX_OK=1*)
  jq -n '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask",
    permissionDecisionReason: "CTX_OK=1: full output requested. Only the owner can approve this."}}'
  exit 0 ;;
esac

# Bounded output is fine.
if printf '%s' "$cmd" | grep -Eq '\|\s*(head|tail|wc)\b|grep -[a-zA-Z]*[clq]|--quiet|--stat|--name-only|--shortstat|>\s*/dev/null'; then
  exit 0
fi

p() { printf '%s' "$cmd" | grep -Eq -e "$1"; }
# Matches at the start of a command, including after `export KUBECONFIG=... &&`.
s='(^|[;&|]\s*)'

p "${s}(grep\s+-[a-zA-Z]*[rR]|rg\s)" && deny "Recursive search output can be large."
p "${s}find\s" && ! p 'maxdepth' && deny "Unbounded find output can be large."
p "${s}kubectl\s+logs\b" && ! p '--tail[= ][0-9]{1,3}\b' && deny "kubectl logs without --tail can be large."
p "${s}kubectl\s+get\b.*\s-o\s*=?\s*(yaml|json)\b" && deny "kubectl get -o yaml/json can be large."
p "${s}(flux\s+build|kustomize\s+build|kubectl\s+kustomize|helm\s+template)\b" && deny "Rendered manifests can be large."
p "${s}talosctl\b.*\b(dmesg|logs)\b" && deny "talosctl log output can be large."
p "${s}talosctl\b.*\s-o\s*=?\s*(yaml|json)\b" && deny "talosctl -o yaml/json (machineconfig and friends) can be large."
p '(docker (compose )?logs|journalctl)' && deny "Log output can be large."
p 'git (log|diff|show)\b' && ! p '(-n ?[0-9]|-[0-9]+|--max-count|--oneline -[0-9])' && deny "Unbounded git log/diff/show can be large."

# cat of a file over 20 KB.
for f in $(printf '%s' "$cmd" | grep -Eo '(^|[;&|]\s*)cat\s+[^|;&>]+' | sed -E 's/.*cat\s+//'); do
  [ -f "$f" ] && [ "$(stat -c %s "$f" 2>/dev/null || echo 0)" -gt 20000 ] && deny "cat of $f (over 20 KB)."
done
exit 0
