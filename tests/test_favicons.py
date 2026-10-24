"""Favicon-Satz (#10034): wiki.dynamic-dome.com lieferte /favicon.ico als index.html mit 200 text/html.

Der Satz kommt aus dome-dynamics/public (ico, 32, 180, 192) und liegt als echte Dateien in src/.
"""
from __future__ import annotations

import re
import struct
from pathlib import Path

import pytest

from tools import build, pre_deploy_sweep

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PNG_SIZES = {"favicon-32.png": 32, "favicon-180.png": 180, "favicon-192.png": 192}


def test_favicon_lists_of_build_and_sweep_agree() -> None:
    assert build.FAVICON_FILES == pre_deploy_sweep.FAVICON_FILES
    assert set(build.FAVICON_FILES) == {"favicon.ico", *PNG_SIZES}


@pytest.mark.parametrize("name,size", sorted(PNG_SIZES.items()))
def test_png_icons_are_real_pngs_of_the_declared_size(name: str, size: int) -> None:
    data = (SRC / name).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = struct.unpack(">II", data[16:24])
    assert (width, height) == (size, size)


def test_ico_has_icon_header_and_embedded_sizes() -> None:
    data = (SRC / "favicon.ico").read_bytes()
    reserved, kind, count = struct.unpack("<HHH", data[:6])
    assert (reserved, kind) == (0, 1)
    assert count >= 2


@pytest.mark.parametrize("page", ["index.html", "404.html"])
def test_pages_link_the_favicon_set_root_absolute(page: str) -> None:
    html = (SRC / page).read_text(encoding="utf-8")
    assert re.search(r'<link rel="icon" href="/favicon\.ico"', html)
    assert re.search(r'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32\.png"', html)
    assert re.search(r'<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192\.png"', html)
    assert re.search(r'<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180\.png"', html)


def test_linked_icons_exist_in_src() -> None:
    for page in ("index.html", "404.html"):
        html = (SRC / page).read_text(encoding="utf-8")
        for href in re.findall(r'<link rel="(?:icon|apple-touch-icon)"[^>]*href="(/[^"]+)"', html):
            assert (SRC / href.lstrip("/")).is_file(), f"{page} verweist auf {href}, Datei fehlt in src/"


def test_copy_frontend_assets_ships_the_icons_to_dist(tmp_path: Path) -> None:
    out = tmp_path / "dist"
    out.mkdir()
    build._copy_frontend_assets(SRC, out)
    for name in build.FAVICON_FILES:
        assert (out / name).read_bytes() == (SRC / name).read_bytes()


def test_sweep_fails_when_a_favicon_is_missing(tmp_path: Path) -> None:
    from tests.test_pre_deploy_sweep import _write_minimal_dist

    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    code, _ = pre_deploy_sweep.run(dist)
    assert code == 0
    (dist / "favicon.ico").unlink()
    code, manifest = pre_deploy_sweep.run(dist)
    assert code == 1
    assert {"check": "missing_required_file", "path": "favicon.ico", "detail": "required deploy file missing"} in manifest["findings"]
