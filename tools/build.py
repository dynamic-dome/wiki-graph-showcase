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
    """Build the dist tree from cfg into `out`."""
    out = Path(out)
    vault = Path(cfg["vault_root"]).resolve()

    pages = filter_slice.resolve_slice(vault, cfg["include"])
    in_slice_ids = {_path_id_of(p, vault) for p in pages}

    # Parse all edges in the vault, then filter to slice-internal
    all_edges = parser.extract_edges(vault) + parser.extract_frontmatter_edges(vault)
    slice_edges_set: set[tuple[str, str]] = set()
    for src, tgt in all_edges:
        if src in in_slice_ids and tgt in in_slice_ids and src != tgt:
            slice_edges_set.add((src, tgt))
    slice_edges = sorted(slice_edges_set)

    # Build neighbour map (needed for weight calculation)
    neighbours: dict[str, set[str]] = {nid: set() for nid in in_slice_ids}
    for src, tgt in slice_edges:
        neighbours[src].add(tgt)
        neighbours[tgt].add(src)

    # Weight normalisation: 0..1 by degree (0 = isolated leaf, 1 = top hub)
    degrees = {nid: len(nb) for nid, nb in neighbours.items()}
    max_degree = max(degrees.values()) if degrees else 1
    if max_degree == 0:
        max_degree = 1

    # Build node list with metadata
    nodes: list[dict] = []
    metas: dict[str, extract_page_meta.PageMeta] = {}
    for p in pages:
        meta = extract_page_meta.extract(p)
        if meta is None:
            continue  # belt+braces; filter_slice should have dropped these
        node_id = _path_id_of(p, vault)
        metas[node_id] = meta
        kind = _kind_from_path(node_id)
        nodes.append({
            "id": node_id,
            "title": meta.title,
            "category": _category_from_path(node_id),
            "kind": kind,
            "cluster": _cluster_from_kind_and_id(kind, node_id),
            "weight": round(degrees.get(node_id, 0) / max_degree, 3),
        })
    nodes.sort(key=lambda n: n["id"])

    graph = {
        "version": 1,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "default_center": cfg["default_center"],
        "theme_default": cfg.get("theme_default", "crab"),
        "default_gold": cfg.get("default_gold", 35),
        "metadata": cfg.get("metadata", {}),
        "nodes": nodes,
        "links": [{"source": s, "target": t} for s, t in slice_edges],
    }

    # Write outputs
    assets = out / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    nodes_dir = assets / "nodes"
    nodes_dir.mkdir(exist_ok=True)

    (assets / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
    )

    for node_id, meta in metas.items():
        node_doc = {
            "id": node_id,
            "title": meta.title,
            "subtitle": meta.subtitle,
            "essence": meta.essence,
            "category": _category_from_path(node_id),
            "neighbours": sorted(neighbours.get(node_id, set())),
        }
        (nodes_dir / f"{_slug(node_id)}.json").write_text(
            json.dumps(node_doc, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )

    # Copy frontend assets if src_root is configured
    src_root = cfg.get("src_root")
    if src_root:
        _copy_frontend_assets(Path(src_root), out)


def _copy_frontend_assets(src: Path, out: Path) -> None:
    """Copy src/index.html, src/_headers, src/styles/, src/scripts/, src/vendor/ to dist/."""
    import shutil
    # index.html and _headers go to dist/ root
    for root_file in ("index.html", "_headers"):
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
    if node_id.startswith("wiki/concepts/"):
        return "concept"
    if node_id.startswith("wiki/entities/"):
        return "entity"
    if node_id.startswith("wiki/synthesis/"):
        return "synthesis"
    return "other"


def _kind_from_path(node_id: str) -> str:
    """Finer classification used for visual shape selection in the frontend."""
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
    """High-level cluster used for layered 3D positioning."""
    if kind == "concept-gantefoer":
        return "gantefoer"
    if node_id == "wiki/entities/harald-gantefoer":
        return "gantefoer"
    return "astrophysik"


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
