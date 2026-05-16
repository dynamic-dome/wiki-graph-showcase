# Changelog

Neueste Eintraege oben.

---

## 2026-05-16 — DCO #7702 fix: dynamische Port-Wahl statt hardcoded 8000

`tests/e2e/showcase.spec.ts` Local-Modus nutzt jetzt einen freien Port (via `net.createServer().listen(0)`) statt hardcoded 8000. `beforeAll` wartet aktiv via `fetch(HEAD)` bis der Server antwortet, statt blind `setTimeout(800)`. Vorher: wenn Port 8000 belegt war (z.B. lokal laufendes uvicorn), faellt Python's http.server silent zurueck und Playwright trifft den falschen Service. Jetzt: Spec waehlt einen anderen Port und laeuft stabil — auch wenn 8000 belegt ist. Verifiziert: 4/4 lokal mit uvicorn auf 8000 (11.2 s), 4/4 Live, 1/1 Mobile-Smoke (DOMContentLoaded 1.9 s). Helfer `findFreePort()` und `waitForServer()` direkt im Spec (kein neuer File).

---

## 2026-05-16 — Phase 12 Mobile-Smoke + Custom-Domain `wiki.dynamic-dome.com`

**Custom-Domain:** `wiki.dynamic-dome.com` ueber CF Pages Dashboard angebunden. DNS bei 8.8.8.8 nach < 1 Min sichtbar (CF-Anycast `104.21.22.46` u.a.). `curl --resolve wiki.dynamic-dome.com:443:104.21.22.46 https://wiki.dynamic-dome.com/` → HTTP 200, korrekter Title, `graph.json` reachable. Local-Resolver Drift (Fritz.box hatte das frueher gefragte "non-existent" gecached) klaert sich von selbst nach TTL.

**Mobile-Smoke:** Neuer Spec `tests/e2e/live/mobile-smoke.spec.ts` (iPhone-12 Viewport+UA, CDP-4G-Throttling 4 Mbit/s + 200 ms RTT). Erster Live-Run gegen `wiki-graph-showcase.pages.dev`: **DOMContentLoaded in 2.5 s, 0 pageerror**, sicher unter Plan-Limit 4000 ms. Canvas rendert, Meta-Readout zeigt Knoten-Count.

**Test-Script-Split:** `package.json` jetzt mit `test:e2e` (lokal, `tests/e2e/showcase.spec.ts`) vs `test:e2e:live` (`tests/e2e/live/`). `npm test` (Default) laeuft NICHT die Live-Specs — bewusst, weil sie eine Internet-Verbindung und Cloudflare-Live-State brauchen und in Offline-Dev fail-en wuerden.

