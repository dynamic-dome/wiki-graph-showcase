"""Statische Vorschau von dist/ MIT den Headern aus dist/_headers.

`python -m http.server` ignoriert _headers: ein CSP-Bruch (z. B. veralteter
Import-Map-Hash) bleibt lokal unsichtbar und fällt erst live auf. Dieser Server
spielt den `/*`-Block der _headers auf jede Antwort aus. Kein SPA-Rückfall:
unbekannte Pfade antworten 404 (mit dem Inhalt von dist/404.html, falls vorhanden). Bindet nur an 127.0.0.1.

    python -m tools.preview_server --dist dist --port 8051
"""
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def parse_headers(text: str) -> dict[str, str]:
    """Header der globalen `/*`-Regel. Kommentarzeilen und andere Pfadregeln werden ignoriert."""
    headers: dict[str, str] = {}
    in_global = False
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if not raw[0].isspace():
            in_global = raw.strip() == "/*"
            continue
        if in_global and ":" in raw:
            name, value = raw.strip().split(":", 1)
            headers[name.strip()] = value.strip()
    return headers


_MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
    ".woff2": "font/woff2",
    ".jpg": "image/jpeg",
}


def make_server(dist: Path, port: int, host: str = "127.0.0.1") -> ThreadingHTTPServer:
    dist = Path(dist)
    headers_file = dist / "_headers"
    headers = parse_headers(headers_file.read_text(encoding="utf-8")) if headers_file.is_file() else {}

    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **_MIME}

        def end_headers(self) -> None:
            for name, value in headers.items():
                self.send_header(name, value)
            super().end_headers()

        def send_error(self, code: int, message: str | None = None, explain: str | None = None) -> None:
            # Wie Cloudflare Pages: unbekannter Pfad -> Status 404 mit dem Inhalt von 404.html.
            page = dist / "404.html"
            if code == 404 and page.is_file():
                body = page.read_bytes()
                self.send_response(404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
                return
            super().send_error(code, message, explain)

        def log_message(self, fmt: str, *args: object) -> None:  # ruhig
            pass

    return ThreadingHTTPServer((host, port), partial(Handler, directory=str(dist)))


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dist", type=Path, default=Path("dist"))
    ap.add_argument("--port", type=int, default=8051)
    args = ap.parse_args()
    server = make_server(args.dist, args.port)
    print(f"Vorschau mit _headers: http://127.0.0.1:{args.port}/ ({args.dist})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    _main()
