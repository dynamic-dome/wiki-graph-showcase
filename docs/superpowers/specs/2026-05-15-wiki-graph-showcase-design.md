# Wiki-Graph Showcase — Design

**Status:** Spec · 2026-05-15 · Autor: Claude Opus 4.7 mit Dominic
**Projekt-Form:** eigenes Repo, statischer Build, Cloudflare-Pages-Hosting
**Default-Branch des neuen Repos:** `main`
**Tracking-Repo (dieser Spec):** `dynamic_central_orchestrator` (Spec wird im DCO commited, der Showcase entsteht als eigenes Repo)

---

## 1. Zweck

Besucher der dome-dynamics-Website sollen in einer kuratierten 3D-Wissens-Visualisierung **frei rumklicken koennen**, dabei eine astrophysikalisch-aesthetische Atmosphaere erleben, und gleichzeitig einen echten Eindruck von der inhaltlichen Tiefe der Wiki-Materie bekommen. Kein Tutorial, kein gefuehrter Pfad — der Reiz entsteht durch die Verbindung von schoenem Visual, echtem Wissen und Interaktion.

**Erfolgskriterium:** Ein Besucher, der die Showcase-URL oeffnet, verbringt mindestens 60 Sekunden mit Klicken, ohne dass jemand ihn dazu auffordert. Er kann anschliessend sagen "ich habe X gesehen / der Typ kennt sich mit Y aus" und im besten Fall "wow, das hat Spass gemacht".

**Nicht-Zweck:** Kein Production-Wiki, keine Editier-Funktion, kein Backend-Daten-Live-Sync. Kein Onboarding fuer ernste Wiki-Navigation — das macht der DCO-Dashboard-Tab.

## 2. Architektur (Ansatz A: pre-computed statisch)

```
+-------------------------+         +--------------------------+         +----------------+
| ~/wiki/wiki/concepts/   |  build  | showcase-build/           | deploy  | Cloudflare     |
| ~/wiki/wiki/entities/   | ------> | dist/                    | ------> | Pages          |
| (kuratierter Slice)     |  step   |   index.html             |         | wiki.dynamic-  |
+-------------------------+         |   assets/graph.json      |         | dome.com       |
                                    |   assets/nodes/*.json    |         |                |
                                    |   assets/three.min.js    |         +----------------+
                                    |   styles/*.css           |
                                    +--------------------------+
```

**Schluessel-Eigenschaften:**
- **Kein Backend.** Alles ist statische Datei-Auslieferung.
- **Build-Step liest definierte Vault-Slices.** Privates kann nicht leaken — Files, die nicht im Build-Slice stehen, kommen nicht ins Output.
- **Update-Workflow:** Aenderung im Wiki → `npm run build` → `git push` → Cloudflare Pages baut automatisch.
- **Wiederverwendung DCO:** Build-Step uebernimmt die `wiki_graph/parser.py`-Logik (Path-IDs, Stem-Alias-Resolution, Bracket-Strip) aus dem 2026-05-15-Bugfix.

## 3. Komponenten

### 3.1 Build-Tool `showcase-build` (Python)

Ein Build-Skript (Python), kein laufender Service. Lebt im Showcase-Repo unter `tools/build.py`.

- **Input:** `showcase.config.json` mit:
  - `vault_root` (Pfad zum Quellvault)
  - `include` (Liste von Glob-Patterns relativ zu `vault_root`, z.B. `wiki/concepts/*physik*.md`, `wiki/entities/josef-m-gassner.md`)
  - `default_center` (Knoten-ID die der Showcase initial zeigt)
  - `theme_default` (`crab` oder `dome`)
  - `metadata` (Titel, Beschreibung fuers OpenGraph-Tag)
- **Output:** `dist/`-Verzeichnis mit
  - `index.html` (statische Seite, alle Assets per relativer Pfad)
  - `assets/graph.json` (alle Knoten + Kanten inkl. Group-Information)
  - `assets/nodes/{slug}.json` (pro Knoten: Titel, Untertitel, 3-5-Satz-Essenz, Liste verwandter Knoten)
  - `assets/three.min.js` (vendored, 707 KB, wie im DCO)
  - `assets/styles/*.css`
