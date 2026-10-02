"""Prüft, dass der sha256-Hash der Inline-Import-Map in der CSP-script-src steht.

    python -m tools.csp_check https://wiki.dynamic-dome.com/
"""
from __future__ import annotations

import base64
import hashlib
import re
import sys
import urllib.request

_IMPORTMAP = re.compile(rb"<script type=.importmap.>(.*?)</script>", re.DOTALL)


def importmap_hash(html: bytes) -> str | None:
    match = _IMPORTMAP.search(html)
    if not match:
        return None
    return "sha256-" + base64.b64encode(hashlib.sha256(match.group(1)).digest()).decode()


def _script_src(csp: str) -> str:
    for directive in csp.split(";"):
        directive = directive.strip()
        if directive.startswith("script-src"):
            return directive
    return ""


def verify(html: bytes, csp: str) -> list[str]:
    digest = importmap_hash(html)
    if digest is None:
        return ["kein importmap-Script im HTML"]
    problems: list[str] = []
    script_src = _script_src(csp)
    if f"'{digest}'" not in script_src:
        problems.append(f"Hash {digest} fehlt in script-src")
    if "'unsafe-inline'" in script_src:
        problems.append("script-src enthält 'unsafe-inline'")
    return problems


def fetch(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 csp-check"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.read(), res.headers.get("Content-Security-Policy", "")


def _main() -> int:
    if len(sys.argv) != 2:
        print("Aufruf: python -m tools.csp_check <url>")
        return 2
    html, csp = fetch(sys.argv[1])
    problems = verify(html, csp)
    print(f"Hash im HTML: {importmap_hash(html)}")
    print(f"script-src : {_script_src(csp) or '(keine CSP-Antwort)'}")
    for p in problems:
        print(f"PROBLEM: {p}")
    print("OK" if not problems else "FEHLER")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(_main())
