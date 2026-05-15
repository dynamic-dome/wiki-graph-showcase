"""Resolve which markdown files end up in the showcase slice.

Apply include globs, then drop pages that fail public-safety checks
(private:true) or that have no extractable title (no h1 + no frontmatter title).

Public API: resolve_slice(vault_root, include) -> list[Path], sorted.
"""
from __future__ import annotations

import sys
from glob import glob
from pathlib import Path

from tools import extract_page_meta


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


def resolve_slice(vault_root: Path, include: list[str]) -> list[Path]:
    """Return sorted list of valid page Paths for the slice."""
    expanded = _expand_globs(Path(vault_root), include)
    # dedupe and filter
    unique = sorted({p.resolve() for p in expanded if p.is_file()})
    valid = [p for p in unique if _is_valid_page(p)]
    return valid
