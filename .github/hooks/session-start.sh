#!/usr/bin/env bash
set -euo pipefail

cat >/dev/null

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
mkdir -p -- "$ROOT/logs"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
printf '%s\n' "$TIMESTAMP" >> "$ROOT/logs/session.log"
