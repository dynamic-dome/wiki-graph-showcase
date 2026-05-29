# Origin: dynamic_central_orchestrator/wiki_graph/parser.py @ commit 0050d65
# Copied: 2026-05-15. Reason for the copy (not import): showcase is its own
# repo, no cross-repo Python paths.
#
# DELIBERATE FORK since 2026-05-30: this file now carries showcase-only
# additions (extract_typed_edges -> (src, tgt, relation_type) for the
# kompetenz dataset's coloured links). It is NO LONGER a 1:1 mirror of the
# DCO parser — do NOT blindly re-sync from upstream; merge by hand.

"""Wikilink + YAML-frontmatter parser for markdown vaults.

normalize(name): collapse "Some Page.md" / "some-page" / "Some Page" into
the canonical id used for graph nodes (lowercase, spaces -> hyphens, no .md).

Page IDs are vault-relative posix paths without the .md suffix, lowercased,
spaces collapsed to hyphens. So 'wiki/dashboards/Maintenance Cockpit.md'
becomes 'wiki/dashboards/maintenance-cockpit'. Two files with the same stem
in different directories are distinct nodes — collapsing them under their
stem (the pre-2026-05-15 behaviour) fused unrelated subtrees together.

extract_edges(vault_root): walk all .md files, return list of (src, target)
tuples where src is the path-style ID of the file containing the link, target
is the resolved path-style ID. Code blocks, inline code, and HTML comments
are stripped before matching. Stem-only wikilinks ([[foo]]) are resolved via
an alias map: if exactly one page in the vault has stem 'foo', the link
points to that page's full path. Path-style wikilinks ([[wiki/x/foo]]) are
used as-written.

extract_frontmatter_edges(vault_root): parse YAML frontmatter for keys
'depends_on' and 'applies_to' (kompetenz-wiki convention). Each list item
is an edge target, resolved through the same alias map.

collect_pages(vault_root): return set of all path-style page IDs in the vault.
"""
from __future__ import annotations

import re
from pathlib import Path


_WIKILINK_RE = re.compile(r"\[\[([^\[\]\|]+?)(?:\|[^\]]*)?\]\]")

# Strip fenced code blocks (``` ... ```) and inline code (`...`)
_FENCED_CODE_RE = re.compile(r"```.*?```", re.DOTALL)
_INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
# Strip HTML comments
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
# Strip YAML frontmatter from the body so frontmatter values are not parsed
# as inline wikilinks twice
_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)

# Frontmatter keys with edge-semantics in the kompetenz-wiki
_FRONTMATTER_EDGE_KEYS = ("depends_on", "applies_to")


def normalize(name: str) -> str:
    """Canonical node id: lowercase, spaces -> hyphens, no .md suffix.

    Preserves forward slashes so that path-style IDs survive normalization
    untouched. Backslashes (Windows) are converted to forward slashes for
    cross-platform consistency.
    """
    s = name.strip().replace("\\", "/")
    if s.lower().endswith(".md"):
        s = s[:-3]
    s = s.replace(" ", "-")
    return s.lower()


def _strip_noise(body: str) -> tuple[str, str | None]:
    """Return (body_without_codeblocks_and_comments, frontmatter_or_None)."""
    fm_match = _FRONTMATTER_RE.match(body)
    frontmatter = fm_match.group(1) if fm_match else None
    if fm_match:
        body = body[fm_match.end():]
    body = _FENCED_CODE_RE.sub("", body)
    body = _INLINE_CODE_RE.sub("", body)
    body = _HTML_COMMENT_RE.sub("", body)
    return body, frontmatter


def _path_id(path: Path, vault_root: Path) -> str:
    """Vault-relative posix-style ID for an .md file (no extension, lowercased)."""
    rel = path.relative_to(vault_root).with_suffix("")
    return normalize(rel.as_posix())


def _walk_md(vault_root: Path):
    """Yield (path, path_id) tuples for every .md file under vault_root."""
    root = Path(vault_root)
    for path in sorted(root.rglob("*.md")):
        yield path, _path_id(path, root)


def _build_stem_alias_map(vault_root: Path) -> dict[str, str]:
    """Map normalized stem -> full path-style ID, but only when the stem is unique.

    Obsidian resolves [[foo]] to a page named foo.md anywhere in the vault, as
    long as exactly one such page exists. When multiple files share a stem,
    Obsidian falls back to disambiguation (the user would write [[path/foo]]),
    so we leave the alias unresolved and the link stays as written.
    """
    stem_counts: dict[str, int] = {}
    stem_to_path: dict[str, str] = {}
    for _path, path_id in _walk_md(vault_root):
        stem = path_id.rsplit("/", 1)[-1]
        stem_counts[stem] = stem_counts.get(stem, 0) + 1
        stem_to_path[stem] = path_id
    return {
        stem: path_id
        for stem, path_id in stem_to_path.items()
        if stem_counts[stem] == 1
    }


