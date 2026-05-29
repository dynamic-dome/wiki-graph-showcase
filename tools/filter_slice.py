"""Resolve which markdown files end up in the showcase slice.

Apply include globs, then drop pages that fail public-safety checks
(private:true) or that have no extractable title (no h1 + no frontmatter title).

Optional status gate (kompetenz dataset): drop pages whose frontmatter
`status` is in a configured block-list; missing status is lenient (kept,
with a warning) by default. The astro slice passes no gate -> no filtering.

Neighbour resolution (kompetenz dataset): resolve_slice_with_neighbours
returns the core slice PLUS any page in neighbour_dirs that a core page
references (frontmatter edges + body wikilinks).

Public API:
  resolve_slice(vault_root, include, status_gate=None) -> list[Path], sorted.
  resolve_slice_with_neighbours(vault_root, include, neighbour_dirs,
      status_gate=None) -> list[Path], sorted.
"""
from __future__ import annotations

import sys
from glob import glob
from pathlib import Path

from tools import extract_page_meta, parser


def _expand_globs(vault_root: Path, include: list[str]) -> list[Path]:
    found: list[Path] = []
    missing: list[str] = []
    for pat in include:
        full = str(vault_root / pat)
        matches = [Path(p) for p in glob(full, recursive=True)]
        if not matches and "*" not in pat and "?" not in pat:
            missing.append(pat)
        found.extend(matches)
    for pat in missing:
        print(f"warning: include pattern matched no files: {pat}", file=sys.stderr)
    return found


def _is_valid_page(path: Path) -> bool:
    """Reject pages that extract_page_meta cannot validate."""
    return extract_page_meta.extract(path) is not None


def _passes_status_gate(path: Path, status_gate: dict | None) -> bool:
    """True if the page may be published under the status gate.

    No gate -> always True (astro slice). With a gate: a status in the
    block-list fails; a missing status is governed by missing_policy
    ('allow' = keep + warn, 'block' = drop).
    """
    if not status_gate:
        return True
    field = status_gate.get("field", "status")
    block = {str(v).lower() for v in status_gate.get("block_values", [])}
    missing_policy = status_gate.get("missing_policy", "allow")

    fm = extract_page_meta.read_frontmatter(path)
    value = (fm or {}).get(field)
    if value is None or str(value).strip() == "":
        if missing_policy == "block":
            return False
        print(f"warning: no '{field}' field, including anyway: {path.as_posix()}",
              file=sys.stderr)
        return True
    return str(value).strip().lower() not in block


def resolve_slice(
    vault_root: Path,
    include: list[str],
    status_gate: dict | None = None,
) -> list[Path]:
    """Return sorted list of valid page Paths for the slice."""
    expanded = _expand_globs(Path(vault_root), include)
    # dedupe and filter
    unique = sorted({p.resolve() for p in expanded if p.is_file()})
    valid = [
        p for p in unique
        if _is_valid_page(p) and _passes_status_gate(p, status_gate)
    ]
    return valid


def _path_id_of(path: Path, vault_root: Path) -> str:
    rel = path.relative_to(vault_root).with_suffix("")
    return parser.normalize(rel.as_posix())


def _id_to_path(node_id: str, vault_root: Path) -> Path:
    """Inverse of _path_id_of for ids that map to a real .md file."""
    return (Path(vault_root) / node_id).with_suffix(".md")


def resolve_slice_with_neighbours(
    vault_root: Path,
    include: list[str],
    neighbour_dirs: list[str],
    status_gate: dict | None = None,
) -> list[Path]:
    """Core slice (from `include`) PLUS referenced pages in neighbour_dirs.

    A neighbour is added iff (a) a core page references it (frontmatter edges
    or body wikilinks), (b) its id starts with one of neighbour_dirs, (c) the
    file exists, is a valid page, and passes the status gate.
    """
    vault = Path(vault_root)
    core = resolve_slice(vault, include, status_gate=status_gate)
    core_ids = {_path_id_of(p, vault) for p in core}

    # All edges in the vault; keep only those originating from a core page.
    all_edges = parser.extract_edges(vault) + parser.extract_frontmatter_edges(vault)
    referenced: set[str] = {
        tgt for src, tgt in all_edges if src in core_ids and tgt not in core_ids
    }

    norm_dirs = [d.strip("/").lower() for d in neighbour_dirs]
    extra: list[Path] = []
    seen = {p.resolve() for p in core}
    for tgt in sorted(referenced):
        if not any(tgt.startswith(f"{d}/") for d in norm_dirs):
            continue
        candidate = _id_to_path(tgt, vault).resolve()
        if not candidate.is_file() or candidate in seen:
            continue
        if not _is_valid_page(candidate):
            continue
        if not _passes_status_gate(candidate, status_gate):
            continue
        extra.append(candidate)
        seen.add(candidate)

    return sorted(set(core) | set(extra))
