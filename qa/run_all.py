#!/usr/bin/env python
"""LinuxDocs one-shot QA runner: build, lint, backend tests, dataset audit, live probes.

Runs every quality gate in the documented order, saves each suite's full output
under qa/last-qarun/, prints a bounded tail per suite and a final pass/fail
table. Exit code 0 only when every suite passed.

The two dev servers (Flask :5000, Vite :5173) are required by the browser-based
probes. If a server is already reachable it is left untouched; if missing, this
script starts it, logs to qa/last-qarun/server-*.log, and terminates only the
processes it spawned.

Usage:
    python qa/run_all.py                       # full run
    npm run qa                                 # same, via package.json
    python qa/run_all.py --only build,audit    # subset (prefix match on key)
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
VENV_PY = BACKEND / "venv" / "Scripts" / "python.exe"
LOGDIR = Path(__file__).resolve().parent / "last-qarun"

FLASK_HEALTH = "http://localhost:5000/api/health"
VITE_URL = "http://localhost:5173"

TAIL_LINES = 28  # printed per suite after it finishes
SERVER_START_TIMEOUT = 60.0  # seconds to wait for a spawned dev server


def _http_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2):
            return True
    except Exception:
        return False


_SELECTED: set | None = None  # suite keys the operator asked for; None = full run


def only_has(key: str) -> bool:
    """True when the selected suites include `key` (or when running everything)."""
    if _SELECTED is None:
        return True
    return any(k == key or k.startswith(key) or key.startswith(k) for k in _SELECTED)


def _wait_http(url: str, timeout_s: float) -> bool:
    end = time.time() + timeout_s
    while time.time() < end:
        if _http_ok(url):
            return True
        time.sleep(0.5)
    return False


# ---------------------------------------------------------------- log helpers
def _read_log(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def _tail(path: Path) -> str:
    lines = _read_log(path).splitlines()
    shown = lines[-TAIL_LINES:]
    dropped = len(lines) - len(shown)
    prefix = f"[... {dropped} earlier lines in {path.name}]\n" if dropped > 0 else ""
    return prefix + "\n".join(shown)


def _count(log: str, pattern: str) -> int:
    return len(re.findall(pattern, log, flags=re.MULTILINE))


# ------------------------------------------------------------- result markers
def mark_build(log: str):
    m = re.search(r"dist/[^\s]*index[^\s]*\.js\s+([\d.]+)\s*kB", log)
    g = re.search(r"dist/[^\s]*index[^\s]*\.js\s+[\d.]+\s*kB.*?gzip:\s*([\d.]+)\s*kB", log)
    detail = "built"
    if m:
        detail = f"entry {m.group(1)} kB"
        if g:
            detail += f" · gzip {g.group(1)} kB"
    return True, detail


def mark_lint(log: str):
    m = re.search(r"Found (\d+) warnings? and (\d+) errors?", log)
    if m:
        return True, f"{m.group(1)} warnings · {m.group(2)} errors"
    return True, "clean"


def mark_pytest(log: str):
    m = re.search(r"(\d+) passed", log)
    if not m:
        return False, "no pytest summary found"
    extra = []
    for pat, word in ((r"(\d+) failed", "failed"), (r"(\d+) error", "errors")):
        e = re.search(pat, log)
        if e:
            extra.append(f"{e.group(1)} {word}")
    detail = f"{m.group(1)} passed"
    if extra:
        detail += " · " + ", ".join(extra)
    return True, detail


def mark_audit(log: str):
    if "AUDIT PASSED" not in log:
        return False, "AUDIT FAILED" if "AUDIT FAILED" in log else "no audit verdict"
    parts = []
    m = re.search(r"audit \((\d+) entries\)", log)
    if m:
        parts.append(f"{m.group(1)} entries")
    w = re.search(r"warnings documented\s*:\s*(\d+)", log)
    if w:
        parts.append(f"{w.group(1)} warnings")
    t = re.search(r"pending review\s*:\s*(\d+) entries", log)
    if t:
        parts.append(f"{t.group(1)} pending review")
    return True, " · ".join(parts) or "passed"


def mark_count_result(label):
    """Parse the '<label> RESULT: X/Y PASS' line used by browser/smoke suites."""

    def _mark(log: str):
        m = re.search(label + r" RESULT: (\d+)/(\d+) PASS", log)
        if not m:
            return False, "no result line"
        return (m.group(1) == m.group(2)), f"{m.group(1)}/{m.group(2)} checks"

    return _mark


def mark_all_passed(title):
    """Parse the 'ALL ... CHECKS PASSED' marker; count PASS/FAIL step lines."""

    def _mark(log: str):
        if title not in log:
            m = re.search(r"FAILURES -> (.+)", log)
            return False, (m.group(1)[:120] if m else "suite did not report success")
        npass = _count(log, r"^\s*PASS\b")
        nfail = _count(log, r"^\s*FAIL\b")
        return True, f"{npass} PASS steps" + (f" · {nfail} FAIL" if nfail else "")

    return _mark


# ------------------------------------------------------------ suite registry
SUITES = [
    (
        "build",
        "npm run build (tsc -b + vite build)",
        ("cmd", "/c", "npm", "run", "build"),
        ROOT,
        420,
        mark_build,
    ),
    (
        "lint",
        "npm run lint (oxlint)",
        ("cmd", "/c", "npm", "run", "lint"),
        ROOT,
        120,
        mark_lint,
    ),
    (
        "pytest",
        "backend pytest",
        (str(VENV_PY), "-m", "pytest", "tests", "-q"),
        BACKEND,
        420,
        mark_pytest,
    ),
    (
        "audit",
        "dataset docs-accuracy audit",
        (sys.executable, "qa/dataset_audit.py"),
        ROOT,
        120,
        mark_audit,
    ),
    (
        "browser",
        "browser_check.py (real Chrome QA)",
        (sys.executable, "qa/browser_check.py"),
        ROOT,
        600,
        mark_count_result("BROWSER"),
    ),
    (
        "smoke",
        "smoke_api.py (API smoke)",
        (sys.executable, "qa/smoke_api.py"),
        ROOT,
        240,
        mark_count_result("SMOKE"),
    ),
    (
        "sync",
        "sync_probe.py (persistence/sync)",
        (sys.executable, "qa/sync_probe.py"),
        ROOT,
        600,
        mark_all_passed("ALL SYNC-HARDENING CHECKS PASSED"),
    ),
    (
        "terminal",
        "terminal_probe.py (practice terminal)",
        (sys.executable, "qa/terminal_probe.py"),
        ROOT,
        700,
        mark_all_passed("ALL TERMINAL CHECKS PASSED"),
    ),
    (
        "reset",
        "reset_probe.py (password reset)",
        (sys.executable, "qa/reset_probe.py"),
        ROOT,
        420,
        mark_all_passed("ALL RESET-SECURITY CHECKS PASSED"),
    ),
]


# ----------------------------------------------------------- server handling
def ensure_servers():
    """Return (flask_proc_or_None, vite_proc_or_None), starting what is missing."""
    flask = vite = None
    if not _http_ok(FLASK_HEALTH):
        print("[servers] Flask not healthy on :5000 -> starting (log: server-flask.log)")
        print("[servers]           with RESET_REQUEST_RATE_LIMIT=50 (QA relief; see reset_probe)")
        env = os.environ.copy()
        # The full gate makes 3 reset requests per run; the production default of
        # 5/hour/ip collides across consecutive gate runs within the same hour.
        env.setdefault("RESET_REQUEST_RATE_LIMIT", "50")
        log = open(LOGDIR / "server-flask.log", "w", encoding="utf-8")
        flask = subprocess.Popen(
            (str(VENV_PY), "-m", "flask", "run", "--port", "5000"),
            cwd=BACKEND,
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        if not _wait_http(FLASK_HEALTH, SERVER_START_TIMEOUT):
            print("[servers] WARNING: Flask did not become healthy in time")
    else:
        print("[servers] Flask :5000 already up (external, left running)")
        if only_has("reset"):
            print("[servers] NOTE: reset probe spends the 5/hour reset-request budget."
                  " If the gate re-runs within an hour, restart the QA Flask with"
                  " RESET_REQUEST_RATE_LIMIT=50 or expect a 429-driven reset failure.")

    if not _http_ok(VITE_URL):
        print("[servers] Vite not responding on :5173 -> starting (log: server-vite.log)")
        log = open(LOGDIR / "server-vite.log", "w", encoding="utf-8")
        vite = subprocess.Popen(
            ("cmd", "/c", "npm", "run", "dev"),
            cwd=ROOT,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
        if not _wait_http(VITE_URL, SERVER_START_TIMEOUT):
            print("[servers] WARNING: Vite did not become reachable in time")
    else:
        print("[servers] Vite :5173 already up (external, left running)")
    return flask, vite


def _kill(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        # Windows npm spawns a cmd -> node tree; kill the whole tree.
        subprocess.run(("taskkill", "/F", "/T", "/PID", str(proc.pid)), capture_output=True)
    except Exception:
        pass


def run_suite(key, title, argv, cwd, timeout, marker, log_path):
    print(f"\n{'=' * 70}\n[{key}] {title}\n{'-' * 70}")
    started = time.time()
    timed_out = False
    try:
        with open(log_path, "w", encoding="utf-8") as logf:
            proc = subprocess.Popen(
                argv,
                cwd=cwd,
                stdout=logf,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            try:
                code = proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                proc.kill()
                proc.wait()
                code = proc.returncode
    except Exception as exc:  # failed to even start
        log_path.write_text(f"suite failed to start: {exc}", encoding="utf-8")
        code = 127

    duration = time.time() - started
    log = _read_log(log_path)

    if timed_out:
        ok, detail = False, f"TIMEOUT after {timeout:.0f}s"
    elif code != 0:
        m_ok, m_detail = marker(log)
        ok, detail = False, f"exit {code}" + (f" ({m_detail})" if m_detail else "")
    else:
        ok, detail = marker(log)

    print(_tail(log_path))
    return {
        "key": key,
        "title": title,
        "ok": ok and not timed_out,
        "detail": detail,
        "duration": duration,
        "log": str(log_path.relative_to(ROOT)),
    }


def main() -> int:
    # Console may be cp1252; vite/pytest output contains box-drawing chars.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", default="", help="comma-separated suite keys to run")
    args = parser.parse_args()

    global _SELECTED
    _SELECTED = ({s.strip() for s in args.only.split(",") if s.strip()}
                 if args.only else None)
    suites = [s for s in SUITES
              if not _SELECTED or s[0] in _SELECTED
              or any(s[0].startswith(o) for o in _SELECTED)]

    LOGDIR.mkdir(exist_ok=True)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"LinuxDocs QA run — {stamp}")
    print(f"logs: {LOGDIR}")

    flask_proc, vite_proc = ensure_servers()
    try:
        results = [run_suite(*suite, LOGDIR / f"{suite[0]}.log") for suite in suites]
    finally:
        if flask_proc:
            _kill(flask_proc)
        if vite_proc:
            _kill(vite_proc)
            print("[servers] stopped the Vite/Flask processes this run started")

    width = max(len(r["key"]) for r in results)
    print(f"\n{'=' * 70}\nQA RESULTS — {stamp}\n{'=' * 70}")
    for r in results:
        flag = "PASS" if r["ok"] else "FAIL"
        print(f"[{flag}] {r['key']:<{width}}  {r['duration']:6.1f}s  {r['detail']}")

    failed = [r["key"] for r in results if not r["ok"]]
    if failed:
        print(f"\nQA FAILED -> {', '.join(failed)} (logs in {LOGDIR})")
        return 1
    print(f"\nALL {len(results)} QA SUITES PASSED (logs in {LOGDIR})")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
