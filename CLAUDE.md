# CLAUDE.md

> **Erste Pflichtlektuere:** [`HOW-TO-USE.md`](HOW-TO-USE.md).

## Projekt-Konventionen

- **Build = Python 3.11+ (stdlib only), kein PyPI-Dep.** Wenn ein Drittpaket noetig wird, vorher mit User abstimmen.
- **Frontend = Vanilla JS, ES2020.** Kein React, kein Bundler, kein TypeScript-Compile-Step. Wenn TS-Hints sinnvoll sind, JSDoc verwenden.
- **Tests:** pytest fuer Build, Playwright (TypeScript spec via tsx) fuer Frontend-E2E.
- **Public-Safety:** Build rejected `private: true`-Frontmatter. Vor jedem ersten Deploy: manueller Sweep durch alle generierten `nodes/*.json` auf private Inhalte (Namen, interne Pfade, etc.).
- **Parser-Sync:** `tools/parser.py` ist eine Kopie von `dynamic_central_orchestrator/wiki_graph/parser.py` (Quell-Commit im Header dokumentiert). Bei Aenderungen an der DCO-Quelle: hier per Hand syncen, Header-Hash updaten.
- **Wiki-Read-Only:** Build-Step liest `C:/Users/domes/wiki/`, schreibt NIE dorthin.

## Handoff / Reviews / Audits

Fuer strukturierte Code-Uebergaben, Audits, Patch-Reviews, Regressionstests und Rollback-Plaene siehe:

- `docs/agent-handoff/CLAUDE_HANDOFF.md`

Diese Datei ergaenzt die projektspezifischen Regeln in `CLAUDE.md`, ersetzt sie aber nicht.
Bei Konflikten gilt: projektspezifische `CLAUDE.md` > `CLAUDE_HANDOFF.md` > allgemeine Agenten-Konventionen.
