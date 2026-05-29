from __future__ import annotations

import json
from pathlib import Path

from tools import pre_deploy_sweep


def _write(path: Path, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def _write_minimal_dist(root: Path) -> None:
    _write(root / "index.html", "<!doctype html><title>Knowledge Nebula</title>")
    _write(root / "_headers", "/*\n  X-Frame-Options: DENY\n")
    graph = {
        "built_at": "2026-05-17T00:00:00+00:00",
        "nodes": [
            {"id": "wiki/concepts/a", "cluster": "astrophysik"},
            {"id": "wiki/concepts/gantefoer/b", "cluster": "gantefoer"},
        ],
        "links": [{"source": "wiki/concepts/a", "target": "wiki/concepts/gantefoer/b"}],
    }
    _write(root / "assets" / "graph.json", json.dumps(graph))
    _write(
        root / "assets" / "nodes" / "wiki__concepts__a.json",
        json.dumps({"title": "A", "essence": "Clean public text."}),
    )


def test_pre_deploy_sweep_passes_clean_dist_and_writes_manifest(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)

    code, manifest = pre_deploy_sweep.run(dist, write_manifest=True)

    assert code == 0
    assert manifest["status"] == "pass"
    assert manifest["stats"]["nodes"] == 2
    assert manifest["stats"]["links"] == 1
    assert manifest["stats"]["cross_cluster_bridges"] == 1
    assert (dist / "assets" / "build-manifest.json").is_file()


def test_pre_deploy_sweep_fails_on_internal_path(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(
        dist / "assets" / "nodes" / "wiki__concepts__leak.json",
        json.dumps({"essence": "Source path: C:/Users/domes/wiki/private.md"}),
    )

    code, manifest = pre_deploy_sweep.run(dist)

    assert code == 1
    assert manifest["status"] == "fail"
    assert any(f["check"] == "internal_path" for f in manifest["findings"])


def test_pre_deploy_sweep_allows_https_urls(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(
        dist / "assets" / "nodes" / "wiki__concepts__url.json",
        json.dumps({"essence": "Public URL: https://wiki.dynamic-dome.com/"}),
    )

    code, manifest = pre_deploy_sweep.run(dist)

    assert code == 0
    assert manifest["status"] == "pass"


def test_pre_deploy_sweep_fails_on_markdown_meta_lines_inside_json(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(
        dist / "assets" / "nodes" / "wiki__concepts__meta.json",
        json.dumps({"essence": "> status: seed\n## Definition\nReal text."}),
    )

    code, manifest = pre_deploy_sweep.run(dist)

    assert code == 1
    checks = {f["check"] for f in manifest["findings"]}
    assert "markdown_blockquote_meta" in checks
    assert "markdown_heading_meta" in checks


def test_secret_marker_ignores_token_as_vocabulary(tmp_path: Path) -> None:
    """'Token-Budget' / 'Pay-per-Token' is AI vocabulary, not a leaked secret."""
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(
        dist / "assets" / "kompetenz" / "nodes" / "wiki__concepts__budget.json",
        json.dumps({"essence": "Einer Schleife ein hartes Token-Budget vorgeben. "
                               "Pay-per-Token-Modell statt GPU-Stunden."}),
    )
    code, manifest = pre_deploy_sweep.run(dist)
    assert code == 0, manifest["findings"]
    assert manifest["status"] == "pass"


def test_secret_marker_still_catches_real_secret_assignments(tmp_path: Path) -> None:
    """Actual secret-looking key/value pairs must still fail the sweep."""
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(
        dist / "assets" / "nodes" / "wiki__concepts__leak2.json",
        json.dumps({"essence": "config api_key=sk-abc123 and PASSWORD: hunter2"}),
    )
    code, manifest = pre_deploy_sweep.run(dist)
    assert code == 1
    assert any(f["check"] == "secret_marker" for f in manifest["findings"])


def test_pre_deploy_sweep_scans_dataset_subdir_nodes(tmp_path: Path) -> None:
    """A markdown-meta leak in a kompetenz dataset node must also be caught."""
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(
        dist / "assets" / "kompetenz" / "nodes" / "wiki__competences__x.json",
        json.dumps({"essence": "> status: seed\nReal lead."}),
    )

    code, manifest = pre_deploy_sweep.run(dist)

    assert code == 1
    leaked = [f for f in manifest["findings"]
              if "kompetenz" in f["path"] and f["check"] == "markdown_blockquote_meta"]
    assert leaked
