"""Build orchestrator: vault slice -> dist/assets/graph.json + nodes/*.json.

Entry point: `python -m tools.build --config showcase.config.json --out dist/`
or `build.run(cfg_dict, out_path)` for tests.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from tools import extract_page_meta, filter_slice, parser


def _slug(node_id: str) -> str:
    return node_id.replace("/", "__")


def _path_id_of(path: Path, vault_root: Path) -> str:
    rel = path.relative_to(vault_root).with_suffix("")
    return parser.normalize(rel.as_posix())


def run(cfg: dict, out: Path) -> None:
    """Build the dist tree from cfg into `out`.

    Astro slice (no neighbour_dirs/category_map) keeps its original behaviour
    and writes to assets/. A dataset with `output_subdir` writes to
    assets/<subdir>/ and pulls referenced neighbours / typed links / config
    classification (kompetenz path).
    """
    out = Path(out)
    vault = Path(cfg["vault_root"]).resolve()

    status_gate = cfg.get("status_gate")
    neighbour_dirs = cfg.get("neighbour_dirs")
    exclude = cfg.get("exclude")

    if neighbour_dirs:
        pages = filter_slice.resolve_slice_with_neighbours(
            vault, cfg["include"], neighbour_dirs,
            status_gate=status_gate, exclude=exclude,
        )
    else:
        pages = filter_slice.resolve_slice(
            vault, cfg["include"], status_gate=status_gate, exclude=exclude
        )
    in_slice_ids = {_path_id_of(p, vault) for p in pages}

    # Typed edges (showcase fork). Astro ignores the type but it is harmless.
    typed_edges = parser.extract_typed_edges(vault)
    slice_edge_type: dict[tuple[str, str], str] = {}
    for src, tgt, rel in typed_edges:
        if src in in_slice_ids and tgt in in_slice_ids and src != tgt:
            # First (sorted) type wins for a given ordered pair; stable.
            slice_edge_type.setdefault((src, tgt), rel)
    slice_edges = sorted(slice_edge_type)

    # Build neighbour map (needed for weight calculation), undirected.
    neighbours: dict[str, set[str]] = {nid: set() for nid in in_slice_ids}
    for src, tgt in slice_edges:
        neighbours[src].add(tgt)
        neighbours[tgt].add(src)

    # Weight normalisation: 0..1 by degree (0 = isolated leaf, 1 = top hub)
    degrees = {nid: len(nb) for nid, nb in neighbours.items()}
    max_degree = max(degrees.values()) if degrees else 1
    if max_degree == 0:
        max_degree = 1

    category_map = cfg.get("category_map")
    cluster_default = cfg.get("cluster_default")

    # Build node list with metadata
    nodes: list[dict] = []
    metas: dict[str, extract_page_meta.PageMeta] = {}
    vstatus: dict[str, str] = {}
    for p in pages:
        meta = extract_page_meta.extract(p)
        if meta is None:
            continue  # belt+braces; filter_slice should have dropped these
        node_id = _path_id_of(p, vault)
        metas[node_id] = meta
        category = _category_of(node_id, category_map)
        kind = _kind_of(node_id, category_map)
        node = {
            "id": node_id,
            "title": meta.title,
            "category": category,
            "kind": kind,
            "cluster": _cluster_of(kind, node_id, cluster_default),
            "weight": round(degrees.get(node_id, 0) / max_degree, 3),
        }
        # Additive: verification_status badge when present in frontmatter.
        fm = extract_page_meta.read_frontmatter(p) or {}
        vs = fm.get("verification_status")
        if vs:
            node["verification_status"] = str(vs)
            vstatus[node_id] = str(vs)
        nodes.append(node)
    nodes.sort(key=lambda n: n["id"])

    graph = {
        "version": 1,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "default_center": cfg["default_center"],
        "theme_default": cfg.get("theme_default", "crab"),
        "default_gold": cfg.get("default_gold", 35),
        "metadata": cfg.get("metadata", {}),
        "nodes": nodes,
        "links": [
            {"source": s, "target": t, "type": slice_edge_type[(s, t)]}
            for s, t in slice_edges
        ],
    }
    if cfg.get("dataset"):
        graph["dataset"] = cfg["dataset"]

    # Output location: assets/ (astro) or assets/<subdir>/ (datasets).
    subdir = cfg.get("output_subdir")
    assets = out / "assets"
    dataset_dir = assets / subdir if subdir else assets
    dataset_dir.mkdir(parents=True, exist_ok=True)
    nodes_dir = dataset_dir / "nodes"
    nodes_dir.mkdir(exist_ok=True)

    (dataset_dir / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
    )

    # Slim search index alongside the graph.
    index = {
        "dataset": cfg.get("dataset"),
        "nodes": [
            {"id": n["id"], "title": n["title"], "category": n["category"]}
            for n in nodes
        ],
    }
    (dataset_dir / "index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
    )

    for node_id, meta in metas.items():
        node_doc = {
            "id": node_id,
            "title": meta.title,
            "subtitle": meta.subtitle,
            "essence": meta.essence,
            "category": _category_of(node_id, category_map),
            "neighbours": sorted(neighbours.get(node_id, set())),
        }
        if node_id in vstatus:
            node_doc["verification_status"] = vstatus[node_id]
        (nodes_dir / f"{_slug(node_id)}.json").write_text(
            json.dumps(node_doc, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )

    # Copy frontend assets if src_root is configured
    src_root = cfg.get("src_root")
    if src_root:
        _copy_frontend_assets(Path(src_root), out)


def _copy_frontend_assets(src: Path, out: Path) -> None:
    """Copy src/index.html, src/_headers, src/robots.txt, src/sitemap.xml, src/styles/, src/scripts/, src/vendor/ to dist/."""
    import shutil
    # root-level files go to dist/ root (real files beat the Pages SPA catch-all)
    for root_file in ("index.html", "_headers", "robots.txt", "sitemap.xml"):
        src_file = src / root_file
        if src_file.is_file():
            shutil.copy2(src_file, out / root_file)
    # styles, scripts, vendor go under dist/assets/
    for sub in ("styles", "scripts", "vendor"):
        src_dir = src / sub
        if src_dir.is_dir():
            dst_dir = out / "assets" / sub
            if dst_dir.exists():
                shutil.rmtree(dst_dir)
            shutil.copytree(src_dir, dst_dir)


def _category_from_path(node_id: str) -> str:
    """Astro default category classification (prefix-based)."""
    if node_id.startswith("wiki/concepts/"):
        return "concept"
    if node_id.startswith("wiki/entities/"):
        return "entity"
    if node_id.startswith("wiki/synthesis/"):
        return "synthesis"
    return "other"


def _kind_from_path(node_id: str) -> str:
    """Astro default fine-grained kind for visual shape selection."""
    if node_id.startswith("wiki/concepts/gantefoer/"):
        return "concept-gantefoer"
    if node_id.startswith("wiki/concepts/"):
        return "concept"
    if node_id.startswith("wiki/entities/"):
        return "entity"
    if node_id.startswith("wiki/synthesis/"):
        return "synthesis"
    return "other"


def _cluster_from_kind_and_id(kind: str, node_id: str) -> str:
    """Astro default cluster (gantefoer vs astrophysik)."""
    if kind == "concept-gantefoer":
        return "gantefoer"
    if node_id == "wiki/entities/harald-gantefoer":
        return "gantefoer"
    return "astrophysik"


def _category_of(node_id: str, category_map: dict | None) -> str:
    """Config-driven category (longest matching prefix), else astro default."""
    if category_map:
        match = _longest_prefix(node_id, category_map)
        if match is not None:
            return match
        return "other"
    return _category_from_path(node_id)


def _kind_of(node_id: str, category_map: dict | None) -> str:
    """With a category_map, kind == category. Else astro default kind."""
    if category_map:
        return _category_of(node_id, category_map)
    return _kind_from_path(node_id)


def _cluster_of(kind: str, node_id: str, cluster_default: str | None) -> str:
    """A configured single cluster (forces-only layout) or astro default."""
    if cluster_default:
        return cluster_default
    return _cluster_from_kind_and_id(kind, node_id)


def _longest_prefix(node_id: str, prefix_map: dict) -> str | None:
    best_key = None
    for key in prefix_map:
        if node_id.startswith(key) and (best_key is None or len(key) > len(best_key)):
            best_key = key
    return prefix_map[best_key] if best_key is not None else None


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    run(cfg, args.out)
    print(f"Build complete -> {args.out}", flush=True)


if __name__ == "__main__":
    _main()
