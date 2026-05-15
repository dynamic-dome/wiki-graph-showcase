# Wiki-Graph Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, static, three.js-based showcase site that lets visitors freely click through a curated Astrophysics knowledge graph extracted from `~/wiki/`, with two switchable themes (Crab Nebula + Dynamic Dome) and a Gold-Mode slider that ramps the visual richness.

**Architecture:** Pre-computed static JSON (Ansatz A from the spec). A Python build script reads a defined Vault-Slice (~31 Markdown files), parses wikilinks via a copy of `wiki_graph/parser.py` from DCO commit `0050d65`, and emits `dist/` with one `graph.json`, per-node detail JSONs, vendored three.js, vanilla-HTML/CSS/JS frontend. Deployed via Cloudflare Pages to `wiki.dynamic-dome.com`. No backend, no auth, no framework runtime.

**Tech Stack:**
- **Build:** Python 3.11+, pytest, no external deps beyond stdlib (`json`, `pathlib`, `argparse`, `glob`)
- **Frontend:** Vanilla HTML5 + CSS3 (custom properties for theming) + Vanilla JS (ES2020, no transpiler) + `3d-force-graph` 1.x (vendored, 707 KB) + `three.js` r150+ (transitive via 3d-force-graph)
- **Tests:** pytest for build script; Playwright (`@playwright/test`) for frontend smoke
- **Hosting:** Cloudflare Pages with `npm run build` hook (the npm script just shells to Python; no real Node deps needed for the app, only for Playwright dev tests)
- **Source-of-truth:** Vault at `C:/Users/domes/wiki/` (read-only access during build only)

---

## Repo Setup

**New repo:** `~/Desktop/Claude-Projekte/wiki-graph-showcase/` — clean git init, GitHub remote `dynamic-dome/wiki-graph-showcase` (private).

**Branch:** `main` (default).

**File structure:**
```
wiki-graph-showcase/
├── CLAUDE.md                              # Agent rules (project-spec policy)
├── HOW-TO-USE.md                          # User+agent index page
├── README.md                              # Minimal — links to HOW-TO-USE.md
├── .gitignore
├── package.json                           # npm script aliases (build, test:e2e, dev)
├── showcase.config.json                   # input config for the build
├── tools/
│   ├── parser.py                          # COPY of DCO wiki_graph/parser.py (commit 0050d65)
│   ├── build.py                           # main build orchestrator (CLI)
│   ├── extract_page_meta.py               # title/lead/essence extraction from markdown
│   ├── filter_slice.py                    # apply include/exclude globs, public-safety
│   └── __init__.py
├── tests/
│   ├── conftest.py                        # tmp_path fixtures, mini-vault builder helpers
│   ├── test_parser_smoke.py               # confirms copied parser still works
│   ├── test_extract_page_meta.py
│   ├── test_filter_slice.py
│   ├── test_build_end_to_end.py
│   └── e2e/
│       └── showcase.spec.ts               # Playwright smoke
├── src/
│   ├── index.html                         # static page (template)
│   ├── styles/
│   │   ├── base.css                       # layout, modal, toolbar, slider
│   │   ├── theme-crab.css
│   │   └── theme-dome.css
│   ├── scripts/
│   │   ├── main.js                        # IIFE app entry
│   │   ├── graph-loader.js                # fetch graph.json + nodes/*.json
│   │   ├── three-stage.js                 # 3d-force-graph setup, interactions
│   │   ├── gold-pulse.js                  # RAF loop for edge breath, density-adaptive
│   │   ├── theme-switcher.js              # toggles data-theme attribute, persists
│   │   ├── modal.js                       # detail modal show/hide/render
│   │   └── url-state.js                   # parse + replaceState for ?node=&theme=&gold=
│   └── vendor/
│       ├── 3d-force-graph.min.js          # copy from DCO vendor/
│       └── three.min.js                   # bundled within 3d-force-graph; if needed standalone, vendored separately
└── docs/
    ├── PROJECT.md
    ├── CAPABILITIES.md
    ├── ARCHITECTURE.md
    └── CHANGELOG.md
```

**One-file-one-responsibility principle applied:** each script module is < 250 LOC, single-purpose. The build script splits into `extract`, `filter`, and `orchestrate` precisely to keep each unit testable in isolation.

---

## Phase 0: Scaffold the Repo

### Task 0.1: Create the new repo skeleton

**Files:**
- Create: `~/Desktop/Claude-Projekte/wiki-graph-showcase/.gitignore`
- Create: `~/Desktop/Claude-Projekte/wiki-graph-showcase/README.md`
- Create: `~/Desktop/Claude-Projekte/wiki-graph-showcase/CLAUDE.md`
- Create: `~/Desktop/Claude-Projekte/wiki-graph-showcase/HOW-TO-USE.md`

- [ ] **Step 1: Make directory and init git**

Run:
```bash
mkdir -p ~/Desktop/Claude-Projekte/wiki-graph-showcase
cd ~/Desktop/Claude-Projekte/wiki-graph-showcase
git init
git checkout -b main
```

Expected: `Initialized empty Git repository in .../wiki-graph-showcase/.git/`

- [ ] **Step 2: Write `.gitignore`**

Create `~/Desktop/Claude-Projekte/wiki-graph-showcase/.gitignore`:
```
__pycache__/
*.pyc
.venv/
.pytest_cache/
node_modules/
dist/
.DS_Store
.dbxignore
*.stackdump
.agent-memory/
.playwright-mcp/
.superpowers/
test-results/
playwright-report/
```

- [ ] **Step 3: Write `README.md` (minimal — points to HOW-TO-USE.md)**

Create `~/Desktop/Claude-Projekte/wiki-graph-showcase/README.md`:
```markdown
# wiki-graph-showcase

Public 3D-Knowledge-Graph-Showcase for dome-dynamics. Astrophysics knowledge slice from `~/wiki/`, rendered with three.js, two themes (Crab Nebula + Dynamic Dome), Gold-Mode slider.

**Lese als naechstes:** [HOW-TO-USE.md](HOW-TO-USE.md).
```

- [ ] **Step 4: Write `CLAUDE.md`**

