"""Tests for parser.extract_typed_edges (Task 4): edges carry a relation type.

  supports / depends_on / applies_to  -> from frontmatter lists
  related                             -> from body wikilinks

The legacy extract_edges / extract_frontmatter_edges remain untouched so the
astro slice keeps working — covered by a regression assertion here too.
"""
from __future__ import annotations

from pathlib import Path

from tools import parser


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


def test_frontmatter_edge_types(tmp_path: Path) -> None:
    _write(
        tmp_path / "wiki" / "competences" / "comp.md",
        "---\ntype: competence\n"
        "supports:\n  - wiki/topics/t\n"
        "depends_on:\n  - wiki/concepts/c\n"
        "applies_to:\n  - wiki/entities/e\n---\n"
        "# Comp\n\nLead.\n",
    )
    _write(tmp_path / "wiki" / "topics" / "t.md", "# T\n")
    _write(tmp_path / "wiki" / "concepts" / "c.md", "# C\n")
    _write(tmp_path / "wiki" / "entities" / "e.md", "# E\n")

    edges = parser.extract_typed_edges(tmp_path)
    triples = {(s, t, ty) for s, t, ty in edges}
    assert ("wiki/competences/comp", "wiki/topics/t", "supports") in triples
    assert ("wiki/competences/comp", "wiki/concepts/c", "depends_on") in triples
    assert ("wiki/competences/comp", "wiki/entities/e", "applies_to") in triples


def test_body_wikilink_is_related(tmp_path: Path) -> None:
    _write(
        tmp_path / "wiki" / "competences" / "comp.md",
        "---\ntype: competence\n---\n# Comp\n\nSee [[wiki/concepts/c]] for more.\n",
    )
    _write(tmp_path / "wiki" / "concepts" / "c.md", "# C\n")

    edges = parser.extract_typed_edges(tmp_path)
    triples = {(s, t, ty) for s, t, ty in edges}
    assert ("wiki/competences/comp", "wiki/concepts/c", "related") in triples


def test_frontmatter_type_wins_over_body_related(tmp_path: Path) -> None:
    """If the same pair appears both as a typed frontmatter edge and a body
    wikilink, the stronger frontmatter type must win (no duplicate 'related')."""
    _write(
        tmp_path / "wiki" / "competences" / "comp.md",
        "---\ntype: competence\ndepends_on:\n  - wiki/concepts/c\n---\n"
        "# Comp\n\nAlso linked inline [[wiki/concepts/c]].\n",
    )
    _write(tmp_path / "wiki" / "concepts" / "c.md", "# C\n")

    edges = parser.extract_typed_edges(tmp_path)
    pair_types = [ty for s, t, ty in edges
                  if (s, t) == ("wiki/competences/comp", "wiki/concepts/c")]
    assert pair_types == ["depends_on"]


def test_typed_edges_are_sorted_and_deterministic(tmp_path: Path) -> None:
    _write(
        tmp_path / "wiki" / "competences" / "comp.md",
        "---\ntype: competence\nsupports:\n  - wiki/topics/t\n---\n# Comp\n",
    )
    _write(tmp_path / "wiki" / "topics" / "t.md", "# T\n")
    e1 = parser.extract_typed_edges(tmp_path)
    e2 = parser.extract_typed_edges(tmp_path)
    assert e1 == e2
    assert e1 == sorted(e1)


def test_legacy_extractors_unchanged(tmp_path: Path) -> None:
    """Regression: the astro-path extractors still return untyped (src,tgt)."""
    _write(
        tmp_path / "wiki" / "concepts" / "a.md",
        "# A\n\nLinks to [[wiki/concepts/b]].\n",
    )
    _write(tmp_path / "wiki" / "concepts" / "b.md", "# B\n")
    edges = parser.extract_edges(tmp_path)
    assert ("wiki/concepts/a", "wiki/concepts/b") in edges
    assert all(len(e) == 2 for e in edges)