**Bekanntes Side-Issue (DCO #7702):** `tests/e2e/showcase.spec.ts` Local-Modus spawnt `python -m http.server` auf Port 8000. Wenn Port 8000 bereits durch einen anderen Service belegt ist (z.B. lokal laufendes uvicorn), faellt Python's http.server **silent** zurueck und Playwright trifft den falschen Service — alle 4 Local-Tests scheitern. Fix vertagt, getrackt in DCO-Todo #7702.

---

## 2026-05-16 — Phase 12 Smoke: Playwright E2E gegen Live-URL

`tests/e2e/showcase.spec.ts` ist jetzt via `BASE_URL`-Env-Var konfigurierbar (default bleibt `http://127.0.0.1:8000`, http.server-Spawn nur im Local-Modus). Erster Live-Run:

```bash
BASE_URL=https://wiki-graph-showcase.pages.dev npx playwright test tests/e2e/showcase.spec.ts
```

**4/4 gruen in 20.0 s gegen Live-URL.** Title, Canvas-Render, Slider+URL-Sync, Theme-Toggle, prefers-reduced-motion-CMB-Off — alle bestaetigt. Regressionscheck im Local-Modus: weiterhin 4/4 in 12.3 s.

---

## 2026-05-16 — Phase 11: Cloudflare Pages Deploy (live)

**Stand:** MVP-Showcase live unter `https://wiki-graph-showcase.pages.dev/`.

- `npm install --save-dev wrangler` (4.92.0).
- Pre-Deploy-Sweep: grep ueber `dist/assets/nodes/*.json` auf Markdown-Artefakte (`^>`, `^##`, `status:`), Pfade (`C:/`, `/Users/`), Secrets, Privatdaten — alle Sweeps clean. Drei Sample-Spotchecks (Maxwell, ART, Gassner) zeigen echte Lead-Saetze ohne Meta-Leaks.
- `wrangler pages project create wiki-graph-showcase --production-branch=main` — Projekt angelegt.
- `wrangler pages deploy dist/ --project-name=wiki-graph-showcase --branch=main --commit-dirty=true` — 44 Dateien, 3.9 s Upload. Production-URL: `https://wiki-graph-showcase.pages.dev/`.
- Live-Check via `curl -sI`: HTTP 200, Title `Knowledge Nebula — Dynamic Dome`, `graph.json` reachable.

Custom-Domain `wiki.dynamic-dome.com` ist noch nicht gesetzt — kommt in Phase 12 oder als Cutover-Schritt danach.

**Hinweis fuer naechste Deploys:** Cloudflare baut NICHT selbst (Vault liegt auf lokaler FS, nicht im Repo). Jeder Update-Deploy: lokal `npm run build` + `npx wrangler pages deploy dist/ --project-name=wiki-graph-showcase --branch=main --commit-dirty=true`. Dokumentiert in `HOW-TO-USE.md` Sektion "Wie deploye ich".

---

## 2026-05-16 — Phase 7–10: Frontend wiring + E2E + Safety-Sweep

**Stand:** MVP-Showcase deployment-ready. 31 Knoten / 103 Kanten gegen `~/wiki/`. Tree clean, 29/29 pytest + 4/4 Playwright E2E.

**Phase 7 — Interaction & Stage (5 Commits):**
- `three-stage.js` (132 LOC) — 3d-force-graph init, BFS-distance coloring, click vs doubleclick (<350 ms), camera-focus
- `modal.js` (42 LOC) — show/hide, neighbour-pill renderer
- `theme-switcher.js` (42 LOC) — data-theme attribute, localStorage, themechange Event
- `gold-pulse.js` (108 LOC) — RAF-driven edge breathing, density-adaptive period (sparse/medium/dense), CMB-Layer >70%, brand-glyph color shift >50%, prefers-reduced-motion off-switch
- `main.js` (124 LOC) — async init, precedence URL > storage > default, modal-on-click, doubleclick=new center, tooltip, error fallback

**Phase 8 — Build kopiert frontend assets:**
- `tools/build.py._copy_frontend_assets` — src/index.html nach dist/, src/{styles,scripts,vendor}/ nach dist/assets/
- TDD: failing test → helper → 6/6 build-e2e green
- `showcase.config.json` setzt `src_root: "src"`

**Phase 9 — Playwright E2E (4 Tests):**
- `package.json` + `tests/e2e/showcase.spec.ts`
- 4 Tests: page load (canvas visible, kein pageerror, Knoten-Count im meta-readout), slider+URL-sync, theme-toggle, prefers-reduced-motion deaktiviert CMB
- **Found bug:** `src/index.html` lud `3d-force-graph.min.js` nie als `<script>`-Tag — `createStage` warf `ForceGraph3D global not found`. Fix `cf04d23` (1 Zeile). Plan-Tests sahen das nicht (kein Test gegen dist/index.html). P006-Sub "Test-Fixture-Realitaetsluecke" wieder.

**Phase 10.1 — Public-Safety-Sweep:**
- Automatischer Scan ueber 31 Node-JSONs auf interne Pfade / Tokens / Emails / Privatnamen: **0 Treffer**
- Inhaltliche Pruefung aller subtitle/essence-Felder: ausschliesslich Astrophysik-Wissenschaft, Personen-Erwaehnungen nur oeffentliche Wissenschaftler (Einstein, Boltzmann, Maxwell, Schwarzschild, Verlinde, Gaßner, Lesch) im fachlichen Kontext
- **Found leak:** `maxwell-gleichungen` zeigte `> \`status: seed\` ...` Wiki-Internal-Meta im Modal-Subtitle
- **Fix:** `_first_paragraph` skipped jetzt auch Blockquote-Paragraphen (`> ...`). Zwei neue Regressionstests. Tests 27 → 29 green.

**Commits Phasen 7–10:** `ef3adf6` `c6cd8f4` `e4e82e9` `f912a1d` `c59bce1` (Phase 7) · `20f8947` (Phase 8) · `cf04d23` (Phase 9 vendor-tag fix) · `8433a0e` (Phase 9 E2E) · diese Commit (Phase 10 Maxwell-Meta-Fix + CHANGELOG).

**Deployment-Ready.** Phase 10.2 (GitHub-Push) bereits in Phase 6-Iteration erledigt, alle 16 Commits auf `dynamic-dome/wiki-graph-showcase`. Naechste Schritte: Phase 11 (Cloudflare Pages Deploy), Phase 12 (Final Live-Smoke).

---

## 2026-05-16 — Phase 5+6: Frontend Shell + Vendor + Loader + URL-State

**Stand:** 7 Commits, Repo gepusht auf neues private GitHub-Repo `dynamic-dome/wiki-graph-showcase` (14 Commits gesamt ab Phase 0). Tree clean. Frontend-Quellen unter `src/` vollstaendig fuer die statische Anzeige vorbereitet — Phase 7 (Three Stage + Interaction) entblockt.

**Phase 5 — HTML Shell + Base + Themes:**
- **Phase 5.1** `src/index.html` (69 Zeilen) — Shell mit 17 IDs und 4 strukturellen Bloecken (Stage, Modal, Slider, Status)
- **Phase 5.2** `src/styles/base.css` (249 Zeilen, 7 Sektionen) — Layout, Typografie, Gold-Slider, Modal-Hide, Dark-Theme-Grund
- **Phase 5.3** `src/styles/theme-crab.css` + `theme-dome.css` (20+21 CSS-Vars) — Crab mit Nebel-Filamenten, Dome austerer
- **Doku** 4 Screenshot-Renders nach `docs/screenshots/`

**Phase 6 — Vendor + Loader + URL-State:**
- **Phase 6.1** `src/vendor/3d-force-graph.min.js` (707 KB, MD5-identisch zur DCO-Kopie)
- **Phase 6.2** `src/scripts/url-state.js` (43 Zeilen) — `?node=&theme=&gold=` shareable URL-State
- **Phase 6.3** `src/scripts/graph-loader.js` (38 Zeilen) — `fetch` von `graph.json` + per-node Lazy-Load + Slug-Helpers

**Commits:** `884ebf2` (index.html) · `3a1e41a` (base.css) · `72ac562` (themes) · `a9f3276` (screenshots) · `23431cd` (vendor) · `37882a4` (url-state) · `822cd82` (graph-loader).

**Push:** `gh repo create dynamic-dome/wiki-graph-showcase --private --source=. --push` — alle 14 Commits auf `origin/main`.

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