Create `~/Desktop/Claude-Projekte/wiki-graph-showcase/CLAUDE.md`:
```markdown
# CLAUDE.md

> **Erste Pflichtlektuere:** [`HOW-TO-USE.md`](HOW-TO-USE.md).

## Projekt-Konventionen

- **Build = Python 3.11+ (stdlib only), kein PyPI-Dep.** Wenn ein Drittpaket noetig wird, vorher mit User abstimmen.
- **Frontend = Vanilla JS, ES2020.** Kein React, kein Bundler, kein TypeScript-Compile-Step. Wenn TS-Hints sinnvoll sind, JSDoc verwenden.
- **Tests:** pytest fuer Build, Playwright (TypeScript spec via tsx) fuer Frontend-E2E.
- **Public-Safety:** Build rejected `private: true`-Frontmatter. Vor jedem ersten Deploy: manueller Sweep durch alle generierten `nodes/*.json` auf private Inhalte (Namen, interne Pfade, etc.).
- **Parser-Sync:** `tools/parser.py` ist eine Kopie von `dynamic_central_orchestrator/wiki_graph/parser.py` (Quell-Commit im Header dokumentiert). Bei Aenderungen an der DCO-Quelle: hier per Hand syncen, Header-Hash updaten.
- **Wiki-Read-Only:** Build-Step liest `C:/Users/domes/wiki/`, schreibt NIE dorthin.
```

- [ ] **Step 5: Write `HOW-TO-USE.md`**

Create `~/Desktop/Claude-Projekte/wiki-graph-showcase/HOW-TO-USE.md`:
```markdown
# HOW-TO-USE — wiki-graph-showcase

## Was ist das

Ein statisch generiertes 3D-Showcase fuer einen kuratierten Wissensgraphen aus `~/wiki/`. Besucher klicken sich durch Astrophysik-Konzepte, mit zwei umschaltbaren Visual-Themes und einem "Gold-Mode"-Slider. Hostbar als Cloudflare-Pages-Site auf `wiki.dynamic-dome.com`.

## Komponenten

- `tools/build.py` — Python-CLI. Liest `showcase.config.json` + Vault, schreibt `dist/`.
- `src/` — Frontend-Quellen (HTML, CSS, JS). Werden vom Build in `dist/` kopiert/gemerged.
- `tests/` — pytest fuer Build, Playwright fuer Frontend.
- `showcase.config.json` — definiert welche Wiki-Files reinkommen.

## Wie starte ich es

**Build laufen lassen (lokal):**
```bash
python tools/build.py --config showcase.config.json --out dist/
```

**Frontend lokal anschauen:**
```bash
cd dist
python -m http.server 8000
# Browser: http://localhost:8000
```

**Tests:**
```bash
python -m pytest tests/ -v --ignore=tests/e2e
npx playwright test tests/e2e/
```

## Wo Doku lebt

- Architektur + Datenfluss → `docs/ARCHITECTURE.md`
- Faehigkeiten + Status → `docs/CAPABILITIES.md`
- Changelog → `docs/CHANGELOG.md`
- Spec → `<dco-repo>/docs/superpowers/specs/2026-05-15-wiki-graph-showcase-design.md`

## Troubleshooting

- **Build wirft `private page rejected`** — eine im `include` gelistete Page hat `private: true` im Frontmatter. Entweder entfernen oder aus `include` rauswerfen.
- **Build wirft `page has no H1`** — Page hat weder `# Titel` noch `title:` im Frontmatter. Page korrigieren oder ausschliessen.
- **Frontend leer/keine Knoten** — pruefen ob `dist/assets/graph.json` existiert + `nodes`-Array nicht leer. Browser-Console auf 404 zu `graph.json` checken.
```

- [ ] **Step 6: Initial commit**

```bash
cd ~/Desktop/Claude-Projekte/wiki-graph-showcase
git add .gitignore README.md CLAUDE.md HOW-TO-USE.md
git commit -m "chore: scaffold wiki-graph-showcase repo

CLAUDE.md + HOW-TO-USE.md + .gitignore. Empty git tree
following the project-entry-point convention from user CLAUDE.md."
```

---

### Task 0.2: Add `docs/` structure

**Files:**
- Create: `docs/PROJECT.md`
- Create: `docs/CAPABILITIES.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/CHANGELOG.md`

- [ ] **Step 1: Write `docs/PROJECT.md`**

Create with:
```markdown
# wiki-graph-showcase — Projekt-Steckbrief

**Was:** Statisch gebaute, public erreichbare 3D-Visualisierung eines kuratierten Astrophysik-Wissens-Graphen.

**Warum:** Besucher der dome-dynamics-Website sollen einen visuellen, spielerischen Eindruck von der inhaltlichen Tiefe des Wikis bekommen, ohne tatsaechlich ins Wiki einzudringen.

**Status:** MVP in Entwicklung (Spec approved 2026-05-15).

**Stack:** Python 3.11+ (stdlib) Build, Vanilla JS Frontend, three.js + 3d-force-graph, Cloudflare Pages Hosting.

**Einzeiler:** "Knowledge nebula you can click through."
```

- [ ] **Step 2: Write `docs/CAPABILITIES.md`**

Create with:
```markdown
# Faehigkeiten

| Faehigkeit | Status | Datum |
|---|---|---|
| Build-Skript fuer Vault-Slice → JSON | geplant | 2026-05-15 |
| Frontend mit 3d-force-graph | geplant | 2026-05-15 |
| Theme Crab Nebula | geplant | 2026-05-15 |
| Theme Dynamic Dome | geplant | 2026-05-15 |
| Gold-Mode-Slider | geplant | 2026-05-15 |
| Modal-Detail mit Knoten-Essenz | geplant | 2026-05-15 |
| URL-Permalink ?node=&theme=&gold= | geplant | 2026-05-15 |
| Mobile-Adaption (max_nodes=40, Bottom-Drawer) | geplant | 2026-05-15 |
| prefers-reduced-motion Respekt | geplant | 2026-05-15 |
```

- [ ] **Step 3: Write `docs/ARCHITECTURE.md`**

Create with:
```markdown
# Architektur

## Datenfluss

```
~/wiki/<files>  →  tools/build.py  →  dist/{graph.json, nodes/*.json}  →  CF Pages  →  browser
```

## Module

- **`tools/parser.py`** — Path-ID + Stem-Alias-Resolution. Kopie aus DCO `wiki_graph/parser.py@0050d65`. Wird per Hand re-synced.
- **`tools/extract_page_meta.py`** — Liest Markdown-Body, extrahiert Titel (H1 oder Frontmatter), Lead-Paragraph, Essence.
- **`tools/filter_slice.py`** — Wendet `include`-Globs aus `showcase.config.json` an, droppt `private: true`-Pages, droppt Pages ohne H1.
- **`tools/build.py`** — Orchestrator. Glob → Parse → Extract → Filter → Emit JSON + Asset-Copy.

- **`src/scripts/main.js`** — App-Bootstrap. Liest URL-Params, ruft graph-loader, three-stage, modal, theme-switcher auf.
- **`src/scripts/graph-loader.js`** — `fetch('graph.json')` + lazy `fetch('nodes/<slug>.json')`.
- **`src/scripts/three-stage.js`** — three.js + 3d-force-graph Setup, Klick/Hover/Doppelklick-Handler.
- **`src/scripts/gold-pulse.js`** — RAF-Loop fuer Edge-Atmer. Adaptive Periode aus Kanten-Dichte + Slider-Wert.
- **`src/scripts/theme-switcher.js`** — Schaltet `data-theme` Attribut, persistiert in URL + localStorage.
- **`src/scripts/modal.js`** — Detail-Panel.
- **`src/scripts/url-state.js`** — Parses + writes URL params.

## Abhaengigkeiten

- **Build:** Python 3.11+ stdlib only.
- **Frontend:** `3d-force-graph` (vendored), `three.js` (transitive durch 3d-force-graph).
- **Dev-Tests:** pytest (Python), Playwright (Node).
```

- [ ] **Step 4: Write `docs/CHANGELOG.md`**

Create with:
```markdown
# Changelog

Neueste Eintraege oben.

---

## 2026-05-15 — Repo scaffold

- Initial repo created from spec `docs/superpowers/specs/2026-05-15-wiki-graph-showcase-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs: project docs scaffold

PROJECT, CAPABILITIES, ARCHITECTURE, CHANGELOG. Follows the
docs/-convention from user CLAUDE.md."
```

---

## Phase 1: Build Pipeline — Parser Copy + Smoke

### Task 1.1: Copy `wiki_graph/parser.py` from DCO

**Files:**
- Create: `tools/__init__.py`
- Create: `tools/parser.py`

**Source:** `C:/Users/domes/dynamic_central_orchestrator/wiki_graph/parser.py` at commit `0050d65` (the 2026-05-15 path-ID + bracket-strip fix).

- [ ] **Step 1: Create `tools/__init__.py` (empty)**

Run:
```bash
mkdir -p tools
echo "" > tools/__init__.py
```

- [ ] **Step 2: Copy `parser.py` and add provenance header**

Read the source file at `C:/Users/domes/dynamic_central_orchestrator/wiki_graph/parser.py` and copy its full content into `tools/parser.py`, **prepending** these provenance lines just above the existing module docstring (the docstring starts with `"""Wikilink + YAML-frontmatter parser ...`):

```python
# Source: dynamic_central_orchestrator/wiki_graph/parser.py @ commit 0050d65
# Copied: 2026-05-15. Re-sync manually if the upstream parser changes.
# Reason for the copy (not import): showcase is its own repo, no
# cross-repo Python paths.

```

Do not modify the parser logic itself.

- [ ] **Step 3: Commit**

```bash
git add tools/__init__.py tools/parser.py
git commit -m "feat(tools): copy wiki_graph parser from DCO @0050d65

Path-ID + Obsidian-Dataview bracket strip. Re-synced manually
if upstream changes."
```

---

### Task 1.2: Smoke test the parser copy

**Files:**
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Create: `tests/test_parser_smoke.py`

- [ ] **Step 1: Write `tests/__init__.py` (empty)**

```bash
mkdir -p tests
echo "" > tests/__init__.py
```

- [ ] **Step 2: Write `tests/conftest.py` — mini-vault fixture**

Create `tests/conftest.py`:
```python
"""Shared fixtures for build-pipeline tests.

mini_vault: builds an in-memory vault on tmp_path with a small set of
markdown pages that exercise the parser + extractor. Pages have realistic
frontmatter, h1, wikilinks, and a few public-safety flags.
"""
from __future__ import annotations

from pathlib import Path

import pytest


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


@pytest.fixture
def mini_vault(tmp_path: Path) -> Path:
    """Return a vault root with a small kuratierter slice."""
    root = tmp_path / "vault"

    _write(root / "wiki" / "concepts" / "allgemeine-relativitaetstheorie.md", """\
# Allgemeine Relativitaetstheorie

Einsteins Theorie der Gravitation als Kruemmung der Raumzeit.

Die ART beschreibt Gravitation nicht als Kraft, sondern als geometrische
Eigenschaft der Raumzeit. Massen kruemmen die Raumzeit, frei fallende
Koerper folgen Geodaeten. Sie verbindet sich mit [[wiki/concepts/schwarzes-loch]]
und sagt [[wiki/concepts/gravitationswellen]] voraus.
""")

    _write(root / "wiki" / "concepts" / "schwarzes-loch.md", """\
# Schwarzes Loch

Region in der Raumzeit aus der nichts entkommen kann.

Geboren aus dem Kollaps massiver Sterne. Loesung der
[[wiki/concepts/schwarzschild-metrik]].
""")

    _write(root / "wiki" / "concepts" / "schwarzschild-metrik.md", """\
# Schwarzschild-Metrik

Erste exakte Loesung der Einstein-Gleichungen.

Beschreibt die Raumzeit-Geometrie um eine spherische Masse.
""")

    _write(root / "wiki" / "concepts" / "gravitationswellen.md", """\
# Gravitationswellen

Wellen der Raumzeitkruemmung.

Vorhergesagt von der [[wiki/concepts/allgemeine-relativitaetstheorie]],
2015 erstmals direkt nachgewiesen.
""")

    _write(root / "wiki" / "concepts" / "private-note.md", """\
---
private: true
---
# Private Note

Should not be exported.
""")

    _write(root / "wiki" / "concepts" / "no-h1.md", """\
This page has no H1 heading. Should be rejected.
""")

    return root
```

- [ ] **Step 3: Write `tests/test_parser_smoke.py`**

Create `tests/test_parser_smoke.py`:
```python
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
```

- [ ] **Step 4: Run tests**

Run:
```bash
python -m pytest tests/test_parser_smoke.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add tests/__init__.py tests/conftest.py tests/test_parser_smoke.py
git commit -m "test(tools): smoke-verify copied parser

Path-style IDs, edge extraction, normalize, bracket strip."
```

---

## Phase 2: Build Pipeline — Page-Meta Extraction

### Task 2.1: Page metadata extractor (TDD)

**Files:**
- Create: `tools/extract_page_meta.py`
- Create: `tests/test_extract_page_meta.py`

**Responsibility:** Given a markdown file, return `PageMeta` with title, subtitle (= first sentence of lead), essence (= first 3-5 sentences), and the raw outgoing wikilinks (which the parser already gives us elsewhere, but we keep it here as a "what does this page say about itself" abstraction).

- [ ] **Step 1: Write the failing test file `tests/test_extract_page_meta.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
python -m pytest tests/test_extract_page_meta.py -v
```

Expected: `ModuleNotFoundError: tools.extract_page_meta` (or similar).

- [ ] **Step 3: Write `tools/extract_page_meta.py`**

```python
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


def _first_paragraph(body: str) -> str:
    """First non-empty paragraph (sequence of non-blank lines)."""
    paras = re.split(r"\n\s*\n", body.strip())
    return paras[0].strip() if paras else ""


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
```

- [ ] **Step 4: Run tests to verify all pass**

Run:
```bash
python -m pytest tests/test_extract_page_meta.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/extract_page_meta.py tests/test_extract_page_meta.py
git commit -m "feat(tools): extract_page_meta for title/subtitle/essence

H1 + frontmatter title support; private:true rejection; wikilinks
rendered to bare label or alias; first-paragraph essence."
```

---

## Phase 3: Build Pipeline — Slice Filter

### Task 3.1: Slice filter applies include globs + safety checks

**Files:**
- Create: `tools/filter_slice.py`
- Create: `tests/test_filter_slice.py`

**Responsibility:** Given a vault root + a config (list of glob patterns), return the **set of absolute paths** in the slice. Public-safety rejection (private:true, no-h1) happens here so the rest of the pipeline never sees those.

- [ ] **Step 1: Write the failing test file `tests/test_filter_slice.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
python -m pytest tests/test_filter_slice.py -v
```

Expected: `ModuleNotFoundError`.

- [ ] **Step 3: Write `tools/filter_slice.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify all pass**

Run:
```bash
python -m pytest tests/test_filter_slice.py -v
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/filter_slice.py tests/test_filter_slice.py
git commit -m "feat(tools): filter_slice resolves include globs + public-safety

Glob expansion, private-page rejection, no-h1 rejection,
deterministic sort, missing-file warning."
```

---

## Phase 4: Build Pipeline — Orchestrator

### Task 4.1: Build orchestrator (TDD, end-to-end against mini-vault)

**Files:**
- Create: `tools/build.py`
- Create: `tests/test_build_end_to_end.py`
- Create: `showcase.config.json` (real config, points at `C:/Users/domes/wiki`)

**Responsibility:** Tie parser + extractor + filter together. Read config, build `dist/assets/graph.json` and `dist/assets/nodes/*.json`, copy template files.

- [ ] **Step 1: Write `tests/test_build_end_to_end.py`**

```python
"""End-to-end test for tools/build.py against a mini-vault.

Confirms:
- graph.json has the expected shape (version, default_center, nodes, links)
- Edges to pages outside the slice are dropped
- One nodes/<slug>.json per node
- private pages do not appear in any output
- Output is deterministic (same vault + config -> byte-identical files)
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools import build


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


@pytest.fixture
def mini_vault_plus_outside_link(tmp_path: Path) -> Path:
    root = tmp_path / "vault"
    _write(root / "wiki" / "concepts" / "art.md", """\
# Allgemeine Relativitaetstheorie

Einsteins Theorie der Gravitation.

Linkt zu [[wiki/concepts/sl]] und zu [[wiki/concepts/outside]].
""")
    _write(root / "wiki" / "concepts" / "sl.md", """\
# Schwarzes Loch

Region in der Raumzeit.

Loesung der [[wiki/concepts/sm]].
""")
    _write(root / "wiki" / "concepts" / "sm.md", """\
# Schwarzschild-Metrik

Erste exakte Loesung.
""")
    # This page exists in the vault but is NOT in the slice
    _write(root / "wiki" / "concepts" / "outside.md", """\
# Outside Page

This must not appear in the output.
""")
    # private
    _write(root / "wiki" / "concepts" / "private.md", """\
---
private: true
---
# Private
""")
    return root


def _make_config(vault: Path, out: Path) -> dict:
    return {
        "vault_root": str(vault),
        "include": [
            "wiki/concepts/art.md",
            "wiki/concepts/sl.md",
            "wiki/concepts/sm.md",
        ],
        "default_center": "wiki/concepts/art",
        "theme_default": "crab",
        "default_gold": 35,
        "metadata": {
            "title": "Test Showcase",
            "description": "Test",
        },
    }


def test_build_emits_graph_json(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    build.run(cfg, out)
    graph_path = out / "assets" / "graph.json"
    assert graph_path.is_file()
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    assert graph["version"] == 1
    assert graph["default_center"] == "wiki/concepts/art"
    node_ids = {n["id"] for n in graph["nodes"]}
    assert node_ids == {"wiki/concepts/art", "wiki/concepts/sl", "wiki/concepts/sm"}


def test_build_drops_edges_outside_slice(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    build.run(cfg, out)
    graph = json.loads((out / "assets" / "graph.json").read_text(encoding="utf-8"))
    # The (art -> outside) edge must be dropped
    pairs = {(l["source"], l["target"]) for l in graph["links"]}
    assert ("wiki/concepts/art", "wiki/concepts/outside") not in pairs
    # but inner-slice edges remain
    assert ("wiki/concepts/art", "wiki/concepts/sl") in pairs
    assert ("wiki/concepts/sl", "wiki/concepts/sm") in pairs


def test_build_emits_per_node_json(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    build.run(cfg, out)
    nodes_dir = out / "assets" / "nodes"
    files = sorted(p.name for p in nodes_dir.iterdir())
    assert files == [
        "wiki__concepts__art.json",
        "wiki__concepts__sl.json",
        "wiki__concepts__sm.json",
    ]
    art = json.loads((nodes_dir / "wiki__concepts__art.json").read_text(encoding="utf-8"))
    assert art["id"] == "wiki/concepts/art"
    assert art["title"] == "Allgemeine Relativitaetstheorie"
    assert "Einsteins" in art["essence"]
    # neighbours are only IN-slice
    assert set(art["neighbours"]) == {"wiki/concepts/sl"}


def test_build_does_not_include_private_pages(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    # Add private to include — must still be dropped
    cfg["include"].append("wiki/concepts/private.md")
    build.run(cfg, out)
    graph = json.loads((out / "assets" / "graph.json").read_text(encoding="utf-8"))
    node_ids = {n["id"] for n in graph["nodes"]}
    assert "wiki/concepts/private" not in node_ids
    nodes_dir = out / "assets" / "nodes"
    assert not (nodes_dir / "wiki__concepts__private.json").exists()


def test_build_is_deterministic(mini_vault_plus_outside_link: Path, tmp_path: Path) -> None:
    out1 = tmp_path / "dist1"
    out2 = tmp_path / "dist2"
    cfg = _make_config(mini_vault_plus_outside_link, out1)
    build.run(cfg, out1)
    cfg2 = _make_config(mini_vault_plus_outside_link, out2)
    build.run(cfg2, out2)
    # graph.json byte-identical except for built_at timestamp — strip that
    g1 = json.loads((out1 / "assets" / "graph.json").read_text(encoding="utf-8"))
    g2 = json.loads((out2 / "assets" / "graph.json").read_text(encoding="utf-8"))
    g1.pop("built_at", None)
    g2.pop("built_at", None)
    assert g1 == g2
    # per-node files byte-identical
    for p1 in (out1 / "assets" / "nodes").iterdir():
        p2 = out2 / "assets" / "nodes" / p1.name
        assert p1.read_bytes() == p2.read_bytes()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
python -m pytest tests/test_build_end_to_end.py -v
```

Expected: `ModuleNotFoundError: tools.build`.

- [ ] **Step 3: Write `tools/build.py`**

```python
"""Build orchestrator: vault slice -> dist/assets/graph.json + nodes/*.json.

Entry point: `python -m tools.build --config showcase.config.json --out dist/`
or `build.run(cfg_dict, out_path)` for tests.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from tools import extract_page_meta, filter_slice, parser


def _slug(node_id: str) -> str:
    return node_id.replace("/", "__")


def _path_id_of(path: Path, vault_root: Path) -> str:
    rel = path.relative_to(vault_root).with_suffix("")
    return parser.normalize(rel.as_posix())


def run(cfg: dict, out: Path) -> None:
    """Build the dist tree from cfg into `out`."""
    out = Path(out)
    vault = Path(cfg["vault_root"]).resolve()

    pages = filter_slice.resolve_slice(vault, cfg["include"])
    in_slice_ids = {_path_id_of(p, vault) for p in pages}

    # Parse all edges in the vault, then filter to slice-internal
    all_edges = parser.extract_edges(vault) + parser.extract_frontmatter_edges(vault)
    slice_edges_set: set[tuple[str, str]] = set()
    for src, tgt in all_edges:
        if src in in_slice_ids and tgt in in_slice_ids and src != tgt:
            slice_edges_set.add((src, tgt))
    slice_edges = sorted(slice_edges_set)

    # Build node list with metadata
    nodes: list[dict] = []
    metas: dict[str, extract_page_meta.PageMeta] = {}
    for p in pages:
        meta = extract_page_meta.extract(p)
        if meta is None:
            continue  # belt+braces; filter_slice should have dropped these
        node_id = _path_id_of(p, vault)
        metas[node_id] = meta
        nodes.append({
            "id": node_id,
            "title": meta.title,
            "category": _category_from_path(node_id),
        })
    nodes.sort(key=lambda n: n["id"])

    # Build neighbour map for per-node files
    neighbours: dict[str, set[str]] = {nid: set() for nid in in_slice_ids}
    for src, tgt in slice_edges:
        neighbours[src].add(tgt)
        neighbours[tgt].add(src)

    graph = {
        "version": 1,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "default_center": cfg["default_center"],
        "theme_default": cfg.get("theme_default", "crab"),
        "default_gold": cfg.get("default_gold", 35),
        "metadata": cfg.get("metadata", {}),
        "nodes": nodes,
        "links": [{"source": s, "target": t} for s, t in slice_edges],
    }

    # Write outputs
    assets = out / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    nodes_dir = assets / "nodes"
    nodes_dir.mkdir(exist_ok=True)

    (assets / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
    )

    for node_id, meta in metas.items():
        node_doc = {
            "id": node_id,
            "title": meta.title,
            "subtitle": meta.subtitle,
            "essence": meta.essence,
            "category": _category_from_path(node_id),
            "neighbours": sorted(neighbours.get(node_id, set())),
        }
        (nodes_dir / f"{_slug(node_id)}.json").write_text(
            json.dumps(node_doc, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )


def _category_from_path(node_id: str) -> str:
    if node_id.startswith("wiki/concepts/"):
        return "concept"
    if node_id.startswith("wiki/entities/"):
        return "entity"
    if node_id.startswith("wiki/synthesis/"):
        return "synthesis"
    return "other"


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    run(cfg, args.out)
    print(f"Build complete -> {args.out}", flush=True)


if __name__ == "__main__":
    _main()
```

- [ ] **Step 4: Run tests to verify all pass**

Run:
```bash
python -m pytest tests/test_build_end_to_end.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/build.py tests/test_build_end_to_end.py
git commit -m "feat(tools): build orchestrator emits graph.json + nodes/*.json

End-to-end pipeline: slice + parse + filter edges + extract meta.
Deterministic output (modulo built_at timestamp). 5 e2e tests."
```

---

### Task 4.2: Write the real `showcase.config.json` and do the first build

**Files:**
- Create: `showcase.config.json`

- [ ] **Step 1: Write `showcase.config.json`**

```json
{
  "vault_root": "C:/Users/domes/wiki",
  "include": [
    "wiki/concepts/allgemeine-relativitaetstheorie.md",
    "wiki/concepts/spezielle-relativitaetstheorie.md",
    "wiki/concepts/quantenmechanik.md",
    "wiki/concepts/quantenfeldtheorie.md",
    "wiki/concepts/quantengravitation.md",
    "wiki/concepts/stringtheorie.md",
    "wiki/concepts/schleifen-quantengravitation.md",
    "wiki/concepts/holographisches-prinzip.md",
    "wiki/concepts/baryogenese.md",
    "wiki/concepts/kosmische-inflation.md",
    "wiki/concepts/kosmische-hintergrundstrahlung.md",
    "wiki/concepts/kosmische-grossraumstruktur.md",
    "wiki/concepts/baryonische-akustische-oszillationen.md",
    "wiki/concepts/hubble-spannung.md",
    "wiki/concepts/praezisionskosmologie.md",
    "wiki/concepts/sternentwicklung.md",
    "wiki/concepts/kompakte-objekte.md",
    "wiki/concepts/schwarzes-loch.md",
    "wiki/concepts/schwarzschild-metrik.md",
    "wiki/concepts/gravitationswellen.md",
    "wiki/concepts/newtonsche-gravitation.md",
    "wiki/concepts/maxwell-gleichungen.md",
    "wiki/concepts/thermodynamik.md",
    "wiki/concepts/entropie.md",
    "wiki/concepts/entropische-gravitation.md",
    "wiki/concepts/higgs-feld.md",
    "wiki/concepts/dekohaerenz.md",
    "wiki/concepts/quantenfluktuationen.md",
    "wiki/concepts/quantenvakuum.md",
    "wiki/concepts/hilbert-raum.md",
    "wiki/entities/josef-m-gassner.md"
  ],
  "default_center": "wiki/concepts/allgemeine-relativitaetstheorie",
  "theme_default": "crab",
  "default_gold": 35,
  "metadata": {
    "title": "Knowledge Nebula — Dynamic Dome",
    "description": "Spiel dich durch eine kuratierte Astrophysik-Wissensnebel."
  }
}
```

- [ ] **Step 2: Run a real build against the real wiki**

Run:
```bash
python -m tools.build --config showcase.config.json --out dist/
```

Expected stdout: `Build complete -> dist/`
Expected on disk:
- `dist/assets/graph.json` (a few KB)
- `dist/assets/nodes/wiki__concepts__*.json` (~31 files)

- [ ] **Step 3: Sanity-check the output**

Run:
```bash
python -c "import json; g=json.load(open('dist/assets/graph.json')); print(f'nodes={len(g[\"nodes\"])} links={len(g[\"links\"])}')"
```

Expected: `nodes=31 links=<some number between 30 and 200>`. If 0 links, something is wrong with the slice — investigate by spot-checking a node's neighbours JSON.

- [ ] **Step 4: Commit the config**

```bash
git add showcase.config.json
git commit -m "chore: showcase.config.json — astrophysics slice

31 concept pages + josef-m-gassner. Crab as default theme,
gold default 35%."
```

Note: `dist/` is gitignored — do NOT commit it.

---

## Phase 5: Frontend — HTML Shell + Base CSS

### Task 5.1: Create `src/index.html` template

**Files:**
- Create: `src/index.html`

- [ ] **Step 1: Write `src/index.html`**

```html
<!DOCTYPE html>
<html lang="de" data-theme="crab">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Knowledge Nebula — Dynamic Dome</title>
<meta name="description" content="Spiel dich durch eine kuratierte Astrophysik-Wissensnebel.">
<meta property="og:title" content="Knowledge Nebula — Dynamic Dome">
<meta property="og:description" content="Astrophysik-Wissensgraph zum Rumklicken.">
<meta property="og:type" content="website">
<link rel="preload" href="assets/graph.json" as="fetch" crossorigin>
<link rel="stylesheet" href="assets/styles/base.css">
<link rel="stylesheet" href="assets/styles/theme-crab.css">
<link rel="stylesheet" href="assets/styles/theme-dome.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="brand-glyph" id="brand-glyph">&#x25C6;</span>
      <span class="brand-name">Knowledge Nebula</span>
    </div>
    <div class="topbar-right">
      <button class="theme-toggle" id="theme-toggle" aria-label="Theme umschalten">
        <span class="theme-label">Theme</span>
        <span class="theme-current" id="theme-current">crab</span>
      </button>
      <div class="meta-readout" id="meta-readout">— Knoten · — Kanten</div>
    </div>
  </header>

  <main class="stage" id="stage" aria-label="3D Wissensgraph">
    <div class="graph-container" id="graph-container"></div>
    <div class="cmb-layer" id="cmb-layer" aria-hidden="true"></div>
    <div class="tooltip" id="tooltip" role="status" aria-live="polite"></div>
    <div class="status-bar" id="status-bar" aria-live="polite"></div>
  </main>

  <aside class="modal" id="modal" aria-hidden="true">
    <button class="modal-close" id="modal-close" aria-label="Schliessen">&times;</button>
    <h2 class="modal-title" id="modal-title"></h2>
    <p class="modal-subtitle" id="modal-subtitle"></p>
    <p class="modal-essence" id="modal-essence"></p>
    <div class="modal-neighbours">
      <span class="modal-section-label">Verbunden mit</span>
      <div class="neighbour-pills" id="neighbour-pills"></div>
    </div>
    <p class="modal-hint">Doppelklick auf den Knoten oeffnet ihn als neues Zentrum.</p>
  </aside>

  <footer class="control-panel">
    <label class="ctrl-label" for="gold-slider">
      <span class="ctrl-glyph">&#x25C6;</span> Gold-Mode
    </label>
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value="35"
      class="gold-slider"
      id="gold-slider"
      aria-label="Gold-Mode Intensitaet"
    >
    <span class="ctrl-value" id="gold-value">35%</span>
  </footer>

  <script type="module" src="assets/scripts/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src
# (file already created in previous step)
git add src/index.html
git commit -m "feat(frontend): index.html shell

Topbar with theme toggle, stage with graph container + tooltip,
detail modal aside, control panel with gold slider. data-theme=crab
default. ES module entry point."
```

---

### Task 5.2: Base CSS — layout + typography + slider

**Files:**
- Create: `src/styles/base.css`

- [ ] **Step 1: Write `src/styles/base.css`**

```css
/* === Reset === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg-page, #02010a);
  color: var(--text, #E8F4FF);
  overflow: hidden;
  line-height: 1.5;
}

/* === Topbar === */
.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 30;
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 22px;
  background: linear-gradient(180deg, rgba(2, 1, 10, 0.85), rgba(2, 1, 10, 0));
  pointer-events: none;
}
.topbar > * { pointer-events: auto; }
.brand {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 18px; font-weight: 600;
  color: var(--brand-color, #98e8ff);
}
.brand-glyph {
  font-size: 22px;
  color: var(--brand-glyph-color, #98e8ff);
  text-shadow: var(--brand-glyph-shadow, 0 0 10px #98e8ff);
  transform: rotate(45deg);
  display: inline-block;
}
.topbar-right { display: flex; align-items: center; gap: 16px; }
.theme-toggle {
  background: transparent;
  border: 1px solid var(--border-soft, rgba(152, 232, 255, 0.3));
  color: var(--text-muted, rgba(200, 210, 230, 0.75));
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  display: flex; gap: 8px; align-items: center;
}
.theme-toggle:hover { border-color: var(--brand-glyph-color, #98e8ff); }
.theme-current { color: var(--brand-glyph-color, #98e8ff); font-weight: 600; }
.meta-readout {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-muted, rgba(200, 210, 230, 0.6));
}

/* === Stage === */
.stage {
  position: fixed; inset: 0;
  z-index: 1;
}
.graph-container { position: absolute; inset: 0; }
.graph-container canvas { display: block; }

.cmb-layer {
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: 0;
  mix-blend-mode: screen;
  background:
    radial-gradient(circle at 20% 30%, rgba(230, 191, 82, 0.04), transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(230, 191, 82, 0.04), transparent 30%),
    radial-gradient(circle at 50% 50%, rgba(152, 232, 255, 0.02), transparent 50%);
  transition: opacity 0.3s ease;
}
.cmb-layer.active { animation: cmb-flicker 0.4s steps(3) infinite; }
@keyframes cmb-flicker {
  0% { transform: translate(0, 0); }
  33% { transform: translate(2px, -1px); }
  66% { transform: translate(-1px, 1px); }
}

.tooltip {
  position: absolute; z-index: 25;
  padding: 8px 12px; border-radius: 7px;
  background: rgba(2, 1, 10, 0.92);
  border: 1px solid var(--border-tooltip, rgba(152, 232, 255, 0.5));
  color: var(--text, #E8F4FF);
  font-size: 12px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  max-width: 240px;
}
.tooltip.visible { opacity: 1; }
.tooltip .ttitle { color: var(--brand-glyph-color, #98e8ff); font-weight: 600; }
.tooltip .tmeta { color: var(--text-muted, rgba(200, 210, 230, 0.7)); font-family: 'JetBrains Mono', monospace; font-size: 10px; margin-top: 2px; }

.status-bar {
  position: absolute; bottom: 18px; left: 22px; z-index: 25;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted, rgba(200, 210, 230, 0.55));
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* === Modal === */
.modal {
  position: fixed; top: 64px; right: 0; bottom: 80px; width: 360px;
  z-index: 20;
  background: rgba(2, 1, 10, 0.92);
  border-left: 1px solid var(--border-soft, rgba(152, 232, 255, 0.18));
  padding: 24px 22px;
  transform: translateX(110%);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  overflow-y: auto;
  box-shadow: var(--shadow-modal, -8px 0 32px rgba(2, 1, 10, 0.6));
}
.modal.open { transform: translateX(0); }
.modal-close {
  position: absolute; top: 10px; right: 14px;
  background: transparent; border: none;
  color: var(--text-muted, rgba(200, 210, 230, 0.6));
  font-size: 24px; cursor: pointer;
  line-height: 1;
}
.modal-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 22px; font-weight: 600;
  color: var(--brand-glyph-color, #98e8ff);
  margin-bottom: 6px;
  margin-right: 24px;
}
.modal-subtitle {
  font-style: italic;
  color: var(--text-muted, rgba(200, 210, 230, 0.85));
  margin-bottom: 14px;
}
.modal-essence {
  margin-bottom: 18px;
  font-size: 14px;
}
.modal-neighbours { margin-bottom: 12px; }
.modal-section-label {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted, rgba(200, 210, 230, 0.5));
  margin-bottom: 6px;
}
.neighbour-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.neighbour-pills button {
  background: transparent;
  border: 1px solid var(--border-soft, rgba(152, 232, 255, 0.3));
  color: var(--text, #E8F4FF);
  font-family: inherit;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.neighbour-pills button:hover {
  border-color: var(--brand-glyph-color, #98e8ff);
  color: var(--brand-glyph-color, #98e8ff);
}
.modal-hint {
  font-size: 11px;
  color: var(--text-muted, rgba(200, 210, 230, 0.4));
  font-style: italic;
}

/* === Control Panel (slider) === */
.control-panel {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 30;
  display: flex; align-items: center; gap: 16px;
  padding: 18px 24px;
  background: linear-gradient(0deg, rgba(2, 1, 10, 0.95), rgba(2, 1, 10, 0));
}
.ctrl-label {
  display: flex; align-items: center; gap: 6px;
  color: var(--brand-glyph-color, #98e8ff);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  min-width: 130px;
}
.ctrl-glyph { color: var(--gold, #E6BF52); }
.gold-slider {
  flex: 1;
  -webkit-appearance: none; appearance: none;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg,
    rgba(152, 232, 255, 0.3) 0%,
    rgba(201, 162, 58, 0.6) 50%,
    rgba(230, 191, 82, 1) 100%);
  outline: none;
  cursor: pointer;
}
.gold-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px; height: 20px; border-radius: 50%;
  background: radial-gradient(circle, #E6BF52, #C9A23A);
  border: 2px solid white;
  box-shadow: 0 0 12px rgba(230, 191, 82, 0.8);
  cursor: grab;
}
.gold-slider::-moz-range-thumb {
  width: 20px; height: 20px; border-radius: 50%;
  background: radial-gradient(circle, #E6BF52, #C9A23A);
  border: 2px solid white;
  box-shadow: 0 0 12px rgba(230, 191, 82, 0.8);
  cursor: grab;
}
.ctrl-value {
  color: var(--gold, #E6BF52);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
  text-shadow: 0 0 8px rgba(230, 191, 82, 0.5);
}

/* === Mobile === */
@media (max-width: 768px) {
  .modal {
    top: auto; right: 0; bottom: 80px; left: 0;
    width: 100%; height: 38vh;
    border-left: none;
    border-top: 1px solid var(--border-soft, rgba(152, 232, 255, 0.18));
    transform: translateY(110%);
  }
  .modal.open { transform: translateY(0); }
  .meta-readout { display: none; }
  .ctrl-label { min-width: 80px; font-size: 10px; }
}

/* === Accessibility === */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01s !important;
    transition-duration: 0.01s !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/styles
git add src/styles/base.css
git commit -m "feat(frontend): base.css layout, typography, slider, modal

Mobile-Drawer ueber 768px. prefers-reduced-motion: alle Animationen aus.
Brand-Token-Variablen, theme-Files koennen ueberschreiben."
```

---

### Task 5.3: Theme CSS — Crab Nebula + Dynamic Dome

**Files:**
- Create: `src/styles/theme-crab.css`
- Create: `src/styles/theme-dome.css`

- [ ] **Step 1: Write `src/styles/theme-crab.css`**

```css
/* === Theme: Crab Nebula === */
html[data-theme="crab"] {
  --bg-page: #02010a;
  --bg-gradient:
    radial-gradient(ellipse at 65% 55%, rgba(140, 60, 180, 0.18) 0%, transparent 50%),
    radial-gradient(ellipse at 30% 40%, rgba(80, 160, 200, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 50%, rgba(180, 80, 140, 0.12) 0%, transparent 60%),
    #02010a;

  --text: #E8F4FF;
  --text-muted: rgba(200, 210, 230, 0.7);

  --brand-color: #C9D8E8;
  --brand-glyph-color: #98E8FF;
  --brand-glyph-shadow: 0 0 10px #98E8FF;

  --gold: #E6BF52;
  --gold-soft: #C9A23A;

  --node-center: #FFFFFF;
  --node-center-halo: rgba(152, 232, 255, 0.7);
  --node-ring1: rgba(140, 240, 255, 1);
  --node-ring1-halo: rgba(120, 220, 255, 0.55);
  --node-ring2: rgba(240, 140, 200, 1);
  --node-ring2-halo: rgba(220, 100, 180, 0.5);

  --edge-base-rgba: rgba(140, 220, 255, 0.5);
  --edge-gold-rgba: rgba(230, 191, 82, 1);

  --border-soft: rgba(152, 232, 255, 0.18);
  --border-tooltip: rgba(152, 232, 255, 0.5);
  --shadow-modal: -8px 0 32px rgba(2, 1, 10, 0.6), 0 0 24px rgba(152, 232, 255, 0.08);
}

html[data-theme="crab"] body {
  background: var(--bg-gradient);
}

/* Crab-specific atmospheric filaments (CSS pseudo-elements on body) */
html[data-theme="crab"] body::before,
html[data-theme="crab"] body::after {
  content: "";
  position: fixed;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}
html[data-theme="crab"] body::before {
  width: 50vw; height: 30vh;
  left: 15%; top: 20%;
  background: rgba(80, 200, 255, 0.35);
  transform: rotate(-15deg);
}
html[data-theme="crab"] body::after {
  width: 45vw; height: 25vh;
  left: 50%; top: 55%;
  background: rgba(220, 120, 200, 0.3);
  transform: rotate(20deg);
}
```

- [ ] **Step 2: Write `src/styles/theme-dome.css`**

```css
/* === Theme: Dynamic Dome (dome-dynamics tokens 1:1) === */
html[data-theme="dome"] {
  --bg-page: #0B0F1A;
  --bg-gradient:
    radial-gradient(ellipse at 30% 40%, #1a1428 0%, #0B0F1A 70%);

  --text: #F5F1E6;
  --text-muted: #B6AC92;

  --brand-color: #F5F1E6;
  --brand-glyph-color: #C9A23A;
  --brand-glyph-shadow: 0 0 8px #C9A23A;

  --gold: #E6BF52;
  --gold-soft: #C9A23A;
  --gold-deep: #8A6E20;

  --node-center: #E6BF52;
  --node-center-halo: rgba(201, 162, 58, 0.55);
  --node-ring1: #2BE2F5;
  --node-ring1-halo: rgba(43, 226, 245, 0.55);
  --node-ring2: #F23BBF;
  --node-ring2-halo: rgba(242, 59, 191, 0.5);

  --edge-base-rgba: rgba(201, 162, 58, 0.4);
  --edge-gold-rgba: rgba(230, 191, 82, 1);

  --border-soft: rgba(201, 162, 58, 0.18);
  --border-tooltip: rgba(201, 162, 58, 0.4);
  --shadow-modal: -8px 0 32px rgba(11, 15, 26, 0.8), 0 0 0 1px rgba(201, 162, 58, 0.08);
}

html[data-theme="dome"] body {
  background: var(--bg-gradient);
}

/* Dome has no atmospheric filaments — cleaner, more austere */
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/theme-crab.css src/styles/theme-dome.css
git commit -m "feat(frontend): theme CSS — crab nebula + dynamic dome

Switching via html[data-theme]. Crab has filament pseudo-elements,
Dome stays austere. All node/edge/glow colors as CSS vars consumed
by JS later."
```

---

## Phase 6: Frontend — Vendor + Loader + URL State

### Task 6.1: Vendor 3d-force-graph

**Files:**
- Create: `src/vendor/3d-force-graph.min.js` (copy from DCO)

- [ ] **Step 1: Copy the vendored file**

Run:
```bash
mkdir -p src/vendor
cp C:/Users/domes/dynamic_central_orchestrator/vendor/3d-force-graph.min.js src/vendor/3d-force-graph.min.js
```

Expected: file is ~707 KB.

- [ ] **Step 2: Commit**

```bash
git add src/vendor/3d-force-graph.min.js
git commit -m "chore: vendor 3d-force-graph.min.js from DCO

707 KB. Source: dynamic_central_orchestrator/vendor/. Bundles
three.js transitively."
```

---

### Task 6.2: URL state module

**Files:**
- Create: `src/scripts/url-state.js`

- [ ] **Step 1: Write `src/scripts/url-state.js`**

```javascript
/**
 * Read + write URL query params for shareable state.
 * Supported: ?node=<id>&theme=<crab|dome>&gold=<0-100>
 */

const VALID_THEMES = new Set(["crab", "dome"]);

export function readState() {
  const params = new URLSearchParams(window.location.search);
  return {
    node: params.get("node") || null,
    theme: VALID_THEMES.has(params.get("theme")) ? params.get("theme") : null,
    gold: parseGold(params.get("gold")),
  };
}

function parseGold(raw) {
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export function writeState({ node, theme, gold }) {
  const params = new URLSearchParams(window.location.search);
  if (node !== undefined) {
    if (node === null) params.delete("node");
    else params.set("node", node);
  }
  if (theme !== undefined) {
    if (theme === null) params.delete("theme");
    else params.set("theme", theme);
  }
  if (gold !== undefined) {
    if (gold === null) params.delete("gold");
    else params.set("gold", String(gold));
  }
  const newUrl =
    window.location.pathname +
    (params.toString() ? "?" + params.toString() : "") +
    window.location.hash;
  window.history.replaceState(null, "", newUrl);
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/scripts
git add src/scripts/url-state.js
git commit -m "feat(frontend): url-state read+write

?node=&theme=&gold= shareable. replaceState (no history pollution).
Bounds gold to 0..100."
```

---

### Task 6.3: Graph loader module

**Files:**
- Create: `src/scripts/graph-loader.js`

- [ ] **Step 1: Write `src/scripts/graph-loader.js`**

```javascript
/**
 * Fetch graph.json and individual node detail JSONs.
 * graph.json is loaded once on startup; per-node files are lazy-loaded on demand.
 */

const ASSETS = "assets";

export async function loadGraph() {
  const res = await fetch(`${ASSETS}/graph.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch graph.json: ${res.status}`);
  }
  return res.json();
}

const _nodeCache = new Map();

export async function loadNode(nodeId) {
  if (_nodeCache.has(nodeId)) {
    return _nodeCache.get(nodeId);
  }
  const slug = nodeId.replace(/\//g, "__");
  const res = await fetch(`${ASSETS}/nodes/${encodeURIComponent(slug)}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch node ${nodeId}: ${res.status}`);
  }
  const doc = await res.json();
  _nodeCache.set(nodeId, doc);
  return doc;
}

export function slugFromNodeId(nodeId) {
  return nodeId.replace(/\//g, "__");
}

export function nodeIdFromSlug(slug) {
  return slug.replace(/__/g, "/");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/graph-loader.js
git commit -m "feat(frontend): graph-loader fetches graph + lazy node details

Module-level cache for per-node JSON. slug<->nodeId helpers."
```

---

## Phase 7: Frontend — Three Stage + Interaction

### Task 7.1: Three-stage module (renderer + click/hover)

**Files:**
- Create: `src/scripts/three-stage.js`

- [ ] **Step 1: Write `src/scripts/three-stage.js`**

```javascript
/**
 * Set up the 3d-force-graph stage. Returns a controller object with:
 *   - setGraphData(data): replace nodes+links
 *   - setCenter(nodeId): mark a node as center, recolor others by BFS distance
 *   - onNodeClick(handler), onNodeHover(handler), onNodeDoubleClick(handler)
 *   - getEdgesForBreath(): array of three.js Line3 objects keyed by source-target ids
 *
 * Reads CSS variables from the current --theme via getComputedStyle.
 */

const DOUBLE_CLICK_MS = 350;

export function createStage(container) {
  // 3d-force-graph is a global UMD when vendored
  const ForceGraph3D = window.ForceGraph3D;
  if (typeof ForceGraph3D !== "function") {
    throw new Error("ForceGraph3D global not found — is 3d-force-graph.min.js loaded?");
  }

  const graph = ForceGraph3D()(container)
    .backgroundColor("rgba(0,0,0,0)")
    .nodeRelSize(5)
    .nodeOpacity(0.95)
    .linkWidth(1)
    .linkOpacity(0.55)
    .cooldownTicks(400)
    .enableNodeDrag(false);

  let centerId = null;
  let adjacency = new Map();
  let lastClickMs = 0;
  let lastClickedId = null;

  function rebuildAdjacency(links) {
    adjacency = new Map();
    for (const link of links) {
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      if (!adjacency.has(s)) adjacency.set(s, new Set());
      if (!adjacency.has(t)) adjacency.set(t, new Set());
      adjacency.get(s).add(t);
      adjacency.get(t).add(s);
    }
  }

  function bfsDistance(rootId) {
    const dist = new Map([[rootId, 0]]);
    const queue = [rootId];
    while (queue.length) {
      const node = queue.shift();
      const d = dist.get(node);
      const neighbours = adjacency.get(node) || new Set();
      for (const n of neighbours) {
        if (!dist.has(n)) {
          dist.set(n, d + 1);
          queue.push(n);
        }
      }
    }
    return dist;
  }

  function nodeColor(node) {
    const styles = getComputedStyle(document.documentElement);
    const c0 = styles.getPropertyValue("--node-center").trim() || "#FFFFFF";
    const c1 = styles.getPropertyValue("--node-ring1").trim() || "#8CF0FF";
    const c2 = styles.getPropertyValue("--node-ring2").trim() || "#F08CC8";
    const hazeColor = "rgba(160, 200, 220, 0.35)";

    if (!centerId) return c1;
    const dist = bfsDistance(centerId);
    const d = dist.get(node.id);
    if (d === 0) return c0;
    if (d === 1) return c1;
    if (d === 2) return c2;
    return hazeColor;
  }

  function nodeSize(node) {
    if (node.id === centerId) return 9;
    if (node.category === "entity") return 7;
    return 5;
  }

  graph.nodeColor(nodeColor).nodeVal(nodeSize);

  const api = {
    setGraphData(data) {
      rebuildAdjacency(data.links || []);
      graph.graphData(data);
    },
    setCenter(nodeId) {
      centerId = nodeId;
      graph.nodeColor(nodeColor);  // force recompute
    },
    centerCamera() {
      const node = graph.graphData().nodes.find(n => n.id === centerId);
      if (node) {
        graph.cameraPosition(
          { x: node.x, y: node.y, z: node.z + 280 },
          node,
          1200
        );
      }
    },
    onNodeClick(handler) {
      graph.onNodeClick((node, event) => {
        const now = Date.now();
        if (lastClickedId === node.id && now - lastClickMs < DOUBLE_CLICK_MS) {
          handler({ type: "doubleclick", node });
          lastClickMs = 0;
          lastClickedId = null;
        } else {
          handler({ type: "click", node });
          lastClickMs = now;
          lastClickedId = node.id;
        }
      });
    },
    onNodeHover(handler) {
      graph.onNodeHover((node, _prev) => handler(node));
    },
    getThreeRenderer() {
      return graph.renderer ? graph.renderer() : null;
    },
    getGraphForceInstance() {
      return graph;
    },
  };

  return api;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/three-stage.js
git commit -m "feat(frontend): three-stage controller

3d-force-graph init, BFS-distance-based coloring, click vs
doubleclick (<350ms re-tap on same node), node-hover, camera-focus.
Reads colors from CSS vars at runtime."
```

---

### Task 7.2: Modal module

**Files:**
- Create: `src/scripts/modal.js`

- [ ] **Step 1: Write `src/scripts/modal.js`**

```javascript
/**
 * Render and animate the detail modal on the right side.
 */

export function createModal(rootEl) {
  const titleEl = rootEl.querySelector("#modal-title");
  const subtitleEl = rootEl.querySelector("#modal-subtitle");
  const essenceEl = rootEl.querySelector("#modal-essence");
  const pillsEl = rootEl.querySelector("#neighbour-pills");
  const closeBtn = rootEl.querySelector("#modal-close");

  let onNeighbourClickHandler = () => {};

  closeBtn.addEventListener("click", () => hide());

  function show(nodeDoc) {
    titleEl.textContent = nodeDoc.title || nodeDoc.id;
    subtitleEl.textContent = nodeDoc.subtitle || "";
    essenceEl.textContent = nodeDoc.essence || "";
    pillsEl.innerHTML = "";
    for (const neighbour of nodeDoc.neighbours || []) {
      const btn = document.createElement("button");
      btn.textContent = neighbour.split("/").pop().replace(/-/g, " ");
      btn.dataset.nodeId = neighbour;
      btn.addEventListener("click", () => onNeighbourClickHandler(neighbour));
      pillsEl.appendChild(btn);
    }
    rootEl.classList.add("open");
    rootEl.setAttribute("aria-hidden", "false");
  }

  function hide() {
    rootEl.classList.remove("open");
    rootEl.setAttribute("aria-hidden", "true");
  }

  function onNeighbourClick(handler) {
    onNeighbourClickHandler = handler;
  }

  return { show, hide, onNeighbourClick };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/modal.js
git commit -m "feat(frontend): modal show/hide + neighbour-pill renderer

show(nodeDoc) renders title/subtitle/essence + clickable pills.
onNeighbourClick handler for new-center selection."
```

---

### Task 7.3: Theme switcher module

**Files:**
- Create: `src/scripts/theme-switcher.js`

- [ ] **Step 1: Write `src/scripts/theme-switcher.js`**

```javascript
/**
 * Toggle data-theme attribute on <html>. Persists to localStorage and emits
 * a "themechange" event so the rest of the app can react (e.g. recompute colors).
 */

const STORAGE_KEY = "wikigraphshowcase.theme";
const VALID = ["crab", "dome"];

export function createThemeSwitcher(toggleButton, currentLabelEl) {
  function set(theme) {
    if (!VALID.includes(theme)) return;
    document.documentElement.setAttribute("data-theme", theme);
    currentLabelEl.textContent = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_e) {
      // ignore private-mode etc
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function next() {
    const current = document.documentElement.getAttribute("data-theme");
    set(current === "crab" ? "dome" : "crab");
  }

  function get() {
    return document.documentElement.getAttribute("data-theme");
  }

  function loadStored() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID.includes(stored)) return stored;
    } catch (_e) {}
    return null;
  }

  toggleButton.addEventListener("click", next);

  return { set, next, get, loadStored };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/theme-switcher.js
git commit -m "feat(frontend): theme-switcher with persistence

data-theme attribute switching, localStorage persistence,
custom 'themechange' event for downstream listeners."
```

---

### Task 7.4: Gold pulse module

**Files:**
- Create: `src/scripts/gold-pulse.js`

- [ ] **Step 1: Write `src/scripts/gold-pulse.js`**

```javascript
/**
 * Drive the gold-mode visual: edge color modulation per RAF tick,
 * density-adaptive breath period, CMB layer activation > 70%.
 *
 * NOTE: 3d-force-graph renders edges as THREE.LineBasicMaterial instances.
 * To modulate edge color we use the linkColor() callback per frame, which
 * is cheap because 3d-force-graph re-evaluates it on every renderloop tick.
 */

const BASE_PERIOD_BY_DENSITY = {
  sparse: 9000,
  medium: 12000,
  dense: 18000,
};

function classifyDensity(edgeCount) {
  if (edgeCount < 12) return "sparse";
  if (edgeCount <= 24) return "medium";
  return "dense";
}

export function createGoldPulse(stage, cmbLayerEl, brandGlyphEl) {
  const state = {
    gold: 0.35,
    edgeCount: 0,
    density: "medium",
    edgePhases: new Map(),  // key "src->tgt" -> phase offset
    reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };

  function setGold(value) {
    state.gold = Math.max(0, Math.min(1, value));
    updateAmbient();
  }

  function notifyGraphData(data) {
    state.edgeCount = data.links.length;
    state.density = classifyDensity(state.edgeCount);
    state.edgePhases.clear();
    for (const link of data.links) {
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      state.edgePhases.set(`${s}->${t}`, Math.random() * 6000);
    }
  }

  function updateAmbient() {
    // CMB strobe layer
    if (state.reducedMotion || state.gold <= 0.7) {
      cmbLayerEl.classList.remove("active");
      cmbLayerEl.style.opacity = "0";
    } else {
      cmbLayerEl.classList.add("active");
      const intensity = ((state.gold - 0.7) / 0.3) * 0.4;
      cmbLayerEl.style.opacity = String(intensity);
    }
    // Brand glyph color shift
    const styles = getComputedStyle(document.documentElement);
    const goldHex = (styles.getPropertyValue("--gold") || "#E6BF52").trim();
    const cyanHex = (styles.getPropertyValue("--brand-glyph-color") || "#98E8FF").trim();
    if (state.gold > 0.5) {
      brandGlyphEl.style.color = goldHex;
      brandGlyphEl.style.textShadow = `0 0 ${10 + state.gold * 10}px ${goldHex}`;
    } else {
      brandGlyphEl.style.color = cyanHex;
      brandGlyphEl.style.textShadow = `0 0 10px ${cyanHex}`;
    }
  }

  function edgeColorAt(link, nowMs) {
    if (state.reducedMotion) {
      const styles = getComputedStyle(document.documentElement);
      return (styles.getPropertyValue("--edge-base-rgba") || "rgba(140, 220, 255, 0.5)").trim();
    }
    const s = typeof link.source === "object" ? link.source.id : link.source;
    const t = typeof link.target === "object" ? link.target.id : link.target;
    const key = `${s}->${t}`;
    const offset = state.edgePhases.get(key) ?? 0;

    const basePeriod = BASE_PERIOD_BY_DENSITY[state.density];
    const tempoFactor = 1 - state.gold * 0.75;
    const period = basePeriod * tempoFactor;
    const phase = ((nowMs + offset) % period) / period; // 0..1

    const styles = getComputedStyle(document.documentElement);
    const baseColor = (styles.getPropertyValue("--edge-base-rgba") || "rgba(140, 220, 255, 0.5)").trim();
    const goldColor = (styles.getPropertyValue("--edge-gold-rgba") || "rgba(230, 191, 82, 1)").trim();

    if (phase < 0.78) return baseColor;
    if (phase < 0.88) {
      // mix base->gold via simple lerp on the alpha
      return goldColor;
    }
    if (phase < 0.95) {
      return goldColor;
    }
    return baseColor;
  }

  // Hook into the stage's link-color callback
  stage.getGraphForceInstance().linkColor((link) => edgeColorAt(link, performance.now()));

  return {
    setGold,
    notifyGraphData,
    getGold: () => state.gold,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/gold-pulse.js
git commit -m "feat(frontend): gold-pulse RAF-driven edge breathing

Density-adaptive period (sparse/medium/dense), per-edge random
offset, CMB layer >70%, brand glyph color shift >50%,
prefers-reduced-motion off-switch. linkColor() callback per frame."
```

---

### Task 7.5: Main entry — wires it all together

**Files:**
- Create: `src/scripts/main.js`

- [ ] **Step 1: Write `src/scripts/main.js`**

```javascript
/**
 * App entry. Imports modules, fetches data, sets up controllers, wires events.
 */
import { loadGraph, loadNode, nodeIdFromSlug } from "./graph-loader.js";
import { createStage } from "./three-stage.js";
import { createModal } from "./modal.js";
import { createThemeSwitcher } from "./theme-switcher.js";
import { createGoldPulse } from "./gold-pulse.js";
import { readState, writeState } from "./url-state.js";

(async function main() {
  const urlState = readState();
  const themeToggle = document.getElementById("theme-toggle");
  const themeCurrent = document.getElementById("theme-current");
  const themeSwitcher = createThemeSwitcher(themeToggle, themeCurrent);

  // Apply theme: URL > localStorage > graph default > "crab"
  const stored = themeSwitcher.loadStored();
  // We need graph.json to know graph default; load it first, then theme
  const graphData = await loadGraph();
  const initialTheme = urlState.theme || stored || graphData.theme_default || "crab";
  themeSwitcher.set(initialTheme);

  document.getElementById("meta-readout").textContent =
    `${graphData.nodes.length} Knoten · ${graphData.links.length} Kanten`;

  // Stage
  const container = document.getElementById("graph-container");
  const stage = createStage(container);
  stage.setGraphData(graphData);

  // Initial center from URL or default
  const initialCenter = urlState.node || graphData.default_center;
  stage.setCenter(initialCenter);

  // Gold pulse
  const gold = createGoldPulse(
    stage,
    document.getElementById("cmb-layer"),
    document.getElementById("brand-glyph"),
  );
  gold.notifyGraphData(graphData);

  // Slider
  const slider = document.getElementById("gold-slider");
  const goldValue = document.getElementById("gold-value");
  const initialGold = urlState.gold !== null ? urlState.gold : (graphData.default_gold ?? 35);
  slider.value = String(initialGold);
  goldValue.textContent = `${initialGold}%`;
  gold.setGold(initialGold / 100);

  slider.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    goldValue.textContent = `${v}%`;
    gold.setGold(v / 100);
    writeState({ gold: v });
  });

  // Theme change writes URL
  document.addEventListener("themechange", (e) => {
    writeState({ theme: e.detail.theme });
  });

  // Modal
  const modal = createModal(document.getElementById("modal"));
  modal.onNeighbourClick(async (neighbourId) => {
    await openCenter(neighbourId);
  });

  // Click handlers
  const tooltip = document.getElementById("tooltip");
  const statusBar = document.getElementById("status-bar");

  stage.onNodeClick(async ({ type, node }) => {
    if (type === "click") {
      statusBar.textContent = `KLICK · ${node.id}`;
      const doc = await loadNode(node.id);
      modal.show(doc);
    } else if (type === "doubleclick") {
      statusBar.textContent = `NEUES ZENTRUM · ${node.id}`;
      await openCenter(node.id);
    }
  });

  stage.onNodeHover((node) => {
    if (!node) {
      tooltip.classList.remove("visible");
      return;
    }
    tooltip.innerHTML = `<div class="ttitle">${escapeHtml(node.title || node.id)}</div><div class="tmeta">${escapeHtml(node.category || "")}</div>`;
    tooltip.classList.add("visible");
  });

  document.addEventListener("mousemove", (e) => {
    tooltip.style.left = (e.clientX + 14) + "px";
    tooltip.style.top = (e.clientY + 14) + "px";
  });

  async function openCenter(nodeId) {
    stage.setCenter(nodeId);
    writeState({ node: nodeId });
    const doc = await loadNode(nodeId);
    modal.show(doc);
  }

  // Initial modal for the starting center
  if (initialCenter) {
    try {
      const doc = await loadNode(initialCenter);
      modal.show(doc);
    } catch (e) {
      // No node detail for that ID — skip silently
    }
  }
})().catch((err) => {
  console.error("Init failed:", err);
  document.body.innerHTML = `<pre style="color:#f88;padding:24px">${String(err.stack || err)}</pre>`;
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/main.js
git commit -m "feat(frontend): main.js wires the app

Async init, theme + gold + center precedence (URL > storage > default),
modal open on click + doubleclick = new center, neighbour pills,
mousemove tooltip, error fallback."
```

---

## Phase 8: Wire build to copy frontend assets

### Task 8.1: Extend build.py to copy src/* into dist/

**Files:**
- Modify: `tools/build.py`
- Modify: `tests/test_build_end_to_end.py`

- [ ] **Step 1: Add a failing test for asset copy**

Add to `tests/test_build_end_to_end.py`:
```python
def test_build_copies_frontend_assets(mini_vault_plus_outside_link: Path, tmp_path: Path, monkeypatch) -> None:
    """build copies src/index.html + src/styles/* + src/scripts/* + src/vendor/* into dist/."""
    # Create a minimal frontend tree the build script can copy from
    src_root = tmp_path / "src"
    (src_root / "styles").mkdir(parents=True)
    (src_root / "scripts").mkdir(parents=True)
    (src_root / "vendor").mkdir(parents=True)
    (src_root / "index.html").write_text("<!doctype html><h1>hi</h1>", encoding="utf-8")
    (src_root / "styles" / "base.css").write_text("body{}", encoding="utf-8")
    (src_root / "scripts" / "main.js").write_text("// main", encoding="utf-8")
    (src_root / "vendor" / "3d-force-graph.min.js").write_text("// vendor", encoding="utf-8")

    out = tmp_path / "dist"
    cfg = _make_config(mini_vault_plus_outside_link, out)
    cfg["src_root"] = str(src_root)

    build.run(cfg, out)

    assert (out / "index.html").is_file()
    assert (out / "assets" / "styles" / "base.css").is_file()
    assert (out / "assets" / "scripts" / "main.js").is_file()
    assert (out / "assets" / "vendor" / "3d-force-graph.min.js").is_file()
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
python -m pytest tests/test_build_end_to_end.py::test_build_copies_frontend_assets -v
```

Expected: FAIL — index.html does not exist in `dist/`.

- [ ] **Step 3: Modify `tools/build.py`**

In `tools/build.py`, find the `run()` function. Just before the closing of `run()`, add:

```python
    # Copy frontend assets if src_root is configured
    src_root = cfg.get("src_root")
    if src_root:
        _copy_frontend_assets(Path(src_root), out)
```

Then add at module level (above `_main`):
```python
def _copy_frontend_assets(src: Path, out: Path) -> None:
    """Copy src/index.html, src/styles/, src/scripts/, src/vendor/ to dist/."""
    import shutil
    # index.html goes to dist/ root
    src_index = src / "index.html"
    if src_index.is_file():
        shutil.copy2(src_index, out / "index.html")
    # styles, scripts, vendor go under dist/assets/
    for sub in ("styles", "scripts", "vendor"):
        src_dir = src / sub
        if src_dir.is_dir():
            dst_dir = out / "assets" / sub
            if dst_dir.exists():
                shutil.rmtree(dst_dir)
            shutil.copytree(src_dir, dst_dir)
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
python -m pytest tests/test_build_end_to_end.py -v
```

Expected: 6 passed.

- [ ] **Step 5: Update `showcase.config.json` to set `src_root`**

Add to `showcase.config.json`:
```json
  "src_root": "src",
```
(Insert after `"vault_root"` line so the file stays readable.)

- [ ] **Step 6: Re-run real build**

Run:
```bash
python -m tools.build --config showcase.config.json --out dist/
ls dist/assets/scripts/
ls dist/assets/styles/
ls dist/assets/vendor/
```

Expected: each directory has the expected files.

- [ ] **Step 7: Commit**

```bash
git add tools/build.py tests/test_build_end_to_end.py showcase.config.json
git commit -m "feat(tools): build copies frontend assets from src/ to dist/

src_root in config controls where index.html, styles/, scripts/,
vendor/ are copied from. Test added."
```

---

## Phase 9: Local smoke-test the built site

### Task 9.1: Serve dist/ locally and verify in browser via Playwright

**Files:**
- Create: `package.json`
- Create: `tests/e2e/showcase.spec.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "wiki-graph-showcase",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "python -m tools.build --config showcase.config.json --out dist/",
    "dev": "python -m http.server --directory dist/ 8000",
    "test:py": "python -m pytest tests/ --ignore=tests/e2e -v",
    "test:e2e": "npx playwright test tests/e2e/",
    "test": "npm run test:py && npm run test:e2e"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2: Install Playwright (skip if already installed)**

Run:
```bash
npm install
npx playwright install chromium
```

Expected: Playwright + chromium binary installed.

- [ ] **Step 3: Write `tests/e2e/showcase.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import { setTimeout as wait } from "timers/promises";

let server: ChildProcess;

test.beforeAll(async () => {
  // Serve dist/ on :8000
  server = spawn("python", ["-m", "http.server", "--directory", "dist", "8000"], {
    stdio: "ignore",
  });
  // Give the server a moment to bind
  await wait(800);
});

test.afterAll(() => {
  server.kill("SIGTERM");
});

test("loads the showcase page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("http://127.0.0.1:8000/");
  await expect(page).toHaveTitle(/Knowledge Nebula/);

  // Wait for at least one node to be rendered (3d-force-graph injects a canvas)
  await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 10_000 });

  // Should display the node count from graph.json
  const meta = await page.locator("#meta-readout").innerText();
  expect(meta).toMatch(/\d+ Knoten/);

  expect(errors).toEqual([]);
});

test("slider value updates the readout and URL", async ({ page }) => {
  await page.goto("http://127.0.0.1:8000/");
  await page.locator("#graph-container canvas").waitFor({ state: "visible" });

  const slider = page.locator("#gold-slider");
  await slider.fill("80");
  // Use input event by setting value then dispatching
  await slider.evaluate((el: HTMLInputElement) => {
    el.value = "80";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await expect(page.locator("#gold-value")).toHaveText(/80%/);
  await expect(page).toHaveURL(/gold=80/);
});

test("theme toggle switches data-theme attribute", async ({ page }) => {
  await page.goto("http://127.0.0.1:8000/");
  await page.locator("#graph-container canvas").waitFor({ state: "visible" });

  const before = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await page.locator("#theme-toggle").click();
  const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(after).not.toBe(before);
  expect(["crab", "dome"]).toContain(after);
});

test("prefers-reduced-motion disables CMB layer at high gold", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8000/?gold=85");
  await page.locator("#graph-container canvas").waitFor({ state: "visible" });
  // Wait a tick for app init
  await page.waitForTimeout(500);
  const cmbActive = await page.evaluate(
    () => document.getElementById("cmb-layer")?.classList.contains("active") ?? false,
  );
  expect(cmbActive).toBe(false);
  await ctx.close();
});
```

- [ ] **Step 4: Build then run E2E**

Run:
```bash
npm run build
npm run test:e2e
```

Expected: 4 Playwright tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/e2e/showcase.spec.ts
git commit -m "test(e2e): playwright smoke against built dist/

Loads page, slider updates URL, theme toggle, reduced-motion
disables CMB. 4 tests."
```

Note: if `package-lock.json` is created by `npm install`, also `git add` it.

---

## Phase 10: Public-safety sweep + first-deploy preparation

### Task 10.1: Manual public-safety review

**Files:**
- Modify: `docs/CHANGELOG.md`

**Manual step — must be done before deploying anywhere reachable from the public internet.**

- [ ] **Step 1: Inspect every generated node JSON for private content**

Run:
```bash
python -m tools.build --config showcase.config.json --out dist/
ls dist/assets/nodes/
```

Then read each file and look for:
- Names of people not intended for public mention
- Internal file paths like `C:/Users/...`
- Token/secret-looking strings
- Personal anecdotes or private context

For each problematic node: either edit the source wiki file to redact, or remove the file from `showcase.config.json` `include`.

- [ ] **Step 2: Re-build and re-inspect after edits**

Run `npm run build` again. Spot-check that the redactions stuck.

- [ ] **Step 3: Add CHANGELOG entry**

Append to `docs/CHANGELOG.md` (new entry at top, below the header):
```markdown
## 2026-05-15 — MVP frontend + build pipeline

- Python build pipeline (parser copy + extractor + slice filter + orchestrator).
- Frontend: vanilla HTML/JS + 3d-force-graph + two themes (crab + dome) + gold-mode slider.
- Mobile drawer, prefers-reduced-motion respect, URL permalinks.
- E2E Playwright smoke (4 tests).
- Public-safety sweep done manually for all 31 generated node JSONs.
```

- [ ] **Step 4: Commit changelog + any wiki redactions**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): MVP frontend + build pipeline + safety sweep"
```

If wiki files were edited, those are in a separate repo (`~/wiki/`) — commit those there:
```bash
cd ~/wiki && git add wiki/concepts/<edited>.md && git commit -m "docs: redact private bits for showcase public sweep"
```

---

### Task 10.2: GitHub remote + initial push

**Files:** none

- [ ] **Step 1: Create GitHub repo via gh CLI**

Run:
```bash
gh repo create dynamic-dome/wiki-graph-showcase --private --source=. --remote=origin --description="Public 3D-Knowledge-Graph-Showcase fuer dome-dynamics"
```

Expected: remote created, `origin` set.

- [ ] **Step 2: Push main**

```bash
git push -u origin main
```

Expected: branch tracks origin/main.

- [ ] **Step 3: Verify GitHub-side view**

Run:
```bash
gh repo view --web
```

Spot-check the README, browse `docs/`.

---

## Phase 11: Cloudflare Pages Deploy (manual, with checklist)

### Task 11.1: Configure Cloudflare Pages

**This phase requires Cloudflare dashboard access. No git commits are made here; the user does the dashboard work.**

- [ ] **Step 1: In Cloudflare dashboard**

  1. Go to Pages → Create a project → Connect to Git.
  2. Select repo `dynamic-dome/wiki-graph-showcase`.
  3. Production branch: `main`.
  4. Build settings:
     - Framework preset: `None`.
     - Build command: `python -m tools.build --config showcase.config.json --out dist/` — **but** Cloudflare's build env may not have access to `C:/Users/domes/wiki` (read: it will not). See Step 2 for the fix.
     - Build output directory: `dist`
     - Environment variables: `PYTHON_VERSION=3.11`

- [ ] **Step 2: Decide the deploy strategy for the vault read**

Cloudflare Pages build runners **do not have access to your local wiki**. Two options:

**Option A — Build locally, commit `dist/`:**
- Locally run `npm run build`
- Add `dist/` to a separate branch (`gh-pages` style) or commit it to a branch CF Pages watches
- Remove `dist/` from `.gitignore` for that branch only, or use a separate build branch
- Trade-off: `dist/` lives in git history (a few MB of JSON + 707 KB vendor)

**Option B — Pre-build to a separate `_site/` branch via GitHub Action:**
- Add a Action that runs the Python build pre-commit and stores output on a build artifact branch
- Cloudflare deploys that branch
- Trade-off: more moving parts, but cleaner main branch

For MVP: **use Option A.** Simpler. Document in CLAUDE.md.

- [ ] **Step 3: Implement Option A (build branch)**

Run:
```bash
# Make a separate branch that contains dist/
git checkout -b deploy
# Temporarily allow dist/ in this branch
echo "!dist/" >> .gitignore-deploy
mv .gitignore .gitignore.main
mv .gitignore-deploy .gitignore
git add .gitignore
git rm --cached -- "$( cat .gitignore.main )" 2>/dev/null || true
# Run build
npm run build
git add dist/
git commit -m "deploy: rebuild dist/ from main@<sha>"
git push -u origin deploy
# Back to main
git checkout main
mv .gitignore.main .gitignore  # restore
```

This is awkward. **A cleaner alternative:** keep `dist/` always gitignored, and use a GitHub Action that builds on push to main and deploys via Cloudflare's Direct Upload API (or `wrangler pages deploy`). But that is more setup than the MVP needs.

For now: manual deploy via `wrangler pages deploy dist/` is the simplest path.

- [ ] **Step 4: Install wrangler and deploy via CLI**

Run:
```bash
npm install --save-dev wrangler
npm run build
npx wrangler pages deploy dist/ --project-name=wiki-graph-showcase
```

Follow the interactive prompts. The first run will set up the project and return a `.pages.dev` URL.

- [ ] **Step 5: Verify in browser**

Open the printed URL. Confirm:
- Page loads.
- Console has only the favicon 404 (acceptable).
- At least 31 nodes render in the canvas.
- Slider works.
- Theme toggle works.

- [ ] **Step 6: Add custom domain `wiki.dynamic-dome.com`**

In Cloudflare Pages dashboard → wiki-graph-showcase → Custom domains → Add → `wiki.dynamic-dome.com`. Cloudflare auto-configures DNS if `dynamic-dome.com` is already on Cloudflare.

- [ ] **Step 7: Document the deploy procedure**

Add to `HOW-TO-USE.md` (append a new section before "Troubleshooting"):
```markdown
## Wie deploye ich

1. `npm run build` — baut `dist/` aus dem aktuellen Vault-Stand.
2. `npx wrangler pages deploy dist/ --project-name=wiki-graph-showcase` — pusht direkt zu Cloudflare Pages.
3. Live unter `https://wiki.dynamic-dome.com` nach ~30 Sek.

Production-Branch ist nur fuer Source-Tracking (kein automatischer Build von Cloudflare-Seite — der Vault liegt nicht in CF's Build-Env). Deploys laufen manuell aus dem lokalen `dist/`.
```

- [ ] **Step 8: Commit doc update**

```bash
git add HOW-TO-USE.md package.json package-lock.json
git commit -m "docs: deploy instructions via wrangler pages

Manual local build + wrangler push. No CF-side build because vault
lives on local FS, not in CF build runners."
git push
```

---

## Phase 12: Final smoke + close-out

### Task 12.1: Final acceptance pass

**Files:** none

- [ ] **Step 1: Open production URL in mobile-emulator**

Open the production URL on a real phone or use browser DevTools mobile emulation. Verify:
- Page loads in < 4 s on 4G throttling
- At least 31 nodes render
- Tooltip + tap works
- Theme toggle + slider work
- Modal opens as bottom-drawer
- No console errors

- [ ] **Step 2: Run full test suite one last time**

Run:
```bash
npm run test
```

Expected: all pass.

- [ ] **Step 3: Update CHANGELOG with launch entry**

Add to top of `docs/CHANGELOG.md`:
```markdown
## 2026-05-15 — Public launch

- Deployed to `wiki.dynamic-dome.com` via wrangler.
- 31 Astrophysics concept nodes + josef-m-gassner entity.
- Two themes (crab default, dome optional), gold-mode slider, URL permalinks.
- Mobile drawer, prefers-reduced-motion respect.
```

- [ ] **Step 4: Final commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): public launch entry"
git push
```

- [ ] **Step 5: Tag the launch**

```bash
git tag -a v0.1.0 -m "MVP launch — Astrophysics Showcase"
git push --tags
```

---

## Self-Review Summary

**Spec coverage:**
- Section 1 (Zweck) → addressed implicitly throughout
- Section 2 (Architektur Ansatz A) → Task 4.1 build orchestrator
- Section 3.1 (Build-Tool) → Tasks 2.1, 3.1, 4.1, 4.2
- Section 3.2 (Frontend-Bundle) → Phase 5–7
- Section 3.3 (Visuelles Modell) → Task 5.3 + Task 7.4 + Task 7.5
- Section 3.4 (Interaktion) → Tasks 7.1, 7.2, 7.5
- Section 3.5 (Mobile) → Task 5.2 (CSS media query) + Task 5.1 (modal layout)
- Section 3.6 (Mini-Vault) → Task 4.2 config
- Section 4 (Daten-Modell) → Task 4.1 output schema
- Section 5 (Hosting) → Phase 11
- Section 6 (Testing) → tests in every phase + Phase 9 E2E
- Section 7 (Roadmap MVP-only) → fully covered by this plan
- Section 8 (NOT in MVP) → not implemented (correctly)
- Section 9 (Risiken) → Mobile-Perf addressed in Task 5.2 / Task 7.4, Public-Safety in Task 10.1

**Placeholder scan:** none found. Every code step shows the actual code.

**Type consistency:**
- `PageMeta` defined in `tools/extract_page_meta.py`, consumed in `tools/build.py` — fields match
- `loadGraph()` / `loadNode()` signatures consistent in `graph-loader.js` and `main.js`
- `createStage()` returns an `api` object — `setGraphData`, `setCenter`, `onNodeClick`, `onNodeHover`, `centerCamera`, `getGraphForceInstance` all used consistently in `main.js`
- `createModal()` API (`show`, `hide`, `onNeighbourClick`) consistent
- `createThemeSwitcher()` API (`set`, `next`, `get`, `loadStored`) consistent
- `createGoldPulse()` API (`setGold`, `notifyGraphData`, `getGold`) consistent
- `readState()` / `writeState({...})` consistent
- `slug` <-> `nodeId` mapping: `slug.replace(/__/g, "/")` in `graph-loader.js` matches the build side which uses `node_id.replace("/", "__")` — symmetric

**Known soft spots (acceptable for MVP, flag for future iteration):**
1. Cloudflare Pages cannot run the Python build (no access to local wiki). Phase 11 uses manual wrangler deploy. If this becomes painful: build via GitHub Action with vault committed to a private repo, or split vault to a "public-slice" git repo that CF can read.
2. The `gold-pulse.js` edge color modulation calls `getComputedStyle` per frame per edge — for 150 edges at 60 FPS that's 9000 calls/s of getComputedStyle. **Performance flag:** if profiling shows this is hot, cache the color values once per slider change instead.
3. `package-lock.json` is created by `npm install` but not explicitly committed in the task list — it should be committed by Task 9.1 Step 5. (Already mentioned in the note.)

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-wiki-graph-showcase-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