def _resolve_target(target_raw: str, alias_map: dict[str, str]) -> str:
    """Map a raw wikilink target to a page-ID.

    Path-style targets ([[wiki/x/foo]]) keep their path. Stem-only targets
    ([[foo]]) are rewritten to the full path if the stem is unique. Unknown
    or ambiguous stems keep their raw form — broken links are still emitted
    as edges (the API caller may want to surface them).

    Strips wrapping [[...]] brackets — Obsidian-Dataview YAML uses
    'depends_on: - [[wiki/x/foo]]' and our minimal YAML parser hands the
    bracketed string over to us. Also strips a trailing '|alias' fragment.
    """
    s = target_raw.strip()
    # Peel one layer of [[...]] if present (Obsidian-Dataview YAML convention)
    if s.startswith("[[") and s.endswith("]]"):
        s = s[2:-2].strip()
    # Drop |alias display text
    if "|" in s:
        s = s.split("|", 1)[0].strip()
    target = normalize(s)
    if "/" not in target and target in alias_map:
        return alias_map[target]
    return target


def collect_pages(vault_root: Path) -> set[str]:
    return {path_id for _path, path_id in _walk_md(vault_root)}


def extract_edges(vault_root: Path) -> list[tuple[str, str]]:
    """Return sorted list of (src_id, target_id) wikilink edges.

    Both endpoints are path-style IDs. See module docstring for stem-only
    link resolution.
    """
    alias_map = _build_stem_alias_map(vault_root)
    edges: list[tuple[str, str]] = []
    for path, src in _walk_md(vault_root):
        try:
            body = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        body, _ = _strip_noise(body)
        for match in _WIKILINK_RE.finditer(body):
            target = _resolve_target(match.group(1), alias_map)
            edges.append((src, target))
    edges.sort()
    return edges


def _parse_yaml_list(yaml_body: str, key: str) -> list[str]:
    """Minimal YAML-list parser: 'key:\\n  - val\\n  - val\\n' (no full PyYAML dep)."""
    out: list[str] = []
    in_block = False
    for line in yaml_body.splitlines():
        stripped = line.rstrip()
        if not in_block:
            if stripped.startswith(f"{key}:"):
                rest = stripped[len(key) + 1:].strip()
                if rest:
                    # inline form: key: [a, b]
                    if rest.startswith("[") and rest.endswith("]"):
                        for item in rest[1:-1].split(","):
                            item = item.strip().strip('"').strip("'")
                            if item:
                                out.append(item)
                    else:
                        out.append(rest.strip('"').strip("'"))
                    continue
                in_block = True
            continue
        # in block: only '  - value' lines belong, anything else closes the block
        if line.startswith(" ") and line.lstrip().startswith("-"):
            item = line.lstrip()[1:].strip().strip('"').strip("'")
            if item:
                out.append(item)
        elif stripped == "":
            continue
        else:
            in_block = False
    return out


def extract_frontmatter_edges(vault_root: Path) -> list[tuple[str, str]]:
    alias_map = _build_stem_alias_map(vault_root)
    edges: list[tuple[str, str]] = []
    for path, src in _walk_md(vault_root):
        try:
            body = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        fm_match = _FRONTMATTER_RE.match(body)
        if not fm_match:
            continue
        fm_body = fm_match.group(1)
        for key in _FRONTMATTER_EDGE_KEYS:
            for target in _parse_yaml_list(fm_body, key):
                edges.append((src, _resolve_target(target, alias_map)))
    edges.sort()
    return edges


# --- Showcase fork: typed edges for the kompetenz dataset ------------------

# Frontmatter keys that carry a typed relation. The relation type equals the
# key name. 'supports' is added on top of the legacy depends_on/applies_to.
_TYPED_FRONTMATTER_KEYS = ("supports", "depends_on", "applies_to")


def extract_typed_edges(vault_root: Path) -> list[tuple[str, str, str]]:
    """Return sorted list of (src_id, target_id, relation_type) edges.

    Frontmatter keys (supports/depends_on/applies_to) yield their key as the
    relation type. Body wikilinks yield 'related'. When the same (src, tgt)
    pair has both a typed frontmatter edge and a body wikilink, the stronger
    frontmatter type wins and the 'related' duplicate is dropped.
    """
    alias_map = _build_stem_alias_map(vault_root)
    # (src, tgt) -> relation_type, with frontmatter taking precedence.
    typed: dict[tuple[str, str], str] = {}

    for path, src in _walk_md(vault_root):
        try:
            body = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        clean_body, frontmatter = _strip_noise(body)

        # 1) Frontmatter typed edges (strong) — set first so they win.
        if frontmatter:
            for key in _TYPED_FRONTMATTER_KEYS:
                for raw in _parse_yaml_list(frontmatter, key):
                    tgt = _resolve_target(raw, alias_map)
                    if tgt and tgt != src:
                        typed[(src, tgt)] = key

        # 2) Body wikilinks as weak 'related' — only if no stronger edge yet.
        for match in _WIKILINK_RE.finditer(clean_body):
            tgt = _resolve_target(match.group(1), alias_map)
            if tgt and tgt != src:
                typed.setdefault((src, tgt), "related")

    return sorted((s, t, ty) for (s, t), ty in typed.items())
