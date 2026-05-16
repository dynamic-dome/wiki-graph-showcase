"""End-to-end test for tools/build.py against a mini-vault.

Confirms:
- graph.json has the expected shape (version, default_center, nodes, links)
- Edges to pages outside the slice are dropped
- One nodes/<slug>.json per node
- private pages do not appear in any output
- Output is deterministic (same vault + config -> byte-identical files)
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools import build


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


@pytest.fixture
def mini_vault_plus_outside_link(tmp_path: Path) -> Path:
    root = tmp_path / "vault"
    _write(root / "wiki" / "concepts" / "art.md", """\
# Allgemeine Relativitaetstheorie

Einsteins Theorie der Gravitation.

Linkt zu [[wiki/concepts/sl]] und zu [[wiki/concepts/outside]].
""")
    _write(root / "wiki" / "concepts" / "sl.md", """\
# Schwarzes Loch

Region in der Raumzeit.

Loesung der [[wiki/concepts/sm]].
""")
    _write(root / "wiki" / "concepts" / "sm.md", """\
# Schwarzschild-Metrik

Erste exakte Loesung.
""")
    # This page exists in the vault but is NOT in the slice
    _write(root / "wiki" / "concepts" / "outside.md", """\
# Outside Page

This must not appear in the output.
""")
    # private
    _write(root / "wiki" / "concepts" / "private.md", """\
---
private: true
---
# Private
""")
    return root


def _make_config(vault: Path, out: Path) -> dict:
    return {
        "vault_root": str(vault),
        "include": [
            "wiki/concepts/art.md",
            "wiki/concepts/sl.md",
            "wiki/concepts/sm.md",
        ],
        "default_center": "wiki/concepts/art",
        "theme_default": "crab",
        "default_gold": 35,
        "metadata": {
            "title": "Test Showcase",
            "description": "Test",
        },
    }


def test_build_emits_graph_json(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    build.run(cfg, out)
    graph_path = out / "assets" / "graph.json"
    assert graph_path.is_file()
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    assert graph["version"] == 1
    assert graph["default_center"] == "wiki/concepts/art"
    node_ids = {n["id"] for n in graph["nodes"]}
    assert node_ids == {"wiki/concepts/art", "wiki/concepts/sl", "wiki/concepts/sm"}


def test_build_drops_edges_outside_slice(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    build.run(cfg, out)
    graph = json.loads((out / "assets" / "graph.json").read_text(encoding="utf-8"))
    # The (art -> outside) edge must be dropped
    pairs = {(l["source"], l["target"]) for l in graph["links"]}
    assert ("wiki/concepts/art", "wiki/concepts/outside") not in pairs
    # but inner-slice edges remain
    assert ("wiki/concepts/art", "wiki/concepts/sl") in pairs
    assert ("wiki/concepts/sl", "wiki/concepts/sm") in pairs


def test_build_emits_per_node_json(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    build.run(cfg, out)
    nodes_dir = out / "assets" / "nodes"
    files = sorted(p.name for p in nodes_dir.iterdir())
    assert files == [
        "wiki__concepts__art.json",
        "wiki__concepts__sl.json",
        "wiki__concepts__sm.json",
    ]
    art = json.loads((nodes_dir / "wiki__concepts__art.json").read_text(encoding="utf-8"))
    assert art["id"] == "wiki/concepts/art"
    assert art["title"] == "Allgemeine Relativitaetstheorie"
    assert "Einsteins" in art["essence"]
    # neighbours are only IN-slice
    assert set(art["neighbours"]) == {"wiki/concepts/sl"}


def test_build_does_not_include_private_pages(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    # Add private to include — must still be dropped
    cfg["include"].append("wiki/concepts/private.md")
    build.run(cfg, out)
    graph = json.loads((out / "assets" / "graph.json").read_text(encoding="utf-8"))
    node_ids = {n["id"] for n in graph["nodes"]}
    assert "wiki/concepts/private" not in node_ids
    nodes_dir = out / "assets" / "nodes"
    assert not (nodes_dir / "wiki__concepts__private.json").exists()


def test_build_copies_frontend_assets(mini_vault_plus_outside_link: Path, tmp_path: Path, monkeypatch) -> None:
    """build copies src/index.html + src/styles/* + src/scripts/* + src/vendor/* into dist/."""
    # Create a minimal frontend tree the build script can copy from
    src_root = tmp_path / "src"
    (src_root / "styles").mkdir(parents=True)
    (src_root / "scripts").mkdir(parents=True)
    (src_root / "vendor").mkdir(parents=True)
    (src_root / "index.html").write_text("<!doctype html><h1>hi</h1>", encoding="utf-8")
    (src_root / "styles" / "base.css").write_text("body{}", encoding="utf-8")
    (src_root / "scripts" / "main.js").write_text("// main", encoding="utf-8")
    (src_root / "vendor" / "3d-force-graph.min.js").write_text("// vendor", encoding="utf-8")

    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    cfg["src_root"] = str(src_root)

    build.run(cfg, out)

    assert (out / "index.html").is_file()
    assert (out / "assets" / "styles" / "base.css").is_file()
    assert (out / "assets" / "scripts" / "main.js").is_file()
    assert (out / "assets" / "vendor" / "3d-force-graph.min.js").is_file()


def test_build_is_deterministic(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out1 = tmp_path / "dist1"
    out2 = tmp_path / "dist2"
    cfg = _make_config(mini_vault_plus_outside_link, out1)
    build.run(cfg, out1)
    cfg2 = _make_config(mini_vault_plus_outside_link, out2)
    build.run(cfg2, out2)
    # graph.json byte-identical except for built_at timestamp — strip that
    g1 = json.loads((out1 / "assets" / "graph.json").read_text(encoding="utf-8"))
    g2 = json.loads((out2 / "assets" / "graph.json").read_text(encoding="utf-8"))
    g1.pop("built_at", None)
    g2.pop("built_at", None)
    assert g1 == g2
    # per-node files byte-identical
    for p1 in (out1 / "assets" / "nodes").iterdir():
        p2 = out2 / "assets" / "nodes" / p1.name
        assert p1.read_bytes() == p2.read_bytes()
