#!/usr/bin/env bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.toolName')
ARGS=$(echo "$INPUT" | jq -r '.toolArgs | if type == "string" then . else tojson end')

deny() {
  jq -cn --arg r "$1" '{permissionDecision: "deny", permissionDecisionReason: $r}'
  exit 0
}

case "$TOOL" in
  bash)
    echo "$ARGS" | grep -Eq 'rm -rf|git push (-f|--force)' \
      && deny "Blocked by guardrails: destructive shell command" ;;
  edit|create|apply_patch)
    echo "$ARGS" | grep -Eq '\.env|src/specs\.ts' \
      && deny "Blocked by guardrails: .env files and src/specs.ts are protected" ;;
esac
exit 0
