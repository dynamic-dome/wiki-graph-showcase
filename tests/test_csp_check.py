from __future__ import annotations

import base64
import hashlib

from tools import csp_check

IMPORTMAP = b'\n  { "imports": { "three": "./a.js" } }\n  '
HTML = b'<html><script type="importmap">' + IMPORTMAP + b"</script></html>"
HASH = "sha256-" + base64.b64encode(hashlib.sha256(IMPORTMAP).digest()).decode()


def test_importmap_hash_matches_sha256_base64() -> None:
    assert csp_check.importmap_hash(HTML) == HASH


def test_verify_ok_when_hash_in_script_src() -> None:
    csp = f"default-src 'self'; script-src 'self' '{HASH}'; img-src 'self'"
    assert csp_check.verify(HTML, csp) == []


def test_verify_reports_missing_hash() -> None:
    problems = csp_check.verify(HTML, "default-src 'self'; script-src 'self'")
    assert any("fehlt" in p for p in problems)


def test_verify_reports_unsafe_inline() -> None:
    csp = f"script-src 'self' '{HASH}' 'unsafe-inline'"
    assert any("unsafe-inline" in p for p in csp_check.verify(HTML, csp))


def test_verify_reports_missing_importmap() -> None:
    assert csp_check.verify(b"<html></html>", "script-src 'self'") == ["kein importmap-Script im HTML"]
