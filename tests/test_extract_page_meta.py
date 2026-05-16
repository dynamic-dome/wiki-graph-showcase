"""Tests for tools/extract_page_meta.py."""
from __future__ import annotations

from pathlib import Path

import pytest

from tools import extract_page_meta


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


def test_extracts_title_from_h1(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "# Hello World\n\nBody text.\n")
    meta = extract_page_meta.extract(page)
    assert meta.title == "Hello World"


def test_extracts_title_from_frontmatter_when_no_h1(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "---\ntitle: From Frontmatter\n---\n\nBody.\n")
    meta = extract_page_meta.extract(page)
    assert meta.title == "From Frontmatter"


def test_returns_none_when_neither_h1_nor_title(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "Just body text, no heading.\n")
    meta = extract_page_meta.extract(page)
    assert meta is None


def test_returns_none_for_private_page(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "---\nprivate: true\n---\n# Title\nBody.\n")
    meta = extract_page_meta.extract(page)
    assert meta is None


def test_subtitle_is_first_sentence_of_lead(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "# Title\n\nFirst sentence. Second sentence. Third.\n\nNew para.\n")
    meta = extract_page_meta.extract(page)
    assert meta.subtitle == "First sentence."


def test_essence_is_first_paragraph(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "# Title\n\nLead paragraph with multiple sentences. Here is more. And another.\n\nSecond para.\n")
    meta = extract_page_meta.extract(page)
    assert "Lead paragraph" in meta.essence
    assert "And another." in meta.essence
    assert "Second para." not in meta.essence


def test_essence_strips_wikilink_brackets(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "# Title\n\nLinks to [[wiki/x/foo]] and [[bar|alias]].\n")
    meta = extract_page_meta.extract(page)
    # bare label rendered, brackets gone
    assert "[[" not in meta.essence
    assert "]]" not in meta.essence
    assert "foo" in meta.essence
    # alias display text wins over target slug when "|" present
    assert "alias" in meta.essence


def test_meta_dict_round_trip(tmp_path: Path) -> None:
    page = tmp_path / "a.md"
    _write(page, "# Title\n\nLead text.\n")
    meta = extract_page_meta.extract(page)
    d = meta.to_dict()
    assert d["title"] == "Title"
    assert d["subtitle"].startswith("Lead text")
    assert isinstance(d["essence"], str)


def test_essence_skips_definition_subheading(tmp_path: Path) -> None:
    """Wiki convention: `# H1 \\n\\n## Definition \\n\\n<lead>` — skip the sub-heading."""
    page = tmp_path / "a.md"
    _write(page, "# Title\n\n## Definition\n\nThe real lead sentence. More context.\n\n## Why it matters\n\nOther stuff.\n")
    meta = extract_page_meta.extract(page)
    assert meta.essence.startswith("The real lead sentence.")
    assert "## Definition" not in meta.essence
    assert meta.subtitle == "The real lead sentence."


def test_essence_skips_multiple_consecutive_subheadings(tmp_path: Path) -> None:
    """Several heading-only blocks in a row are all skipped."""
    page = tmp_path / "a.md"
    _write(page, "# Title\n\n## Sub one\n\n### Sub two\n\nActual content here.\n")
    meta = extract_page_meta.extract(page)
    assert meta.essence == "Actual content here."


def test_essence_keeps_paragraph_with_inline_heading_text(tmp_path: Path) -> None:
    """A paragraph that merely mentions a heading-like phrase mid-line is NOT skipped."""
    page = tmp_path / "a.md"
    _write(page, "# Title\n\nThis paragraph talks about # symbols inline. Not a heading.\n")
    meta = extract_page_meta.extract(page)
    assert meta.essence.startswith("This paragraph talks about")


def test_essence_skips_blockquote_status_marker(tmp_path: Path) -> None:
    """Wiki status-seed pages start with a `> ...` blockquote — skip it for the lead."""
    page = tmp_path / "a.md"
    _write(page, "# Maxwell\n\n> `status: seed` — bewusst minimal.\n\n## Definition\n\nDie Maxwell-Gleichungen sind das klassische Feldgleichungssystem.\n")
    meta = extract_page_meta.extract(page)
    assert meta.essence.startswith("Die Maxwell-Gleichungen sind")
    assert "status: seed" not in meta.essence
    assert "status: seed" not in meta.subtitle
    assert meta.subtitle.startswith("Die Maxwell-Gleichungen sind")


def test_essence_keeps_paragraph_with_inline_gt_character(tmp_path: Path) -> None:
    """A paragraph with `>` inside but not as a line-leading quote marker is NOT skipped."""
    page = tmp_path / "a.md"
    _write(page, "# Title\n\nIf x > 0 then we say x is positive.\n")
    meta = extract_page_meta.extract(page)
    assert meta.essence.startswith("If x > 0")
