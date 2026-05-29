"""Pre-Deploy-Public-Safety- und Inventar-Sweep fuer generiertes dist/.

Nutzung:
    python tools/pre_deploy_sweep.py --dist dist --write-manifest
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


REQUIRED_FILES = (
    "index.html",
    "_headers",
    "assets/graph.json",
)

GENERATED_MANIFEST = "assets/build-manifest.json"

RAW_PATTERNS = (
    ("internal_path", re.compile(r"(?:(?<![A-Za-z])[A-Za-z]:[\\/]|/Users/|\\Users\\)")),
    ("private_marker", re.compile(r"\bprivate\s*:\s*true\b", re.IGNORECASE)),
    # Secret detection targets credential KEYS/ASSIGNMENTS, not the bare word
    # "token" — in an AI vault "Token-Budget" / "Pay-per-Token" is vocabulary,
    # not a leak. api(_/-)key / private(_/-)key (also no-separator apikey) are
    # always markers; secret/token/password only count when assigned
    # (key: value / key=value). Plus bearer tokens and the 'sk-' key prefix.
    ("secret_marker", re.compile(
        r"\bapi[_-]?key\b"
        r"|\bprivate[_-]?key\b"
        r"|\b(?:secret|token|password|passwd)\s*[:=]\s*\S"
        r"|\bbearer\s+[A-Za-z0-9._-]{8,}\b"
        r"|\bsk-[A-Za-z0-9]{4,}\b",
        re.IGNORECASE,
    )),
)

LINE_PATTERNS = (
    ("markdown_blockquote_meta", re.compile(r"^\s*>")),
    ("markdown_heading_meta", re.compile(r"^\s*##\s+")),
    ("status_marker", re.compile(r"^\s*status\s*:", re.IGNORECASE)),
)


@dataclass(frozen=True)
class Finding:
    check: str
    path: str
    detail: str


def _rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _iter_strings(value: object) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _iter_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _iter_strings(item)


def _scan_text(path: Path, root: Path, findings: list[Finding]) -> None:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return
    rel = _rel(path, root)
    for name, pattern in RAW_PATTERNS:
        if pattern.search(text):
            findings.append(Finding(name, rel, "raw text pattern matched"))


def _scan_json_strings(path: Path, root: Path, findings: list[Finding]) -> object | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        findings.append(Finding("invalid_json", _rel(path, root), str(exc)))
        return None

    rel = _rel(path, root)
    for value in _iter_strings(data):
        for line in value.splitlines():
            for name, pattern in LINE_PATTERNS:
                if pattern.search(line):
                    findings.append(Finding(name, rel, line[:120]))
    return data


def _graph_stats(graph: dict) -> dict:
    nodes = graph.get("nodes", [])
    links = graph.get("links", [])
    by_id = {node.get("id"): node for node in nodes if isinstance(node, dict)}
    bridge_count = 0
    for link in links:
        if not isinstance(link, dict):
            continue
        source = by_id.get(link.get("source"))
        target = by_id.get(link.get("target"))
        if source and target and source.get("cluster") != target.get("cluster"):
            bridge_count += 1
    clusters: dict[str, int] = {}
    for node in nodes:
        cluster = str(node.get("cluster", "unknown"))
        clusters[cluster] = clusters.get(cluster, 0) + 1
    return {
        "nodes": len(nodes),
        "links": len(links),
        "cross_cluster_bridges": bridge_count,
        "clusters": clusters,
        "built_at": graph.get("built_at"),
    }


def run(dist: Path, write_manifest: bool = False) -> tuple[int, dict]:
    dist = dist.resolve()
    findings: list[Finding] = []

    if not dist.is_dir():
        findings.append(Finding("missing_dist", dist.as_posix(), "dist directory does not exist"))
        return 1, {"status": "fail", "findings": [asdict(f) for f in findings]}

    for rel in REQUIRED_FILES:
        if not (dist / rel).is_file():
            findings.append(Finding("missing_required_file", rel, "required deploy file missing"))

    scan_files = []
    for p in dist.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in {".html", ".json", ".txt", ""}:
            continue
        if _rel(p, dist) == GENERATED_MANIFEST:
            continue
        scan_files.append(p)
    for path in scan_files:
        _scan_text(path, dist, findings)

    # Deep JSON line-scan for markdown-meta leaks: the astro graph.json + nodes,
    # plus every dataset subdir (assets/<dataset>/graph.json + nodes/*.json).
    graph_path = dist / "assets" / "graph.json"
    graph = _scan_json_strings(graph_path, dist, findings) if graph_path.is_file() else None
    for graph_json in sorted((dist / "assets").glob("*/graph.json")):
        _scan_json_strings(graph_json, dist, findings)
    for node_path in sorted((dist / "assets").rglob("nodes/*.json")):
        _scan_json_strings(node_path, dist, findings)

    stats = _graph_stats(graph) if isinstance(graph, dict) else {}
    manifest = {
        "status": "fail" if findings else "pass",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "dist": dist.name,
        "stats": stats,
        "findings": [asdict(f) for f in findings],
    }

    if write_manifest:
        manifest_path = dist / "assets" / "build-manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    return (1 if findings else 0), manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, default=Path("dist"))
    parser.add_argument("--write-manifest", action="store_true")
    args = parser.parse_args()

    code, manifest = run(args.dist, args.write_manifest)
    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
