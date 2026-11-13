from __future__ import annotations

import sys

import pytest

from tools import layout

IDS = ["a", "b", "c", "d", "iso"]
EDGES = [("a", "b"), ("b", "c"), ("c", "a"), ("c", "d")]


def test_missing_networkx_gives_clear_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(sys.modules, "networkx", None)  # import wirft ImportError
    with pytest.raises(RuntimeError, match="networkx"):
        layout.compute_positions(IDS, EDGES)


def test_positions_complete_deterministic_and_bounded() -> None:
    pytest.importorskip("networkx")
    first = layout.compute_positions(IDS, EDGES, seed=7, scale=100.0)
    second = layout.compute_positions(IDS, EDGES, seed=7, scale=100.0)
    assert set(first) == set(IDS)           # auch der isolierte Knoten
    assert first == second                  # gleicher Seed, gleiche Zahlen
    for x, y, z in first.values():
        assert max(abs(x), abs(y), abs(z)) <= 100.0 + 0.01


def test_different_seed_changes_positions() -> None:
    pytest.importorskip("networkx")
    assert layout.compute_positions(IDS, EDGES, seed=1) != layout.compute_positions(IDS, EDGES, seed=2)


def test_self_loops_and_unknown_edge_endpoints_are_ignored() -> None:
    pytest.importorskip("networkx")
    pos = layout.compute_positions(["a", "b"], [("a", "a"), ("a", "zzz"), ("a", "b")])
    assert set(pos) == {"a", "b"}


def test_build_adds_xyz_only_when_enabled(tmp_path) -> None:
    pytest.importorskip("networkx")
    import json
    from tools import build

    vault = tmp_path / "vault"
    for name, body in {
        "a": "# A\n\nText zu [[wiki/concepts/b]].\n",
        "b": "# B\n\nText zu [[wiki/concepts/a]].\n",
    }.items():
        p = vault / "wiki" / "concepts" / f"{name}.md"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")
    cfg = {
        "vault_root": str(vault),
        "include": ["wiki/concepts/a.md", "wiki/concepts/b.md"],
        "default_center": "wiki/concepts/a",
        "metadata": {"title": "T", "description": "D"},
    }
    build.run(cfg, tmp_path / "off")
    off = json.loads((tmp_path / "off" / "assets" / "graph.json").read_text(encoding="utf-8"))
    assert all("x" not in n for n in off["nodes"])

    build.run({**cfg, "precompute_layout": {"seed": 7, "scale": 120.0, "iterations": 100}}, tmp_path / "on")
    on = json.loads((tmp_path / "on" / "assets" / "graph.json").read_text(encoding="utf-8"))
    assert all({"x", "y", "z"} <= set(n) for n in on["nodes"])


def _spread(positions: dict[str, tuple[float, float, float]], ids: list[str]) -> float:
    """Mittlere Standardabweichung der Koordinaten über die drei Achsen."""
    import statistics

    return sum(statistics.pstdev(positions[i][axis] for i in ids) for axis in range(3)) / 3


def test_isolated_node_does_not_compress_the_connected_graph() -> None:
    # Live-Befund 2026-11-13 (wiki.dynamic-dome.com): Ein Kompetenz-Knoten ohne
    # Kante wurde von spring_layout weit nach außen geschoben; das Rescaling auf
    # `scale` drückte die übrigen 269 Knoten in die Mitte (Streuung 25/46/21
    # statt rund 250/219/237), die Nebula sah aus wie ein Knäuel.
    pytest.importorskip("networkx")
    core = [f"n{i}" for i in range(40)]
    edges = [(core[i], core[(i + 1) % 40]) for i in range(40)]
    edges += [(core[i], core[(i + 7) % 40]) for i in range(40)]
    without = layout.compute_positions(core, edges, seed=7, scale=600.0)
    with_iso = layout.compute_positions(core + ["iso"], edges, seed=7, scale=600.0)
    assert _spread(with_iso, core) >= 0.8 * _spread(without, core)
    x, y, z = with_iso["iso"]
    assert max(abs(x), abs(y), abs(z)) <= 600.0 + 0.01


def test_graph_without_edges_still_gets_bounded_positions() -> None:
    pytest.importorskip("networkx")
    ids = ["a", "b", "c"]
    pos = layout.compute_positions(ids, [], seed=7, scale=50.0)
    assert set(pos) == set(ids)
    for x, y, z in pos.values():
        assert max(abs(x), abs(y), abs(z)) <= 50.0 + 0.01
