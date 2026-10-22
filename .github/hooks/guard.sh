#!/usr/bin/env bash
INPUT=$(cat)

deny() {
  jq -cn --arg r "$1" '{permissionDecision: "deny", permissionDecisionReason: $r}'
  exit 0
}

command -v python3 >/dev/null 2>&1 \
  || deny "Blocked by guardrails: cannot validate file destinations without python3"
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P) \
  || deny "Blocked by guardrails: cannot determine repository root"
if ! ERROR=$(printf '%s\n' "$INPUT" | python3 -c '
import json, os, re, sys

def validate(tool, payload, root, cwd):
    if not isinstance(tool, str) or not tool:
        raise ValueError("missing tool name")
    if tool == "bash":
        args = payload if isinstance(payload, str) else json.dumps(payload)
        if re.search(r"rm -rf|git push (-f|--force)", args):
            raise ValueError("destructive shell command")
        return
    if tool not in ("edit", "create", "apply_patch"):
        return
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            if tool != "apply_patch":
                raise ValueError("unsupported edit/create payload")
    paths = []
    if tool in ("edit", "create"):
        if not isinstance(payload, dict):
            raise ValueError("expected a file destination object")
        paths = [payload[key] for key in ("path", "file_path", "filePath") if key in payload]
    elif tool == "apply_patch":
        if isinstance(payload, dict):
            patches = [payload[key] for key in ("patch", "input") if key in payload]
        else:
            patches = [payload]
        if not patches:
            raise ValueError("missing patch text")
        for patch in patches:
            if not isinstance(patch, str):
                raise ValueError("expected patch text")
            lines = patch.splitlines()
            if len(lines) < 3 or lines[0] != "*** Begin Patch" or lines[-1] != "*** End Patch":
                raise ValueError("unsupported patch envelope")
            mode, movable, found, added, ended = None, False, False, False, False
            for line in lines[1:-1]:
                headers = {"*** Add File: ": "add", "*** Update File: ": "update",
                           "*** Delete File: ": "delete", "*** Move to: ": "move"}
                header = next((prefix for prefix in headers if line.startswith(prefix)), None)
                if header:
                    kind = headers[header]
                    if mode == "add" and not added:
                        raise ValueError("add operation has no content")
                    if kind == "move" and not movable:
                        raise ValueError("misplaced move destination")
                    paths.append(line[len(header):])
                    if kind != "move":
                        mode, found = kind, True
                        added, ended = False, False
                    movable = kind == "update"
                else:
                    movable = False
                    if ended:
                        raise ValueError("content after end of file")
                    valid = mode == "add" and line.startswith("+")
                    if valid:
                        added = True
                    valid |= mode == "update" and (line.startswith((" ", "+", "-", "@@ "))
                                                  or line == "@@"
                                                  or line == "*** End of File")
                    if not valid:
                        raise ValueError("unsupported patch content")
                    ended = line == "*** End of File"
            if mode == "add" and not added:
                raise ValueError("add operation has no content")
            if not found:
                raise ValueError("patch has no file operations")
    else:
        raise ValueError("unsupported mutating tool")
    if not paths:
        raise ValueError("missing file destination")
    protected = os.path.join(root, "src", "specs.ts")
    protected_paths = {os.path.abspath(protected), os.path.realpath(protected)}
    for path in paths:
        if not isinstance(path, str) or not path.strip() or any(c in path for c in "\x00\r\n"):
            raise ValueError("invalid file destination")
        absolute = os.path.abspath(os.path.join(cwd, path))
        resolved = os.path.realpath(os.path.join(cwd, path))
        if any(".env" in component for name in (path, absolute, resolved)
               for component in name.split(os.sep)) or {absolute, resolved} & protected_paths:
            raise ValueError(".env files and src/specs.ts are protected")

try:
    request = json.load(sys.stdin)
    root = sys.argv[1]
    cwd = request.get("cwd", root)
    if not isinstance(cwd, str) or not os.path.isabs(cwd) or any(c in cwd for c in "\x00\r\n"):
        raise ValueError("invalid working directory")
    # Docs specify individual calls; session hook events also expose batches.
    # Validate every call, including both forms if both are supplied.
    calls = []
    if "toolCalls" in request:
        batch = request["toolCalls"]
        if not isinstance(batch, list) or not batch:
            raise ValueError("invalid tool calls")
        for call in batch:
            if not isinstance(call, dict) or "name" not in call or "args" not in call:
                raise ValueError("invalid tool call")
            calls.append((call["name"], call["args"]))
    if "toolName" in request or "toolArgs" in request:
        calls.append((request["toolName"], request["toolArgs"]))
    if not calls:
        raise ValueError("missing tool call")
    for tool, payload in calls:
        validate(tool, payload, root, cwd)
except Exception as error:
    print("Blocked by guardrails: " + str(error))
    sys.exit(1)
' "$ROOT" 2>&1); then
  deny "$ERROR"
fi
exit 0
