"""Tests for tools/filter_slice.py."""
from __future__ import annotations

from pathlib import Path

import pytest

from tools import filter_slice


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


def test_glob_matches_listed_files(tmp_path: Path) -> None:
    _write(tmp_path / "wiki" / "concepts" / "a.md", "# A\n")
    _write(tmp_path / "wiki" / "concepts" / "b.md", "# B\n")
    _write(tmp_path / "wiki" / "entities" / "c.md", "# C\n")
    result = filter_slice.resolve_slice(
        tmp_path,
        include=["wiki/concepts/a.md", "wiki/concepts/b.md"],
    )
    assert len(result) == 2
    rels = {p.relative_to(tmp_path).as_posix() for p in result}
    assert rels == {"wiki/concepts/a.md", "wiki/concepts/b.md"}


def test_glob_patterns_expand(tmp_path: Path) -> None:
    _write(tmp_path / "wiki" / "concepts" / "physik-a.md", "# A\n")
    _write(tmp_path / "wiki" / "concepts" / "physik-b.md", "# B\n")
    _write(tmp_path / "wiki" / "concepts" / "other.md", "# C\n")
    result = filter_slice.resolve_slice(
        tmp_path,
        include=["wiki/concepts/physik-*.md"],
    )
    rels = {p.relative_to(tmp_path).as_posix() for p in result}
    assert rels == {"wiki/concepts/physik-a.md", "wiki/concepts/physik-b.md"}


def test_drops_private_pages(tmp_path: Path) -> None:
    _write(tmp_path / "a.md", "# Public\n")
    _write(tmp_path / "b.md", "---\nprivate: true\n---\n# Private\n")
    result = filter_slice.resolve_slice(tmp_path, include=["*.md"])
    rels = {p.relative_to(tmp_path).as_posix() for p in result}
    assert rels == {"a.md"}


def test_drops_pages_without_h1_or_title(tmp_path: Path) -> None:
    _write(tmp_path / "a.md", "# Has H1\n")
    _write(tmp_path / "b.md", "no heading at all")
    _write(tmp_path / "c.md", "---\ntitle: Frontmatter Title\n---\nBody\n")
    result = filter_slice.resolve_slice(tmp_path, include=["*.md"])
    rels = {p.relative_to(tmp_path).as_posix() for p in result}
    assert rels == {"a.md", "c.md"}


def test_deterministic_order(tmp_path: Path) -> None:
    """Output must be sorted so byte-identical re-builds are possible."""
    _write(tmp_path / "z.md", "# Z\n")
    _write(tmp_path / "a.md", "# A\n")
    _write(tmp_path / "m.md", "# M\n")
    r1 = filter_slice.resolve_slice(tmp_path, include=["*.md"])
    r2 = filter_slice.resolve_slice(tmp_path, include=["*.md"])
    assert r1 == r2
    rels = [p.relative_to(tmp_path).as_posix() for p in r1]
    assert rels == sorted(rels)


def test_missing_file_in_explicit_include_logs_warning(tmp_path: Path, capsys) -> None:
    """An explicit path that does not match must be reported, not silent-dropped."""
    _write(tmp_path / "a.md", "# A\n")
    result = filter_slice.resolve_slice(
        tmp_path,
        include=["a.md", "does-not-exist.md"],
    )
    rels = {p.relative_to(tmp_path).as_posix() for p in result}
    assert rels == {"a.md"}
    captured = capsys.readouterr()
    assert "does-not-exist.md" in captured.err
