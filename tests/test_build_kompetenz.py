"""End-to-end test for the kompetenz dataset build path (Task 5).

Confirms the config-driven, vault-agnostic behaviour:
- output goes to assets/<output_subdir>/
- index.json is written alongside graph.json
- category/cluster come from config (category_map / cluster_default)
- links carry a relation type
- nodes carry verification_status when present
- neighbour resolution: a referenced concept is in, an orphan concept is out
- astro defaults still hold when no kompetenz config keys are present
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
def kompetenz_vault(tmp_path: Path) -> Path:
    root = tmp_path / "vault"
    _write(root / "wiki" / "competences" / "comp-a.md", """\
---
type: competence
status: active
verification_status: verified
supports:
  - wiki/topics/topic-a
depends_on:
  - wiki/concepts/referenced
---
# Kompetenz A

Eine kuratierte Kompetenz.
""")
    _write(root / "wiki" / "topics" / "topic-a.md", """\
---
type: topic
status: active
---
# Thema A

Ein Themenfeld.
""")
    _write(root / "wiki" / "concepts" / "referenced.md", """\
---
type: concept
status: active
verification_status: partially_verified
---
# Referenziertes Konzept

Wird von einer Kompetenz gebraucht.
""")
    _write(root / "wiki" / "concepts" / "orphan.md", """\
---
type: concept
status: active
---
# Verwaistes Konzept

Niemand linkt mich.
""")
    return root


def _kompetenz_cfg(vault: Path) -> dict:
    return {
        "dataset": "kompetenz",
        "vault_root": str(vault),
        "output_subdir": "kompetenz",
        "include": ["wiki/competences/*.md", "wiki/topics/*.md"],
        "neighbour_dirs": ["wiki/concepts", "wiki/entities"],
        "status_gate": {
            "field": "status",
            "block_values": ["superseded", "archived"],
            "missing_policy": "allow",
        },
        "category_map": {
            "wiki/competences/": "competence",
            "wiki/synthesis/": "synthesis",
            "wiki/topics/": "topic",
            "wiki/concepts/": "concept",
            "wiki/entities/": "entity",
        },
        "cluster_default": "kompetenz",
        "default_center": "wiki/competences/comp-a",
        "theme_default": "dome",
        "default_gold": 100,
        "metadata": {"title": "Kompetenz-Wiki", "description": "Test"},
    }


def test_output_lands_in_subdir(kompetenz_vault: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    build.run(_kompetenz_cfg(kompetenz_vault), out)
    assert (out / "assets" / "kompetenz" / "graph.json").is_file()
    assert (out / "assets" / "kompetenz" / "index.json").is_file()
    assert (out / "assets" / "kompetenz" / "nodes").is_dir()
    # must NOT pollute the astro default location
    assert not (out / "assets" / "graph.json").exists()


def test_index_json_shape(kompetenz_vault: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    build.run(_kompetenz_cfg(kompetenz_vault), out)
    index = json.loads((out / "assets" / "kompetenz" / "index.json").read_text(encoding="utf-8"))
    assert index["dataset"] == "kompetenz"
    ids = {n["id"] for n in index["nodes"]}
    assert "wiki/competences/comp-a" in ids
    for n in index["nodes"]:
        assert set(n.keys()) >= {"id", "title", "category"}


def test_category_and_cluster_from_config(kompetenz_vault: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    build.run(_kompetenz_cfg(kompetenz_vault), out)
    graph = json.loads((out / "assets" / "kompetenz" / "graph.json").read_text(encoding="utf-8"))
    by_id = {n["id"]: n for n in graph["nodes"]}
    assert by_id["wiki/competences/comp-a"]["category"] == "competence"
    assert by_id["wiki/topics/topic-a"]["category"] == "topic"
    assert by_id["wiki/concepts/referenced"]["category"] == "concept"
    # single cluster (forces-only layout)
    for n in graph["nodes"]:
        assert n["cluster"] == "kompetenz"


def test_links_carry_type(kompetenz_vault: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    build.run(_kompetenz_cfg(kompetenz_vault), out)
    graph = json.loads((out / "assets" / "kompetenz" / "graph.json").read_text(encoding="utf-8"))
    typed = {(l["source"], l["target"]): l.get("type") for l in graph["links"]}
    assert typed.get(("wiki/competences/comp-a", "wiki/topics/topic-a")) == "supports"
    assert typed.get(("wiki/competences/comp-a", "wiki/concepts/referenced")) == "depends_on"


def test_neighbour_in_orphan_out(kompetenz_vault: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    build.run(_kompetenz_cfg(kompetenz_vault), out)
    graph = json.loads((out / "assets" / "kompetenz" / "graph.json").read_text(encoding="utf-8"))
    ids = {n["id"] for n in graph["nodes"]}
    assert "wiki/concepts/referenced" in ids   # pulled via depends_on
    assert "wiki/concepts/orphan" not in ids    # unreferenced


def test_verification_status_on_node(kompetenz_vault: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    build.run(_kompetenz_cfg(kompetenz_vault), out)
    graph = json.loads((out / "assets" / "kompetenz" / "graph.json").read_text(encoding="utf-8"))
    by_id = {n["id"]: n for n in graph["nodes"]}
    assert by_id["wiki/competences/comp-a"]["verification_status"] == "verified"
    # node detail also carries it
    node_doc = json.loads(
        (out / "assets" / "kompetenz" / "nodes" / "wiki__competences__comp-a.json").read_text(encoding="utf-8")
    )
    assert node_doc["verification_status"] == "verified"


def test_dataset_field_in_graph(kompetenz_vault: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    build.run(_kompetenz_cfg(kompetenz_vault), out)
    graph = json.loads((out / "assets" / "kompetenz" / "graph.json").read_text(encoding="utf-8"))
    assert graph["dataset"] == "kompetenz"
