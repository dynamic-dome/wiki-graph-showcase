# CLAUDE.md

> **Erste Pflichtlektuere:** [`HOW-TO-USE.md`](HOW-TO-USE.md).

## Projekt-Konventionen

- **Build = Python 3.11+ (stdlib only), kein PyPI-Dep.** Wenn ein Drittpaket noetig wird, vorher mit User abstimmen.
- **Frontend = Vanilla JS, ES2020.** Kein React, kein Bundler, kein TypeScript-Compile-Step. Wenn TS-Hints sinnvoll sind, JSDoc verwenden.
- **Tests:** pytest fuer Build, Playwright (TypeScript spec via tsx) fuer Frontend-E2E.
- **Public-Safety:** Build rejected `private: true`-Frontmatter. Vor jedem Deploy (nicht nur erstem) `python tools/pre_deploy_sweep.py --dist dist --write-manifest` ausfuehren; das prueft private Marker, interne Pfade, Markdown-Meta-Marker und Pflichtdateien in `dist/`.
- **Parser-Sync:** `tools/parser.py` ist eine Kopie von `dynamic_central_orchestrator/wiki_graph/parser.py` (Quell-Commit im Header dokumentiert). Bei Aenderungen an der DCO-Quelle: hier per Hand syncen, Header-Hash updaten.
- **THREE ist als Vendor-Modul eingebunden** (`src/vendor/three/`, r168). **Es gibt genau EINE THREE-Instanz:** `src/vendor/3d-force-graph.esm.min.js` ist die ESM-Variante und importiert `three` extern über die Import Map (kein eigenes THREE, sonst Konsolenwarnung "Multiple instances of Three.js"). Neu bauen mit `tools/vendor-force-graph-esm.mjs` (Rezept im Dateikopf); das Bundle enthält `three/examples/jsm`-Code in der gebauten Revision, darum beim Update `three@` und `src/vendor/three` gemeinsam heben und `EXPECTED_THREE_REVISION` in `three-guard.js` mitziehen. Wächter: `tests/test_vendor_single_three.py`. Import via Import Map (`"three"` in index.html). Custom-Geometries (`node-forms.js`), Szenen-Dressing und Bloom hängen daran.
- **Wiki-Read-Only:** Build-Step liest den `vault_root` aus `showcase.config.json` (aktuell `C:/Users/domes/Desktop/Claude-Projekte/physik-weltall-wiki/` — Physik-Split 2026-07-18), schreibt NIE dorthin.
- **Lokale Vorschau mit CSP:** `npm run serve:preview` (`tools/preview_server.py`) spielt `_headers` aus; `python -m http.server` (`npm run dev`) tut das nicht. Vor jedem Deploy `python -m tools.csp_check` gegen Vorschau und danach gegen live.

## Handoff / Reviews / Audits

Fuer strukturierte Code-Uebergaben, Audits, Patch-Reviews, Regressionstests und Rollback-Plaene siehe:

- `docs/agent-handoff/CLAUDE_HANDOFF.md`

Diese Datei ergaenzt die projektspezifischen Regeln in `CLAUDE.md`, ersetzt sie aber nicht.
Bei Konflikten gilt: projektspezifische `CLAUDE.md` > `CLAUDE_HANDOFF.md` > allgemeine Agenten-Konventionen.
