from __future__ import annotations

import threading
import urllib.error
import urllib.request
from pathlib import Path

from tools import preview_server

HEADERS_FILE = """\
# Kommentar
/*
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; font-src 'self' data:

/andere/*
  X-Test: nicht-global
"""


def test_parse_headers_reads_global_block_only() -> None:
    parsed = preview_server.parse_headers(HEADERS_FILE)
    assert parsed == {
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'self'; font-src 'self' data:",
    }


def test_server_serves_headers_js_mime_and_404(tmp_path: Path) -> None:
    (tmp_path / "_headers").write_text(HEADERS_FILE, encoding="utf-8")
    (tmp_path / "index.html").write_text("<!doctype html><title>x</title>", encoding="utf-8")
    (tmp_path / "a.js").write_text("export const a = 1;", encoding="utf-8")

    server = preview_server.make_server(tmp_path, port=0)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/") as res:
            assert res.status == 200
            assert res.headers["Content-Security-Policy"].startswith("default-src 'self'")
            assert res.headers["X-Frame-Options"] == "DENY"
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/a.js") as res:
            assert res.headers["Content-Type"].startswith("text/javascript")
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/gibt-es-nicht")
            raise AssertionError("erwartet 404, kein SPA-Rückfall")
        except urllib.error.HTTPError as err:
            assert err.code == 404
    finally:
        server.shutdown()
        server.server_close()