- **Pipeline:**
  1. Glob alle Pfade die in `include` matchen
  2. Parse via Path-IDs (wiederverwendet DCO `wiki_graph/parser.py`)
  3. Pro Page extrahiere: Titel (erste H1 oder Frontmatter `title`), Lead-Paragraph (~3-5 Saetze), outgoing Wikilinks
  4. Build `graph.json`: Knoten + Kanten, gefiltert auf Knoten, die alle im Showcase-Slice sind (keine "broken edges" nach aussen)
  5. Build `nodes/*.json`: pro Knoten ein Snippet
  6. Copy `index.html`, `styles/`, `assets/three.min.js`

**Public-Safe-Garantie:** Build-Step rejected jede Page deren Frontmatter `private: true` enthaelt oder deren erster H1 nicht existiert. Build-Output ist deterministisch und auditierbar.

### 3.2 Frontend-Bundle (Vanilla HTML/JS)

**Keine React-/Vue-/Svelte-Tooling.** Vanilla-JS-IIFE-Modul + three.js. Bundle-Size-Ziel: < 750 KB total (mostly three.js).

**Dateien:**
- `index.html` — Stage-Layout (Toolbar, Canvas, Slider, Detail-Modal), CSS-Variablen fuer beide Themes ueber `data-theme="crab|dome"`
- `assets/styles/theme-crab.css` — Crab-Nebula-Theme (Pulsar, Filamente, kuehl)
- `assets/styles/theme-dome.css` — Dynamic-Dome-Theme (Gold-Center, dome-tokens 1:1)
- `assets/styles/base.css` — Layout, Toolbar, Modal, Slider-Styling
- `assets/scripts/main.js` — App-IIFE, lazy-load `graph.json`, three.js-Setup, Klick-Handler, Slider, Theme-Switcher, Detail-Modal
- `assets/scripts/gold-pulse.js` — RequestAnimationFrame-Loop fuer Edge-Atmer, dichte-adaptiv (siehe 3.4)
- `assets/three.min.js` + `assets/3d-force-graph.min.js` (vendored)

### 3.3 Visuelles Modell (zusammengefasst aus Brainstorm)

**Zwei Themes, ueber Toggle umschaltbar (oben rechts neben Brand-Glyph).**

| | **Theme 1 · Dynamic Dome** | **Theme 2 · Crab Nebula** |
|---|---|---|
| Background | `radial-gradient(ellipse, #1a1428, #0B0F1A)` | Mehrlagiger Nebel mit blau/rosa/violetten radialen Gradienten, sehr dunkel |
| Center | Gold-Glow, ruhiger Pulse (3 s) | Weiss-Pulsar mit schnellem Pulse (1.4 s) |
| BFS-Dist 1 | Cyan-Glow | hellerer Cyan/Tuerkis |
| BFS-Dist 2 | Magenta-Glow | rosa Glow |
| Filamente Hintergrund | dezente Sterne | Filament-Wolken (CSS-`filter: blur`) + viele Sterne |
| Brand-Glyph | Gold ◆ permanent | Cyan ◆ mit gold-Shimmer-Easter-Egg alle 8 s |

**Gold-Mode-Slider** (gilt in beiden Themes, prominenter in Crab):
- **0%:** Reines Crab/Dome wie oben
- **30-40% (Default):** Kanten machen gold-Atmer (~7 s Intervall, gestaffelt, Versatz randomisiert)
- **50-70%:** Atmer schneller, intensiver, Brand-Glyph dauerhaft gold
- **>70%:** CMB-Stroboskop-Layer wird zart sichtbar (Noise + 4-7 Hz Shift mit `prefers-reduced-motion`-Off-Switch)
- **100%:** Showcase-Maximum, jede Kante atmet, Knoten mit-glueht

