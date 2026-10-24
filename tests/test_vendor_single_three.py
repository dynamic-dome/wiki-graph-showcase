"""Waechter WEB-5 (#9603): Es darf nur EINE THREE-Instanz geladen werden.

Das UMD-Bundle von 3d-force-graph bettete ein eigenes THREE ein; neben der
Vendor-THREE (Import Map) ergab das die Warnung "Multiple instances of
Three.js being imported". Die ESM-Variante muss `three` extern importieren.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "src" / "vendor"
BUNDLE = VENDOR / "3d-force-graph.esm.min.js"
LOADER = (ROOT / "src" / "scripts" / "force-graph-loader.js").read_text(encoding="utf-8")


def test_esm_bundle_imports_three_externally() -> None:
    text = BUNDLE.read_text(encoding="utf-8")
    assert re.search(r'from"three"', text), "ESM-Bundle muss `three` extern importieren"


def test_esm_bundle_has_no_embedded_three() -> None:
    text = BUNDLE.read_text(encoding="utf-8")
    # Eigene THREE-Kopie: Warntext und Revision stehen nur in three selbst.
    assert "Multiple instances of Three.js" not in text
    assert "__THREE__" not in text
    assert BUNDLE.stat().st_size < 400_000, "ESM-Bundle ist verdaechtig gross (eingebettetes THREE?)"


def test_only_vendor_three_module_defines_three() -> None:
    owners = [
        p.relative_to(VENDOR).as_posix()
        for p in VENDOR.rglob("*.js")
        if "Multiple instances of Three.js" in p.read_text(encoding="utf-8", errors="ignore")
    ]
    assert owners == ["three/three.module.min.js"]


def test_no_classic_bundle_left() -> None:
    assert not (VENDOR / "3d-force-graph.min.js").exists()


def test_loader_uses_esm_bundle() -> None:
    assert "3d-force-graph.esm.min.js" in LOADER
