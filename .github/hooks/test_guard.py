"""Inert guard regression tests. Run: python3 .github/hooks/test_guard.py

Requires only Python's standard library, bash, and the guard's existing jq.
Payloads are sent to the guard, never to mutation/shell execution tools.
The exact current guard is copied into an isolated temporary repository so
symlink fixtures cannot modify the working tree or its protected files.

Envelope evidence (checked 2026-10-22):
https://docs.github.com/en/copilot/reference/hooks-configuration documents
toolName/toolArgs. This session's hook.start events instead record toolCalls
with id/name/args, including raw apply_patch strings. Those events may be
internal aggregation, so test both rather than assuming either is exclusive.
edit/create aliases are compatibility cases, not observed session invocations.
"""

import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


GUARD = Path(__file__).with_name("guard.sh")


def patch(operation, path, body=""):
    return f"*** Begin Patch\n*** {operation}: {path}\n{body}*** End Patch\n"


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="guard-regression-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        hooks = self.root / ".github/hooks"
        hooks.mkdir(parents=True)
        self.guard = hooks / "guard.sh"
        shutil.copyfile(GUARD, self.guard)
        (self.root / "src").mkdir()
        (self.root / "src/specs.ts").touch()
        (self.root / ".env.local").touch()
        (self.root / "spec-link").symlink_to(self.root / "src/specs.ts")
        (self.root / "env-link").symlink_to(self.root / ".env.local")
        (self.root / "src-link").symlink_to(self.root / "src", target_is_directory=True)
        (self.root / ".env-alias").symlink_to(self.root / "src", target_is_directory=True)
        (self.root / "nested").mkdir()

    def check(self, tool, args, denied=False, batch=False, cwd=None):
        request = {"cwd": str(cwd or self.root)}
        if batch:
            request["toolCalls"] = [{"id": "inert-test", "name": tool, "args": args}]
        else:
            request.update(toolName=tool, toolArgs=args)
        self.check_request(request, denied)

    def check_request(self, request, denied):
        result = subprocess.run(
            ["bash", str(self.guard)],
            input=json.dumps(request), text=True, capture_output=True, cwd=self.root,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        if denied:
            self.assertTrue(result.stdout, "guard allowed an expected-denied payload")
            decision = json.loads(result.stdout)
            self.assertEqual(decision["permissionDecision"], "deny")
            self.assertTrue(decision["permissionDecisionReason"].startswith("Blocked by guardrails:"))
        else:
            self.assertEqual(result.stdout, "", result.stdout)
        self.assertEqual(result.stderr, "", result.stderr)

    def test_edit_create_aliases_objects_and_json_strings(self):
        for tool in ("edit", "create"):
            for key in ("path", "file_path", "filePath"):
                for encode in (lambda x: x, json.dumps):
                    with self.subTest(tool=tool, key=key, encode=encode):
                        self.check(tool, encode({key: "notes.md", "content": ".env src/specs.ts"}))
                        self.check(tool, encode({key: "src/specs.ts"}), denied=True)

    def test_all_aliases_are_validated(self):
        self.check("edit", {"path": "notes.md", "filePath": "src/specs.ts"}, denied=True)
        self.check("create", {"path": "notes.md", "file_path": None}, denied=True)

    def test_destination_normalization(self):
        for path in ("src/specs.ts", "./src/specs.ts", "src/../src/specs.ts",
                     str(self.root / "src/specs.ts"), ".env", ".env.local",
                     "nested/.env.local/file", "notes.env.backup", "spec-link",
                     "env-link", "src-link/specs.ts", ".env-alias/other.ts"):
            with self.subTest(path=path):
                self.check("edit", {"path": path}, denied=True)
        # Lexical protection survives a symlink resolving out of the protected path.
        (self.root / "elsewhere").mkdir()
        (self.root / "src").rename(self.root / "original-src")
        (self.root / "src").symlink_to(self.root / "elsewhere", target_is_directory=True)
        self.check("edit", {"path": "src/specs.ts"}, denied=True)
        self.check("edit", {"path": "original-src/specs.ts"}, denied=False)

    def test_request_cwd_is_used(self):
        self.check("edit", {"path": "../src/specs.ts"}, cwd=self.root / "nested", denied=True)
        self.check("edit", {"path": "../.env.local"}, cwd=self.root / "nested", denied=True)
        self.check("edit", {"path": "notes.md"}, cwd=self.root / "nested")
        self.check_request({"toolName": "edit", "toolArgs": {"path": "notes.md"}, "cwd": []}, True)
        # realpath must process symlinks before '..', not just normalize text.
        (self.root / "nested/deeper").mkdir()
        (self.root / "into-nested").symlink_to(self.root / "nested/deeper",
                                             target_is_directory=True)
        self.check("edit", {"path": "into-nested/../../src/specs.ts"}, denied=True)
        # Conversely, lexical normalization is protected although realpath is not.
        self.check("edit", {"path": "into-nested/../src/specs.ts"}, denied=True)

    def test_patch_representations_and_content_mentions(self):
        raw = patch("Add File", "notes.md", "+mentions .env and src/specs.ts\n")
        update = patch("Update File", "notes.md", "@@\n-old\n+src/specs.ts and .env\n")
        eof = patch("Update File", "notes.md", "@@ heading\n-old\n+new\n*** End of File\n")
        for text in (raw, update, eof, patch("Delete File", "notes.md"),
                     patch("Update File", "notes.md")):
            for payload in (text, json.dumps(text), {"patch": text}, {"input": text},
                            json.dumps({"patch": text}), json.dumps({"input": text})):
                with self.subTest(payload=payload):
                    self.check("apply_patch", payload)

    def test_patch_protected_operations(self):
        for operation, body in (("Add File", "+inert\n"), ("Update File", "@@\n-a\n+b\n"),
                                ("Delete File", "")):
            for path in ("src/specs.ts", ".env.local", "spec-link", "src-link/specs.ts"):
                with self.subTest(operation=operation, path=path):
                    self.check("apply_patch", patch(operation, path, body), denied=True)

    def test_moves_validate_source_and_destination(self):
        for source, target, denied in (
            ("notes.md", "renamed.md", False),
            ("src/specs.ts", "notes.md", True),
            ("notes.md", "src/specs.ts", True),
            ("notes.md", "env-link", True),
        ):
            self.check("apply_patch", patch("Update File", source,
                       f"*** Move to: {target}\n@@\n-old\n+new\n"), denied=denied)

    def test_multiple_operations_and_wrappers(self):
        safe = patch("Add File", "notes.md", "+safe\n")
        unsafe = patch("Delete File", "src/specs.ts")
        self.check("apply_patch", safe.replace("*** End Patch\n", "") +
                   unsafe.replace("*** Begin Patch\n", ""), denied=True)
        self.check("apply_patch", {"patch": safe, "input": unsafe}, denied=True)

    def test_malformed_destinations(self):
        for args in ({}, [], None, "not JSON", {"path": ""}, {"path": " "},
                     {"path": 4}, {"path": "a\nb"}, {"path": "a\rb"}, {"path": "a\0b"}):
            for tool in ("edit", "create"):
                with self.subTest(tool=tool, args=args):
                    self.check(tool, args, denied=True)

    def test_malformed_patches(self):
        for payload in ({}, {"patch": None}, {"input": []}, "not a patch",
                        "*** Begin Patch\n*** End Patch\n",
                        patch("Move to", "notes.md"),
                        patch("Delete File", "notes.md", "+bad\n"),
                        patch("Update File", "notes.md", "@@garbage\n+bad\n"),
                        patch("Update File", "notes.md", "*** End of File\n+after-end\n"),
                        patch("Update File", "notes.md", "*** Move to: x\n*** Move to: y\n"),
                        patch("Add File", "notes.md")):
            with self.subTest(payload=payload):
                self.check("apply_patch", payload, denied=True)

    def test_observed_batch_envelope(self):
        for tool, args in (
            ("edit", {"path": "src/specs.ts"}),
            ("create", json.dumps({"filePath": ".env"})),
            ("apply_patch", patch("Delete File", "src/specs.ts")),
            ("bash", {"command": "git push --force"}),
        ):
            self.check(tool, args, batch=True, denied=True)
        self.check("apply_patch", patch("Add File", "notes.md", "+src/specs.ts .env\n"), batch=True)
        self.check_request({"toolCalls": [
            {"id": "safe", "name": "view", "args": {"path": "README.md"}},
            {"id": "unsafe", "name": "edit", "args": {"path": "src/specs.ts"}},
        ]}, True)
        for calls in (None, [], [{}], [{"name": "edit"}]):
            self.check_request({"toolCalls": calls}, True)
        self.check_request({
            "toolName": "view", "toolArgs": {"path": "README.md"},
            "toolCalls": [{"name": "edit", "args": {"path": "src/specs.ts"}}],
        }, True)
        self.check_request({
            "toolName": "edit", "toolArgs": {"path": "src/specs.ts"},
            "toolCalls": [{"name": "view", "args": {"path": "README.md"}}],
        }, True)
        for request in ({}, [], None, {"toolName": "edit"},
                        {"toolName": None, "toolArgs": {}}):
            self.check_request(request, True)

    def test_existing_shell_rules_are_retained(self):
        for args in ({"command": "rm -rf inert"}, {"command": "git push -f"},
                     {"command": "git push --force"}, json.dumps({"command": "rm -rf inert"})):
            self.check("bash", args, denied=True)
        self.check("bash", {"command": "printf harmless"})

    def test_read_only_tools_remain_allowed(self):
        self.check("view", {"path": "src/specs.ts"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
