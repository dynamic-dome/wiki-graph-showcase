# Changelog

Neueste Eintraege oben.

---

## 2026-05-15 — Bugfix: extract_page_meta skips heading-only paragraphs (ec071a6)

Folge auf den P0-P4-Befund. `_first_paragraph` ueberspringt jetzt Paragraphen, deren non-blank Zeilen alle Markdown-Headings sind. Neue Helper `_is_heading_only`. 3 Regressionstests dazu — Tests-Total **23 → 26 gruen**. Real-Build erneut durchgelaufen: Essences enthalten jetzt echte Lead-Saetze ("Die Allgemeine Relativitaetstheorie (ART) ist Albert Einsteins...", "Ein Schwarzes Loch ist ein Raumzeitbereich..."). Phase 5 entblockt.

Wiki-TODO `~/wiki/wiki/todos/2026-05-15-showcase-essence-extractor.md` auf `status: done` gesetzt.

---

## 2026-05-15 — Phase 0-4: Build-Pipeline lauffaehig

**Stand:** 8 Commits, 23 pytest-Tests gruen, Tree clean. Pipeline produziert real **31 Knoten / 103 Kanten** gegen `C:/Users/domes/wiki/` — innerhalb Spec-Erwartung (31-40 / 30-200).

**Phasen:**
- **Phase 0** Scaffold + handoff merge-pack (CLAUDE.md konsolidiert, docs/agent-handoff/, Spec + Plan + 3 visual-references, docs-Struktur PROJECT/CAPABILITIES/ARCHITECTURE/CHANGELOG)
- **Phase 1** `tools/parser.py` 1:1-Kopie aus DCO `wiki_graph/parser.py@0050d65` mit Provenance-Header. 4 Smoke-Tests gegen mini_vault.
- **Phase 2** `tools/extract_page_meta.py` (TDD, 8 Tests) mit PageMeta-Dataclass, Frontmatter-Parser, Private-Reject, Lead-First-Paragraph, Wikilink-Render.
- **Phase 3** `tools/filter_slice.py` (TDD, 6 Tests) — Glob-Expansion + Public-Safety + deterministische Sortierung + Missing-File-Warning.
- **Phase 4** `tools/build.py` (TDD, 5 e2e-Tests) — End-to-End-Orchestrator. `showcase.config.json` mit 31 Astrophysik-Pages. Erster echter Build durchgelaufen.

**Bekannter Bug (blockiert Phase 5):** Modal-Inhalt-Felder `subtitle`/`essence` enthalten nur `"## Definition"` in allen 31 Node-JSONs. Ursache: Wiki-Pages folgen Pattern `# H1 \n\n## Definition \n\n<Lead>`, `_first_paragraph` nimmt aber den ersten Block nach H1 (das ist die Sub-Heading-Zeile). Plan-Tests sehen das Problem nicht, weil die mini_vault-Fixtures keine Sub-Headings haben. Wiki-TODO mit Wiedereinstiegs-Plan: `~/wiki/wiki/todos/2026-05-15-showcase-essence-extractor.md`.

**Commits:** `77e4c8c` (scaffold) · `8948538` (handoff-pack) · `49a7cd0` (parser) · `7be8dc0` (parser-tests) · `3d8fb7f` (extract) · `676bbe2` (filter) · `414fe5c` (build) · `1684e9b` (config).

---

## 2026-05-15 — Repo scaffold

- Initial repo created from spec `docs/superpowers/specs/2026-05-15-wiki-graph-showcase-design.md`.
