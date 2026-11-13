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
    edge_list = sorted((s, t) for s, t in edges if s != t and s in known and t in known)
    connected = {n for edge in edge_list for n in edge}
    # Knoten ohne Kante (Grad 0) schiebt spring_layout weit nach außen; das
    # Rescaling auf `scale` drückt dann alle übrigen Knoten in die Mitte
    # (Live-Befund 2026-11-13, die Nebula wurde zum Knäuel). Deshalb rechnet das
    # Layout nur über die verbundenen Knoten, die Einzelknoten kommen danach
    # gleichmäßig auf eine Kugelschale am Rand.
    layout_nodes = sorted(connected) if connected else sorted(known)
    isolated = sorted(known - connected) if connected else []

    graph = nx.Graph()
    graph.add_nodes_from(layout_nodes)
    graph.add_edges_from(edge_list)
    pos = nx.spring_layout(
        graph, dim=3, seed=seed, iterations=iterations, scale=scale, center=(0.0, 0.0, 0.0)
    )
    result = {
        nid: (round(float(x), 2), round(float(y), 2), round(float(z), 2))
        for nid, (x, y, z) in pos.items()
    }
    result.update(_shell_positions(isolated, radius=0.9 * scale))
    return result


def _shell_positions(ids: list[str], *, radius: float) -> dict[str, tuple[float, float, float]]:
    """Gleichmäßig verteilte, deterministische Punkte auf einer Kugel (Fibonacci-Gitter)."""
    import math

    count = len(ids)
    golden = math.pi * (3.0 - math.sqrt(5.0))
    out: dict[str, tuple[float, float, float]] = {}
    for i, nid in enumerate(ids):
        y = 1.0 - 2.0 * (i + 0.5) / count
        r = math.sqrt(max(0.0, 1.0 - y * y))
        theta = golden * i
        out[nid] = (
            round(radius * r * math.cos(theta), 2),
            round(radius * y, 2),
            round(radius * r * math.sin(theta), 2),
        )
    return out
