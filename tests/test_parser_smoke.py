"""Confirm the copied parser still works after the move.

Not a re-implementation of DCO test_wiki_graph_parser.py — those live
upstream. This is a smoke check that the file moved correctly and that
the four properties we depend on still hold.
"""
from __future__ import annotations

from pathlib import Path

from tools import parser


def test_collect_pages_returns_path_style_ids(mini_vault: Path) -> None:
    pages = parser.collect_pages(mini_vault)
    assert "wiki/concepts/allgemeine-relativitaetstheorie" in pages
    assert "wiki/concepts/schwarzes-loch" in pages
    # path style, not stem-only
    assert "schwarzes-loch" not in pages


def test_extract_edges_uses_path_ids_on_both_ends(mini_vault: Path) -> None:
    edges = parser.extract_edges(mini_vault)
    assert (
        "wiki/concepts/allgemeine-relativitaetstheorie",
        "wiki/concepts/schwarzes-loch",
    ) in edges


def test_normalize_keeps_forward_slashes() -> None:
    assert parser.normalize("wiki/concepts/Some Page.md") == "wiki/concepts/some-page"


def test_bracket_strip_in_resolve_target() -> None:
    # private function but we exercise it indirectly: a frontmatter wikilink
    # would normally come bracketed through the YAML parser.
    alias_map = {"foo": "wiki/concepts/foo"}
    assert parser._resolve_target("[[wiki/concepts/bar]]", alias_map) == "wiki/concepts/bar"
    assert parser._resolve_target("foo", alias_map) == "wiki/concepts/foo"
