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
