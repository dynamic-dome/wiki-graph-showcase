from __future__ import annotations

import json
from pathlib import Path

from tools import pre_deploy_sweep


def _write(path: Path, body: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def _write_minimal_dist(root: Path) -> None:
    _write(root / "index.html", "<!doctype html><title>Knowledge Nebula</title>")
    _write(root / "404.html", '<!doctype html><meta name="robots" content="noindex"><title>404</title>')
    _write(root / "_headers", "/*\n  X-Frame-Options: DENY\n")
    for icon in pre_deploy_sweep.FAVICON_FILES:
        (root / icon).write_bytes(b"icon")
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


def test_secret_marker_catches_separator_and_bearer_variants(tmp_path: Path) -> None:
    """apikey/apiKey (no separator), bearer tokens, short sk- keys all fail."""
    for i, payload in enumerate([
        {"essence": "apikey is leaked here"},
        {"essence": "header: Bearer abcdef0123456789"},
        {"essence": "key sk-Xy12ab90"},
    ]):
        dist = tmp_path / f"dist{i}"
        _write_minimal_dist(dist)
        _write(dist / "assets" / "nodes" / f"wiki__concepts__v{i}.json", json.dumps(payload))
        code, manifest = pre_deploy_sweep.run(dist)
        assert code == 1, payload
        assert any(f["check"] == "secret_marker" for f in manifest["findings"]), payload


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


def test_pre_deploy_sweep_fails_without_404_html(tmp_path: Path) -> None:
    """Ohne 404.html wuerde Cloudflare Pages jede unbekannte URL mit 200 beantworten (Soft-404, #9917 K1)."""
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    (dist / "404.html").unlink()

    code, manifest = pre_deploy_sweep.run(dist)

    assert code == 1
    assert any(f["check"] == "missing_required_file" and f["path"] == "404.html" for f in manifest["findings"])


def test_pre_deploy_sweep_fails_when_404_html_is_indexable(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(dist / "404.html", "<!doctype html><title>404</title>")

    code, manifest = pre_deploy_sweep.run(dist)

    assert code == 1
    assert any(f["check"] == "404_not_noindex" for f in manifest["findings"])


JARGON_SAMPLES = [
    "Welle 7 zeichnet die Entwicklung nach",
    "These der Welle-8-Quellen: Der Bauboom",
    "Cluster-Welle 2 von 4",
    "ausgehend aus dem Loop-B-Cluster",
    "(Loop B, Welle 13)",
    "Schliesst den groessten 2026-05-11-Vault-Gap",
    "Lage der Energie, Cluster `ai-infrastructure-energy-2026`.",
]

CLEAN_SAMPLES = [
    "Human-in-the-Loop (HITL) und Closed-Loop Cooling",
    "Die Gravitationswelle 5 Sekunden später",
    "wiki/concepts/construction-vs-operations-jobs-gap",
    "Ein Cluster aus 384 Chips, Rechencluster der Hyperscaler",
    "Der Loop läuft weiter, der Gap bleibt offen",
]


def _dist_with_node_text(tmp_path: Path, text: str) -> Path:
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(
        dist / "assets" / "kompetenz" / "nodes" / "wiki__topics__x.json",
        json.dumps({"title": "X", "essence": text}),
    )
    return dist


def test_sweep_flags_pipeline_jargon_in_public_node_text(tmp_path: Path) -> None:
    """#10033: Welle N, Loop B, Vault-Gap und Cluster-Ids gehoeren in die Vault-Quelle, nicht auf die Seite."""
    for sample in JARGON_SAMPLES:
        dist = _dist_with_node_text(tmp_path / str(abs(hash(sample))), sample)

        code, manifest = pre_deploy_sweep.run(dist)

        assert code == 1, sample
        assert any(
            f["check"] == "pipeline_jargon" and f["path"].endswith("wiki__topics__x.json")
            for f in manifest["findings"]
        ), sample


def test_sweep_leaves_legitimate_loop_wave_and_gap_words_alone(tmp_path: Path) -> None:
    for sample in CLEAN_SAMPLES:
        dist = _dist_with_node_text(tmp_path / str(abs(hash(sample))), sample)

        code, manifest = pre_deploy_sweep.run(dist)

        assert code == 0, (sample, manifest["findings"])


def test_sweep_flags_pipeline_jargon_in_html_too(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    _write_minimal_dist(dist)
    _write(dist / "index.html", "<!doctype html><title>Knowledge Nebula</title><p>Welle 3</p>")

    code, manifest = pre_deploy_sweep.run(dist)

    assert code == 1
    assert any(f["check"] == "pipeline_jargon" and f["path"] == "index.html" for f in manifest["findings"])
