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


# Favicon-Satz der Hauptdomain (#10034). Ohne echte Dateien liefert Cloudflare Pages /favicon.ico
# als index.html mit 200 text/html. Quelle der Liste: tools/build.py (FAVICON_FILES).
FAVICON_FILES = ("favicon.ico", "favicon-32.png", "favicon-180.png", "favicon-192.png")

REQUIRED_FILES = (
    "index.html",
    # Ohne 404.html liefert Cloudflare Pages jede unbekannte URL als index.html mit 200 (Soft-404, #9917 K1).
    "404.html",
    "_headers",
    "assets/graph.json",
    *FAVICON_FILES,
)

GENERATED_MANIFEST = "assets/build-manifest.json"

RAW_PATTERNS = (
    ("internal_path", re.compile(r"(?:(?<![A-Za-z])[A-Za-z]:[\\/]|/Users/|\\Users\\)")),
    ("private_marker", re.compile(r"\bprivate\s*:\s*true\b", re.IGNORECASE)),
    # Pipeline-Jargon aus dem Vault-Betrieb (#10033): Rechercherunden ("Welle 7", "Welle-7-Quellen"),
    # Loop-Namen ("Loop B", "Loop-B-Cluster"), "Vault-Gap" und Cluster-Ids im Fliesstext
    # ("Cluster `ai-regulation-privacy-2026`") gehoeren in die Quelle des Vaults, nicht auf die oeffentliche Seite.
    # Die Quelle wird geaendert (kompetenz-wiki), nie der Build.
    ("pipeline_jargon", re.compile(
        r"\bWelle[ -]\d+"
        r"|\bLoop[ -][A-Z]\b"
        r"|\b[Vv]ault-[Gg]ap\b"
        r"|\b[Cc]luster\s+`[a-z0-9-]+`"
    )),
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

# ASCII-Umschreibung statt echter Umlaute (#10082, Folge von kompetenz-wiki 5f7600c / #10056).
# Gilt nur fuer den Kompetenz-Datensatz und nur fuer die sichtbaren Textfelder; ids, Slugs und
# neighbours sind Bezeichner und bleiben ASCII. Der Physik-Datensatz (assets/nodes) hat noch
# ASCII-Leads und ist bewusst ausgenommen.
ASCII_UMLAUT_NODE_GLOB = "kompetenz/nodes/*.json"
ASCII_UMLAUT_FIELDS = ("title", "subtitle", "essence")

# Digraph ae/oe/ue (kleines e, Anfangsbuchstabe beliebig gross) ausserhalb legitimer Folgen:
# nach Vokal (neue, Steuer, bauen, Frauen, Feuer) und nach q (Quelle, Query, Queue) ist er normal.
# Grossbuchstaben-e (UAE, VAE, MoE, QuEra) gilt nicht als Umschreibung.
_UMLAUT_DIGRAPH = re.compile(r"(?<![aeiouqAEIOUQ])[AaOoUu]e")
_WORD = re.compile(r"[^\W\d_]+")
_CODE_SPAN_OR_URL = re.compile(r"`[^`]*`|https?://\S+")

# Woerter, die den Digraphen legitim tragen. Teilstring-Treffer auf dem kleingeschriebenen Wort
# (Quelle, neue, Query, Crusoe, Phoenix, UAE, MoE usw. wie in kompetenz-wiki 5f7600c).
ASCII_UMLAUT_ALLOWED_STEMS = (
    # -uell und Verwandte
    "aktuell", "manuell", "visuell", "virtuell", "punktuell", "individuell", "eventuell",
    "intellektuell", "kontextuell", "sexuell", "duell", "fuel",
    # Fremd- und Eigennamen, englische Fachwoerter
    "issue", "value", "revenue", "influencer", "crusoe", "phoenix", "quera", "venue", "rescue",
    "michael", "raphael", "israel", "samuel", "manuel", "joel", "noel", "goethe", "poet", "poes",
    "aero", "aloe", "zoe", "shoe",
)

# ss statt ß: nur eindeutige Staemme, weil "ss" in Wörtern wie "muss", "dass", "Prozess" korrekt ist.
_SZ_STEMS = re.compile(
    r"schliess|gross|heiss|strasse|spass|fliess|massnahm|ausser|bloss|stoss",
    re.IGNORECASE,
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


def find_ascii_umlauts(text: str) -> list[str]:
    """Woerter mit ASCII-Umschreibung (ae/oe/ue/ss statt ä/ö/ü/ß), in Reihenfolge, ohne Doppelte."""
    found: list[str] = []
    for word in _WORD.findall(_CODE_SPAN_OR_URL.sub(" ", text)):
        lower = word.lower()
        if any(stem in lower for stem in ASCII_UMLAUT_ALLOWED_STEMS):
            continue
        if (_UMLAUT_DIGRAPH.search(word) or _SZ_STEMS.search(word)) and word not in found:
            found.append(word)
    return found


def _scan_ascii_umlauts(path: Path, root: Path, findings: list[Finding]) -> None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return  # invalid_json meldet _scan_json_strings
    if not isinstance(data, dict):
        return
    rel = _rel(path, root)
    for field in ASCII_UMLAUT_FIELDS:
        value = data.get(field)
        if not isinstance(value, str):
            continue
        words = find_ascii_umlauts(value)
        if words:
            findings.append(Finding("ascii_umlaut", rel, f"{field}: {', '.join(words)}"))


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

    not_found = dist / "404.html"
    if not_found.is_file() and not re.search(
        r"<meta[^>]+name=[\"']robots[\"'][^>]*noindex", not_found.read_text(encoding="utf-8"), re.IGNORECASE
    ):
        findings.append(Finding("404_not_noindex", "404.html", "404.html muss <meta name=\"robots\" content=\"noindex\"> tragen"))

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

    for node_path in sorted((dist / "assets").glob(ASCII_UMLAUT_NODE_GLOB)):
        _scan_ascii_umlauts(node_path, dist, findings)

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