**Adaptive Tempo-Logik:**
- Atmer-Periode = `base_period * (1 - gold_value * 0.75)` (1.0 → 0.25 Faktor)
- `base_period` aus Kanten-Dichte: <12 Kanten = 9 s, 12–24 Kanten = 12 s, >24 Kanten = 18 s
- Pro-Kante zufaelliger Offset 0–6 s damit nichts synchron pulst
- Intensitaet (Glow-Radius, Farb-Saettigung, Edge-Width-at-Peak): linear 0.25 → 1.0
- Schnelles Atmen (hohes Gold) ⇒ intensivere Farbe; langsames Atmen ⇒ gedaempfter

### 3.4 Interaktion (frei rumklicken)

| Geste | Verhalten |
|---|---|
| Hover Knoten | Tooltip mit Titel + BFS-Distanz + Kanten-Zahl |
| Single-Click Knoten | Knoten wird Highlighted, Nachbarn bleiben hell, andere dim auf ~18% Opacity; Status-Bar zeigt "Klick: <id>"; Modal mit Knoten-Details fadet rechts ein |
| Doppelklick Knoten | Knoten wird neuer Center; URL-Permalink (`?node=<slug>`) wird mit `replaceState` aktualisiert; Graph re-loaded ueber `graph.json`-Slice |
| Klick auf Hintergrund | Highlight + Modal zuruecksetzen |
| Drag im Raum | Kamera-Orbit (three.js-Default) |
| Scroll | Zoom |
| Theme-Toggle | `data-theme`-Attribut auf `<html>` wechselt, Tokens werden via CSS-Variablen geladen, keine Re-Render |
| Gold-Slider | `state.gold` aendert sich, naechste `tick`-Iteration nutzt neuen Wert (live) |
| URL-Permalink | `?node=<slug>&theme=<crab\|dome>&gold=<n>` — alle Zustaende sind shareable |

**Modal-Inhalt** (rechte Seite, fadet von rechts ein):
- Knoten-Titel als H2
- Untertitel (Lead aus erstem Paragraph)
- 3-5 Saetze Essenz
- "Verbunden mit:" mit Liste der direkten Nachbarn als Pill-Buttons (Klick = neuer Center)
- "Doppelklick auf den Knoten oeffnet ihn als neues Zentrum" als dezenter Tipp

Default-Modus auf Mobile: Modal nimmt unteres Drittel ein, Stage oberer Bereich.

### 3.5 Mobile

- Single-Click-Hover-Inversion: erst Tap zeigt Tooltip + Highlight, zweiter Tap auf denselben Knoten = neuer Center (kein Doppelklick-Detector, der auf Touch schlecht funktioniert)
- Slider und Theme-Toggle in Bottom-Drawer (Swipe-up um zu sehen)
- Graph-Dichte reduziert: `max_nodes=40` statt 80 unter 768px Breite
- `prefers-reduced-motion: reduce` → Atmer aus, Pulse aus, Stroboskop aus

### 3.6 Mini-Vault fuer MVP

**Kuratierter Slice aus `~/wiki/`:**

Pflicht-Konzepte (~30, alle bereits im Wiki):
- `wiki/concepts/allgemeine-relativitaetstheorie`
- `wiki/concepts/spezielle-relativitaetstheorie`
- `wiki/concepts/quantenmechanik`
- `wiki/concepts/quantenfeldtheorie`
- `wiki/concepts/quantengravitation`
- `wiki/concepts/stringtheorie`
- `wiki/concepts/schleifen-quantengravitation`
- `wiki/concepts/holographisches-prinzip`
- `wiki/concepts/baryogenese`
- `wiki/concepts/kosmische-inflation`
- `wiki/concepts/kosmische-hintergrundstrahlung`
- `wiki/concepts/kosmische-grossraumstruktur`
- `wiki/concepts/baryonische-akustische-oszillationen`
- `wiki/concepts/hubble-spannung`
- `wiki/concepts/praezisionskosmologie`
- `wiki/concepts/sternentwicklung`
- `wiki/concepts/kompakte-objekte`
- `wiki/concepts/schwarzes-loch`
- `wiki/concepts/schwarzschild-metrik`
- `wiki/concepts/gravitationswellen`
- `wiki/concepts/newtonsche-gravitation`
- `wiki/concepts/maxwell-gleichungen`
- `wiki/concepts/thermodynamik`
- `wiki/concepts/entropie`
- `wiki/concepts/entropische-gravitation`
- `wiki/concepts/higgs-feld`
- `wiki/concepts/dekohaerenz`
- `wiki/concepts/quantenfluktuationen`
- `wiki/concepts/quantenvakuum`
- `wiki/concepts/hilbert-raum`

