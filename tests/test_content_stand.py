"""Intro-Titel (#10018) und Inhaltsstand (#10035 K6, K2).

- .intro-title startet mit opacity .001: Chromium wertet opacity 0 nicht als LCP-Kandidat.
- Kein Preload der Display-Schrift (Fraunces), das verschlechterte den LCP auf 2,9 bis 6,2 s.
- Build schreibt metadata.content_median_month (Median der `updated`-Daten) in graph.json.
- Über-Text nennt keine Themen ohne Knoten.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from tools import build

ROOT = Path(__file__).resolve().parent.parent
BASE_CSS = (ROOT / "src" / "styles" / "base.css").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "src" / "index.html").read_text(encoding="utf-8")


def _rule(css: str, selector: str) -> str:
    m = re.search(re.escape(selector) + r"\s*\{(.*?)\}", css, re.DOTALL)
    assert m, selector
    return m.group(1)


def test_intro_title_starts_at_opacity_001_not_zero() -> None:
    body = _rule(BASE_CSS, ".intro-title")
    assert re.search(r"(?<![\w.-])opacity:\s*\.001\s*;", body)
    assert not re.search(r"(?<![\w.-])opacity:\s*0\s*;", body)
    assert "animation: intro-rise" in body  # Choreografie bleibt


def test_no_font_preload_for_display_font() -> None:
    assert not re.search(r"<link[^>]+rel=\"preload\"[^>]+as=\"font\"", INDEX_HTML)
    assert "fraunces" not in INDEX_HTML.lower()


def test_about_text_does_not_claim_mechatronics_nodes() -> None:
    about = INDEX_HTML.split('id="about"', 1)[1].split("</details>", 1)[0]
    assert "Mechatronik" not in about and "Messtechnik" not in about
    assert 'id="about-stand"' in about


def test_median_month_picks_lower_middle_and_ignores_missing() -> None:
    assert build._median_month([]) is None
    assert build._median_month(["2026-05-10"]) == "2026-05"
    assert build._median_month(["2026-10-23", "2026-05-10", "2026-05-16"]) == "2026-05"
    # gerade Anzahl: unteres der beiden mittleren Daten
    assert build._median_month(["2026-04-30", "2026-05-01", "2026-06-01", "2026-07-01"]) == "2026-05"


def test_metadata_with_stand_keeps_config_and_does_not_mutate_it() -> None:
    cfg_meta = {"title": "T"}
    out = build._metadata_with_stand(cfg_meta, ["2026-05-10"])
    assert out == {"title": "T", "content_median_month": "2026-05"}
    assert cfg_meta == {"title": "T"}
    assert build._metadata_with_stand(cfg_meta, []) == {"title": "T"}


@pytest.fixture
def vault(tmp_path: Path) -> Path:
    for name, updated in [("a", "2026-03-01"), ("b", "2026-05-10"), ("c", "2026-09-20"), ("d", "kaputt")]:
        p = tmp_path / "vault" / "wiki" / "concepts" / f"{name}.md"
        p.parent.mkdir(parents=True, exist_ok=True)
        body = chr(10).join(["---", "type: concept", "status: active", f"updated: {updated}", "---", f"# Seite {name}", "", f"Text {name}.", ""])
        p.write_text(body, encoding="utf-8")
    return tmp_path / "vault"


def test_build_writes_content_median_month_into_graph_json(vault: Path, tmp_path: Path) -> None:
    cfg = {
        "vault_root": str(vault),
        "include": ["wiki/concepts/*.md"],
        "default_center": "wiki/concepts/a",
        "metadata": {"title": "Test"},
    }
    out = tmp_path / "dist"
    build.run(cfg, out)
    graph = json.loads((out / "assets" / "graph.json").read_text(encoding="utf-8"))
    # gültige Daten: 03-01, 05-10, 09-20 -> Median 2026-05; "kaputt" zählt nicht
    assert graph["metadata"] == {"title": "Test", "content_median_month": "2026-05"}
    assert graph["built_at"]
