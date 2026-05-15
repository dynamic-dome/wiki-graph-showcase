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