Ergaenzungs-Knoten (~5):
- `wiki/entities/josef-m-gassner` — "Quelle"-Knoten, visuell groesserer Stern-Sprite
- 2-3 kuratierte Synthese-Pages (falls vorhanden, sonst aus Master-Plan)

**Erwartete Knoten:** 31 direkte Include-Treffer plus indirekte BFS-Erweiterung. Build-Step ist deterministisch: 31 explizit gelistete Files + alle Knoten die per Wikilink in deren outgoing-Edges referenziert werden UND ebenfalls in der Include-Liste sind. Externe Edges (auf Pages ausserhalb der Include-Liste) werden gedropped. **Endgueltige Knoten- und Kantenzahl wird erst vom ersten Build-Run gezeigt** — Erwartung: 31-40 Knoten, 80-140 Kanten.
**Default-Center:** `wiki/concepts/allgemeine-relativitaetstheorie` — gut connected, kanonischer Einstieg
**Default-Gold:** 35%
**Default-Theme:** `crab`

## 4. Daten-Modell

### graph.json
```json
{
  "version": 1,
  "built_at": "2026-05-15T12:00:00Z",
  "default_center": "wiki/concepts/allgemeine-relativitaetstheorie",
  "nodes": [
    {"id": "wiki/concepts/allgemeine-relativitaetstheorie", "title": "Allgemeine Relativitaetstheorie", "category": "concept"},
    ...
  ],
  "links": [
    {"source": "wiki/concepts/allgemeine-relativitaetstheorie", "target": "wiki/concepts/schwarzes-loch"},
    ...
  ]
}
```

### nodes/{slug}.json

`slug` ist die path-ID mit `/` → `__` substituiert. Beispiel: Node-ID `wiki/concepts/allgemeine-relativitaetstheorie` → File `nodes/wiki__concepts__allgemeine-relativitaetstheorie.json`. Frontend macht das Reverse-Mapping `slug.replace(/__/g, "/")` beim Laden.
```json
{
  "id": "wiki/concepts/allgemeine-relativitaetstheorie",
  "title": "Allgemeine Relativitaetstheorie",
  "subtitle": "Einsteins Theorie der Gravitation als Kruemmung der Raumzeit.",
  "essence": "Die ART beschreibt Gravitation nicht als Kraft, sondern als geometrische Eigenschaft der vierdimensionalen Raumzeit...",
  "category": "concept",
  "neighbours": ["wiki/concepts/schwarzes-loch", "wiki/concepts/gravitationswellen", ...]
}
```

## 5. Hosting

**Cloudflare Pages** auf eigener Subdomain — Vorschlag: `wiki.dynamic-dome.com`.
- Repo: neues GitHub-Repo `dynamic-dome/wiki-graph-showcase` (private bis MVP fertig, dann public oder bleibt private)
- Build-Konfig: `npm install && npm run build` produziert `dist/`; Cloudflare deployed
- Custom-Domain ueber CF-Tunnel-Free-Tier
- Cache-Header: `assets/graph.json` und `assets/nodes/*.json` mit `Cache-Control: public, max-age=3600, must-revalidate`; HTML mit `no-cache`

## 6. Testing

**Build-Skript-Tests** (pytest, im Showcase-Repo):
- Glob-Pattern findet definierte Files, ignoriert anderes
- `private: true`-Frontmatter wird gerejected
- Pages ohne H1 werden gerejected
- Output-Schema ist valid (JSON-Schema-Check)
- Broken-Wikilinks zu Pages ausserhalb des Slice werden NICHT als Edges emittiert
- Deterministisch: zweimal builden ergibt byte-identische Outputs

