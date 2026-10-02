from __future__ import annotations

import re
from pathlib import Path

from tools import csp_check

ROOT = Path(__file__).resolve().parent.parent
INDEX = (ROOT / "src" / "index.html").read_bytes()
HEADERS = (ROOT / "src" / "_headers").read_text(encoding="utf-8")


def _csp() -> str:
    for line in HEADERS.splitlines():
        if line.strip().startswith("Content-Security-Policy:"):
            return line.split(":", 1)[1].strip()
    raise AssertionError("keine CSP in src/_headers")


def test_importmap_hash_is_in_csp() -> None:
    assert csp_check.verify(INDEX, _csp()) == []


def test_force_graph_is_not_a_blocking_classic_script() -> None:
    assert not re.search(rb"<script[^>]+src=[^>]*3d-force-graph", INDEX)


def test_only_hashed_or_external_module_scripts_execute() -> None:
    for match in re.finditer(rb"<script([^>]*)>", INDEX):
        attrs = match.group(1)
        ok = (
            b"importmap" in attrs
            or b"application/ld+json" in attrs
            or (b'type="module"' in attrs and b"src=" in attrs)
        )
        assert ok, f"unerwartetes Script-Tag: {attrs!r}"
