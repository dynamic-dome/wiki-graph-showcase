"""Build-Zeit-Layout (WP C1b, optional): 3D-Positionen vorrechnen.

networkx ist KEIN Teil des stdlib-only Standard-Builds. Dieses Modul wird nur
importiert, wenn die Config den Schalter `precompute_layout` setzt. Ohne
networkx bricht der Build dann mit einer klaren Meldung ab.
"""
from __future__ import annotations


def compute_positions(
    node_ids: list[str],
    edges: list[tuple[str, str]],
    *,
    seed: int = 7,
    scale: float = 150.0,
    iterations: int = 200,
) -> dict[str, tuple[float, float, float]]:
    try:
        import networkx as nx
    except ImportError as exc:  # noqa: PERF203
        raise RuntimeError(
            "precompute_layout braucht networkx (Build-Zeit-Zusatz, nicht Teil des stdlib-Builds)."
        ) from exc

    known = set(node_ids)
    graph = nx.Graph()
    graph.add_nodes_from(sorted(known))
    graph.add_edges_from(sorted((s, t) for s, t in edges if s != t and s in known and t in known))
    pos = nx.spring_layout(
        graph, dim=3, seed=seed, iterations=iterations, scale=scale, center=(0.0, 0.0, 0.0)
    )
    return {
        nid: (round(float(x), 2), round(float(y), 2), round(float(z), 2))
        for nid, (x, y, z) in pos.items()
    }