**Frontend-Smoke-Tests** (Playwright):
- Init laedt `graph.json`, rendert > 30 Knoten
- Slider von 0 zu 100 ohne Console-Errors
- Theme-Toggle wechselt `data-theme`-Attribut
- Doppelklick auf Knoten aendert URL + Center
- `prefers-reduced-motion: reduce` → keine Atmer, keine Strobes (E2E mit Browser-Emulation)

**Visual-Regression** (optional, Stretch):
- Playwright Screenshots bei 0 / 50 / 100 Gold, Crab + Dome
- Compare gegen Baseline mit pixel-Toleranz

## 7. Roadmap

| Stage | Inhalt | Aufwand |
|---|---|---|
| **MVP (jetzt)** | Build-Tool, Frontend, Crab+Dome, Slider, Astrophysik-Slice (~40 Pages) | 12-18 h |
| **Stage 2** | Ganteför-Workflow: NotebookLM-Lauf mit Ganteför-Playlist, neue Briefings ins Wiki, Build re-run | 4-6 h (zzgl Inhalts-Arbeit) |
| **Stage 3** | UWuDL-Transkript-Integration: ~137 Inbox-Briefings als Deep-Dive-Knoten, sichtbar erst auf Tiefe 3+ | 6-10 h |
| **Stage 4** | "Tour"-Modus mit 3-5 vordefinierten Pfaden (z.B. "Von Aristoteles zur Stringtheorie") | 8-12 h |

## 8. Was bewusst nicht im MVP ist

- **Inhalts-Editor** — Wiki bleibt Source-of-Truth, Showcase ist generiert
- **Suche / Filter** — frei klicken, nicht searchen
- **Multi-Vault-Switcher** — ein Vault genuegt
- **Server-side Rendering** — alles client-seitig
- **Auth** — public per definitionem
- **3D-Sound** — nice-to-have aber Stretch
- **Theme 3 "Living Roots"** — als Idee aus der Brainstorm-Phase deferred. Ein organischer Wurzeln/Aeste-Stil wuerde echte Bezier-Kanten erfordern und ist mit `3d-force-graph` (geraden three.js-Linien) nicht ohne eigenen Renderer machbar. Kein Workaround geplant — bleibt fuer einen spaeteren Sprint, in dem ein anderer Renderer evaluiert wird (z.B. SVG, oder custom three.js-Geometry).
- **Vault-Live-Sync** — neue Wiki-Pages erscheinen erst nach `build` + push

## 9. Risiken

| Risiko | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| Mobile-Performance schlecht (alte Geraete, three.js + 100+ Knoten) | Mittel | `max_nodes=40` unter 768px; FPS-Auto-Step (wenn <30 FPS, Atmer aus); `prefers-reduced-motion` Respekt |
| User klickt nur 10 s und geht | Niedrig | Default-Gold 35% + auffallendes Crab-Visual → erstes "wow" sofort |
| Wiki-Konzepte zu trocken / nicht spannend genug | Mittel | Lead-Paragraph muss editorial sein, nicht trockenes Lehrbuch. Build-Step koennte einen Hinweis emittieren wenn Lead < 200 Zeichen |
| Knoten-Inhalte enthalten private Notizen | Niedrig | Build-Step rejected `private: true`-Frontmatter; Public-Safe-Audit manuell vor erstem Deploy |
| Brand-Konflikt zwischen Crab-Cyan und dome-dynamics-Gold-Identitaet | Niedrig | Dome-Theme als Default-Switch-Ziel; Brand-Glyph hat Gold-Easter-Egg in Crab |
| Cloudflare Pages Build-Timeout bei wachsendem Vault | Niedrig | Build-Step ist offline-ausgefuehrt; CF Pages baut nur `dist/`-Auslieferung |

## 10. Geltungsbereich des Specs

Dieser Spec ist die **MVP-Definition (Stage 1)**. Stage 2-4 sind Roadmap-Eintraege, keine MVP-Anforderungen. Nach Approval folgt der writing-plan-Mode mit detailliertem Implementation-Plan fuer MVP.
