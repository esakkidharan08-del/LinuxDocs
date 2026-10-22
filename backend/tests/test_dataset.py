"""Dataset docs-accuracy regression tests (Task 4).

Guards the backend/data/commands.json contract that src/data/commands.ts
generates via backend/scripts/build_commands.mjs:
  - 132 commands, unique slugs, sane slug charset
  - canonical json.dumps(indent=2) file formatting
  - category/domain references resolve
  - every entry documents at least one example; flag tokens are well-formed
  - destructive/root commands carry a `warnings` note
  - needsHumanReview is exactly the thin-docs queue
"""

import json
import re
from pathlib import Path

import pytest

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "commands.json"

EXPECTED_COUNT = 132

ALIASES = {"ripgrep": {"rg"}, "radare2": {"r2"}}

OPERAND_TOKENS = {
    "cd": {"..", "~"},
    "ps": {"aux"},
    "ip": {"addr show", "route show", "link set"},
    "apt": {"update", "upgrade", "install", "remove", "search"},
    "systemctl": {"start", "stop", "restart", "status", "enable"},
    "gobuster": {"dir", "dns"},
    "steghide": {"embed", "extract"},
    "adb": {"devices", "shell", "install", "pull"},
    "apktool": {"d", "b"},
    "trivy": {"image", "fs"},
    "volatility": {"pslist", "netscan"},
    "openssl": {"s_client", "x509", "enc", "base64"},
    "radare2": {"aaa", "pdf", "iz", "V"},
}

WARNING_REQUIRED = {
    "rm", "dd", "shred", "truncate", "kill", "pkill", "mv", "chmod", "chattr",
    "chown", "chgrp", "apt", "dpkg", "useradd", "passwd", "systemctl", "history",
    "nmap", "sqlmap",
}


@pytest.fixture(scope="module")
def dataset():
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def _flag_ok(slug: str, flag: str) -> bool:
    t = flag.strip()
    if t != flag or not t or len(t) > 32 or "  " in t:
        return False
    if t.startswith("-") or t.startswith("+"):
        return True
    if re.match(r"[a-z][a-z0-9-]*=", t):
        return True
    if t.upper() == t and re.fullmatch(r"[A-Z][A-Z0-9_]*", t):
        return True
    return t in OPERAND_TOKENS.get(slug, set())


def _references(slug: str, text: str) -> bool:
    if not text:
        return False
    probe = re.sub(r"^sudo\s+", "", text)
    tokens = {slug.lower(), *{a.lower() for a in ALIASES.get(slug, set())}}
    return any(re.search(rf"(?<![a-z0-9_\-.]){re.escape(t)}(?![a-z0-9_\-.])", probe, re.I) for t in tokens)


def test_dataset_shape(dataset):
    commands = dataset["commands"]
    assert len(commands) == EXPECTED_COUNT
    slugs = [c["slug"] for c in commands]
    assert len(set(slugs)) == len(slugs)
    for s in slugs:
        assert re.fullmatch(r"[a-z0-9]+", s), f"bad slug charset: {s}"
    assert set(dataset["needsHumanReview"]) <= set(slugs)


def test_canonical_formatting():
    raw = DATA_PATH.read_text(encoding="utf-8")
    assert json.dumps(json.loads(raw), indent=2, ensure_ascii=False) + "\n" == raw


def test_categories_and_domains_resolve(dataset):
    cat_ids = {c["id"] for c in dataset["categories"]}
    dom_ids = {d["id"] for d in dataset["domains"]}
    for c in dataset["commands"]:
        if c["section"] == "linux":
            assert c["category"] in cat_ids, f"{c['slug']} unknown category {c['category']}"
        elif c["section"] == "ctf":
            assert c["category"] in dom_ids, f"{c['slug']} unknown domain {c['category']}"
        else:
            pytest.fail(f"{c['slug']} unknown section {c['section']!r}")


def test_examples_and_flag_tokens(dataset):
    for c in dataset["commands"]:
        slug = c["slug"]
        assert c["examples"], f"{slug} has no examples"
        assert c["useCases"], f"{slug} has no useCases"
        assert c["tags"], f"{slug} has no tags"
        assert _references(slug, c["syntax"]), f"{slug}: syntax does not reference the tool ({c['syntax']!r})"
        for e in c["examples"]:
            assert e["title"].strip(), f"{slug}: example without title"
            assert e["explanation"].strip(), f"{slug}: example without explanation"
            assert any(
                _references(slug, e.get(k) or "") for k in ("title", "command", "explanation")
            ), f"{slug}: example never references the tool ({e['command']!r})"
        for o in c.get("options", []):
            assert o["description"].strip(), f"{slug}: option {o['flag']!r} without description"
            assert _flag_ok(slug, o["flag"]), f"{slug}: bad flag token {o['flag']!r}"
            ex = (o.get("example") or "").strip()
            if ex:
                assert _references(slug, ex), f"{slug}: option example does not reference the tool ({ex!r})"


def test_related_references_resolve(dataset):
    slugs = {c["slug"] for c in dataset["commands"]}
    for c in dataset["commands"]:
        for r in c.get("related", []):
            assert r in slugs, f"{c['slug']}: related references missing slug {r!r}"
            assert r != c["slug"], f"{c['slug']}: related references itself"


def test_warning_policy(dataset):
    by_slug = {c["slug"]: c for c in dataset["commands"]}
    for slug in WARNING_REQUIRED:
        assert (by_slug[slug].get("warnings") or "").strip(), f"{slug}: destructive/root entry lacks warnings"


def test_needs_human_review_is_thin_docs_queue(dataset):
    computed = sorted(
        c["slug"]
        for c in dataset["commands"]
        if len(c.get("examples") or []) < 3
        or not c.get("options")
        or not c.get("useCases")
        or not c.get("tags")
    )
    assert sorted(dataset["needsHumanReview"]) == computed
