"""Extract title/subtitle/essence from a markdown page.

A page is valid for showcase if:
  - it has either an H1 (# Title) or a frontmatter `title:` key
  - it does NOT have frontmatter `private: true`

`extract(path)` returns a PageMeta dataclass or None if invalid.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional


_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
_H1_RE = re.compile(r"^# (.+)$", re.MULTILINE)
_WIKILINK_RE = re.compile(r"\[\[([^\[\]\|]+?)(?:\|([^\]]*))?\]\]")
_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-ZÄÖÜ])")


@dataclass(frozen=True)
class PageMeta:
    title: str
    subtitle: str
    essence: str

    def to_dict(self) -> dict:
        return asdict(self)


def _parse_frontmatter(body: str) -> tuple[dict, str]:
    """Return (frontmatter_dict, body_without_frontmatter).

    Minimal YAML-ish: only flat key:value pairs, value treated as string.
    """
    m = _FRONTMATTER_RE.match(body)
    if not m:
        return {}, body
    fm_text = m.group(1)
    rest = body[m.end():]
    fm: dict = {}
    for line in fm_text.splitlines():
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        val = val.strip().strip('"').strip("'")
        key = key.strip()
        # cheap bool coercion
        if val.lower() == "true":
            fm[key] = True
        elif val.lower() == "false":
            fm[key] = False
        else:
            fm[key] = val
    return fm, rest


def _render_wikilinks(text: str) -> str:
    """[[wiki/x/foo]] -> 'foo'; [[bar|alias]] -> 'alias'."""
    def repl(m: re.Match) -> str:
        alias = m.group(2)
        if alias:
            return alias.strip()
        target = m.group(1).strip()
        if "/" in target:
            return target.rsplit("/", 1)[-1]
        return target
    return _WIKILINK_RE.sub(repl, text)


_HEADING_LINE_RE = re.compile(r"^#{1,6}\s")


def _is_heading_only(paragraph: str) -> bool:
    """True if every non-blank line of the paragraph is a markdown heading."""
    lines = [ln for ln in paragraph.splitlines() if ln.strip()]
    return bool(lines) and all(_HEADING_LINE_RE.match(ln) for ln in lines)


def _first_paragraph(body: str) -> str:
    """First non-empty paragraph that is not a markdown heading.

    The wiki convention is `# H1 \\n\\n## Definition \\n\\n<lead>`, so the
    first block after the H1 is often the sub-heading `## Definition` itself.
    We skip paragraphs that consist only of heading lines so the real lead
    text wins.
    """
    for para in re.split(r"\n\s*\n", body.strip()):
        cleaned = para.strip()
        if not cleaned or _is_heading_only(cleaned):
            continue
        return cleaned
    return ""


def _first_sentence(text: str) -> str:
    if not text:
        return ""
    parts = _SENTENCE_BOUNDARY.split(text, maxsplit=1)
    return parts[0].strip()


def extract(path: Path) -> Optional[PageMeta]:
    """Return PageMeta or None if the page is not valid for showcase."""
    try:
        body = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None

    fm, rest = _parse_frontmatter(body)

    if fm.get("private") is True:
        return None

    # Strip H1 from rest for cleaner lead extraction
    h1_match = _H1_RE.search(rest)
    if h1_match:
        title = h1_match.group(1).strip()
        rest = rest.replace(h1_match.group(0), "", 1)
    else:
        title = fm.get("title")
        if not title:
            return None

    lead = _first_paragraph(rest)
    lead = _render_wikilinks(lead)
    subtitle = _first_sentence(lead)

    return PageMeta(title=title, subtitle=subtitle, essence=lead)
