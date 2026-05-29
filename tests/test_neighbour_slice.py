"""Tests for neighbour resolution (Task 3): core tier + referenced neighbours.

A concept/entity page enters the slice ONLY if a core-tier page references it
via frontmatter edges (depends_on/applies_to/supports) or body wikilinks.
"""
from __future__ import annotations

from pathlib import Path

from tools import filter_slice


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


def _mini_vault(tmp_path: Path) -> Path:
    # Core tier
    _write(
        tmp_path / "wiki" / "competences" / "comp-a.md",
        "---\ntype: competence\nstatus: active\n"
        "depends_on:\n  - wiki/concepts/referenced-concept\n"
        "applies_to:\n  - wiki/entities/referenced-entity\n---\n"
        "# Competence A\n\nLead text.\n",
    )
    _write(
        tmp_path / "wiki" / "synthesis" / "syn-a.md",
        "---\ntype: synthesis\nstatus: active\n---\n# Synthesis A\n\nLead.\n",
    )
    # Neighbours: one referenced, one NOT referenced
    _write(
        tmp_path / "wiki" / "concepts" / "referenced-concept.md",
        "---\ntype: concept\nstatus: active\n---\n# Referenced Concept\n\nLead.\n",
    )
    _write(
        tmp_path / "wiki" / "entities" / "referenced-entity.md",
        "---\ntype: entity\nstatus: active\n---\n# Referenced Entity\n\nLead.\n",
    )
    _write(
        tmp_path / "wiki" / "concepts" / "orphan-concept.md",
        "---\ntype: concept\nstatus: active\n---\n# Orphan Concept\n\nNobody links me.\n",
    )
    return tmp_path


def test_core_tier_plus_referenced_neighbours_only(tmp_path: Path) -> None:
    vault = _mini_vault(tmp_path)
    result = filter_slice.resolve_slice_with_neighbours(
        vault,
        include=["wiki/competences/*.md", "wiki/synthesis/*.md"],
        neighbour_dirs=["wiki/concepts", "wiki/entities"],
    )
    rels = {p.relative_to(vault).as_posix() for p in result}
    assert "wiki/competences/comp-a.md" in rels
    assert "wiki/synthesis/syn-a.md" in rels
    assert "wiki/concepts/referenced-concept.md" in rels  # pulled in via depends_on
    assert "wiki/entities/referenced-entity.md" in rels    # pulled in via applies_to
    assert "wiki/concepts/orphan-concept.md" not in rels   # unreferenced -> excluded


def test_neighbour_must_live_in_a_neighbour_dir(tmp_path: Path) -> None:
    """A referenced page outside neighbour_dirs is not auto-added."""
    _write(
        tmp_path / "wiki" / "competences" / "comp.md",
        "---\ntype: competence\nstatus: active\n"
        "depends_on:\n  - wiki/random/elsewhere\n---\n# Comp\n\nLead.\n",
    )
    _write(tmp_path / "wiki" / "random" / "elsewhere.md", "# Elsewhere\n\nLead.\n")
    result = filter_slice.resolve_slice_with_neighbours(
        tmp_path,
        include=["wiki/competences/*.md"],
        neighbour_dirs=["wiki/concepts", "wiki/entities"],
    )
    rels = {p.relative_to(tmp_path).as_posix() for p in result}
    assert rels == {"wiki/competences/comp.md"}


def test_blocked_status_neighbour_is_not_pulled_in(tmp_path: Path) -> None:
    """A referenced neighbour that fails the status gate stays out."""
    _write(
        tmp_path / "wiki" / "competences" / "comp.md",
        "---\ntype: competence\nstatus: active\n"
        "depends_on:\n  - wiki/concepts/dead\n---\n# Comp\n\nLead.\n",
    )
    _write(
        tmp_path / "wiki" / "concepts" / "dead.md",
        "---\ntype: concept\nstatus: superseded\n---\n# Dead\n\nLead.\n",
    )
    gate = {
        "field": "status",
        "block_values": ["superseded"],
        "missing_policy": "allow",
    }
    result = filter_slice.resolve_slice_with_neighbours(
        tmp_path,
        include=["wiki/competences/*.md"],
        neighbour_dirs=["wiki/concepts", "wiki/entities"],
        status_gate=gate,
    )
    rels = {p.relative_to(tmp_path).as_posix() for p in result}
    assert rels == {"wiki/competences/comp.md"}
