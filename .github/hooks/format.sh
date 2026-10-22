#!/usr/bin/env bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.toolArgs | (if type == "string" then fromjson else . end) | .path // empty')
if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  npx --no-install prettier --write "$FILE" >/dev/null 2>&1
fi
exit 0
