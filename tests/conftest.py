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
