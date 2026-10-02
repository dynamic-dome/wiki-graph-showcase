from __future__ import annotations

from pathlib import Path

from tools import build

SITEMAP = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    "  <url>\n    <loc>https://wiki.dynamic-dome.com/</loc>\n    <lastmod>2026-07-06</lastmod>\n  </url>\n"
    "</urlset>"
)


def test_stamp_replaces_lastmod(tmp_path: Path) -> None:
    path = tmp_path / "sitemap.xml"
    path.write_bytes(SITEMAP.encode("utf-8"))
    assert build._stamp_sitemap_lastmod(path, "2026-10-05") is True
    text = path.read_bytes().decode("utf-8")
    assert "<lastmod>2026-10-05</lastmod>" in text
    assert "2026-07-06" not in text
    assert "\r\n" not in text  # Zeilenenden bleiben unveraendert


def test_stamp_leaves_file_without_lastmod_untouched(tmp_path: Path) -> None:
    path = tmp_path / "sitemap.xml"
    original = b'<?xml version="1.0"?><urlset></urlset>'
    path.write_bytes(original)
    assert build._stamp_sitemap_lastmod(path, "2026-10-05") is False
    assert path.read_bytes() == original


def test_stamp_handles_empty_file(tmp_path: Path) -> None:
    path = tmp_path / "sitemap.xml"
    path.write_bytes(b"")
    assert build._stamp_sitemap_lastmod(path, "2026-10-05") is False


def test_copy_frontend_assets_stamps_dist_but_not_src(tmp_path: Path) -> None:
    src = tmp_path / "src"
    out = tmp_path / "dist"
    src.mkdir()
    out.mkdir()
    (src / "sitemap.xml").write_bytes(SITEMAP.encode("utf-8"))
    build._copy_frontend_assets(src, out, today="2026-10-05")
    assert b"<lastmod>2026-10-05</lastmod>" in (out / "sitemap.xml").read_bytes()
    assert b"<lastmod>2026-07-06</lastmod>" in (src / "sitemap.xml").read_bytes()
