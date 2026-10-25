#!/usr/bin/env python3
"""PostToolUse guard for works and kits.

Three checks are cheap here and expensive to discover later:

  A syntax error stops the whole script, so the work never sets window.__film
  and every tool fails on it. Each inline script of an HTML work, and each kit
  or series .js file, is parsed with `node --check` (skipped when node is
  missing); JSON blocks are loaded as JSON. Errors are reported at their line.

  Math.random() in a render path makes lines crawl between frames and breaks
  seek purity. tools/verify.mjs catches it, but only if someone runs it.

  window.__film is how every tool in tools/ drives a work. Lose it and shoot,
  verify and render all stop working at once.

The last two apply to works in films/ and stills/ and to kit code. Comments are
stripped before checking them, because the contract is quoted in comments.

Findings go to stderr with exit 2: a PostToolUse hook that exits 0 has its stdout
kept out of the model's context. The write has already happened; exit 2 reports,
it does not revert. Silent when clean.
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.S)
LINE_COMMENT = re.compile(r"(?m)//.*$")
RANDOM_CALL = re.compile(r"Math\.random\s*\(")
SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", re.S | re.I)
SCRIPT_TYPE = re.compile(r"""(?<![\w-])type\s*=\s*["']?([^"'\s>]+)""", re.I)
JS_TYPES = {"text/javascript", "application/javascript", "module"}


def node_check(code, name, offset, module=False):
    node = shutil.which("node")
    if not node:
        return []
    fd, tmp = tempfile.mkstemp(suffix=".mjs" if module else ".cjs")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(code)
        r = subprocess.run([node, "--check", tmp], capture_output=True, text=True, timeout=8)
    except Exception:
        return []
    finally:
        os.unlink(tmp)
    if r.returncode == 0:
        return []
    lines = r.stderr.splitlines()
    at = re.search(r":(\d+)$", lines[0]) if lines else None
    line = int(at.group(1)) + offset if at else "?"
    message = next((l for l in lines if re.match(r"\w*Error\b", l)), "syntax error")
    snippet = [l[:160] for l in lines[1:3]]
    return ["{} line {}: {}\n    {}".format(name, line, message, "\n    ".join(snippet))]


def html_errors(source, name):
    found = []
    for m in SCRIPT.finditer(source):
        offset = source[: m.start(2)].count("\n")
        kind = (SCRIPT_TYPE.search(m.group(1)) or [None, "text/javascript"])[1].lower()
        if kind.endswith("json"):
            try:
                json.loads(m.group(2))
            except ValueError as e:
                found.append("{} line {}: JSON in <script type={}>: {}".format(
                    name, getattr(e, "lineno", 0) + offset, kind, getattr(e, "msg", e)))
        elif kind in JS_TYPES:
            found += node_check(m.group(2), name, offset, kind == "module")
    return found


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    path = (payload.get("tool_input") or {}).get("file_path") or ""
    n = path.replace("\\", "/")
    work = ("/films/" in n or "/stills/" in n) and n.endswith(".html")
    kit = ("/kit/" in n or "/series/" in n) and n.endswith(".js")
    study = "/studies/" in n and n.endswith(".html")
    if not (work or kit or study):
        return 0
    try:
        source = pathlib.Path(path).read_text(encoding="utf-8")
    except Exception:
        return 0
    name = pathlib.Path(path).name
    problems = node_check(source, name, 0) if kit else html_errors(source, name)
    if work or kit:
        code = LINE_COMMENT.sub("", BLOCK_COMMENT.sub("", source))
        hits = len(RANDOM_CALL.findall(code))
        if hits:
            problems.append("{} Math.random() call(s) in {}. seek(t) must be pure in t, so seed from "
                            "rngFor(key) instead; verify.mjs will fail and lines will crawl.".format(hits, name))
        if work and "window.__film" not in code:
            problems.append("{} no longer exposes window.__film; shoot, verify and render all drive "
                            "works through it.".format(name))
    if problems:
        print("Work check:\n- " + "\n- ".join(problems), file=sys.stderr)
        return 2
    return 0


sys.exit(main())
