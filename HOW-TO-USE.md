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

**Pre-Deploy-Sweep:**
```bash
python tools/pre_deploy_sweep.py --dist dist --write-manifest
```

## Wo Doku lebt

- Architektur + Datenfluss → `docs/ARCHITECTURE.md`
- Faehigkeiten + Status → `docs/CAPABILITIES.md`
- Changelog → `docs/CHANGELOG.md`
- Spec → `<dco-repo>/docs/superpowers/specs/2026-05-15-wiki-graph-showcase-design.md`

## Wie deploye ich

Live: <https://wiki.dynamic-dome.com/> (Custom-Domain) bzw. <https://wiki-graph-showcase.pages.dev/> (CF-Pages-Default).

### Setup (einmalig pro Maschine + pro Cloudflare-Account)

```bash
npx wrangler login                                                              # OAuth-Browser-Klick, speichert Token in ~/.wrangler/ (1x pro Maschine)
npx wrangler pages project create wiki-graph-showcase --production-branch=main  # 1x pro CF-Account, sonst "Project not found" beim Deploy
```

`pages project create` ist nur noetig, wenn das Projekt in **diesem** CF-Account noch nicht existiert. Mit `npx wrangler pages project list` pruefst du den Stand und ueberspringst Schritt 2 wenn `wiki-graph-showcase` schon gelistet ist.

### Jeder Update-Deploy

```bash
npm run build
npx wrangler pages deploy dist/ --project-name=wiki-graph-showcase --branch=main --commit-dirty=true
```

1. `npm run build` baut `dist/` aus dem aktuellen Vault-Stand (liest `C:/Users/domes/wiki/`).
2. `python tools/pre_deploy_sweep.py --dist dist --write-manifest` prueft Public-Safety-Marker, Pflichtdateien, Graph-Stats und schreibt ein Deploy-Manifest nach `dist/assets/build-manifest.json`.
3. `wrangler pages deploy ...` pusht `dist/` direkt zu Cloudflare Pages.
4. Live unter `https://wiki-graph-showcase.pages.dev/` nach ~30 Sekunden Edge-Propagation.

Production-Branch im Repo (`main`) ist nur fuer Source-Tracking — Cloudflare baut nicht selbst, weil der Vault `C:/Users/domes/wiki/` nicht in CF-Build-Runnern existiert. Deploys laufen manuell aus dem lokalen `dist/` heraus.

Custom-Domain `wiki.dynamic-dome.com` ist seit 2026-05-16 angebunden (Dashboard → Pages → wiki-graph-showcase → Custom domains). DNS-Records wurden auto-konfiguriert weil `dynamic-dome.com` bereits auf Cloudflare liegt.

## Update-Workflow fuer Vault-Diffs

**Manuell pro Sprint** — nicht automatisch. Wenn das Showcase einen neuen Themen-Cluster oder eine inhaltliche Welle zeigen soll, bewusst pro Sprint `npm run build && wrangler pages deploy` ausloesen.

Begruendung:
- `~/wiki/` waechst staendig, viele Pages sind seed/Notiz-Stadium. Auto-Deploy wuerde unfertiges Material publizieren.
- Public-Safety-Sweep (private:true, Pfad-Leaks, Markdown-Meta-Marker) laeuft per Tool; das menschliche Auge bleibt fuer inhaltliche Kurationsentscheidungen.
- Visuelle Komposition (Cluster-Mix, Knoten-Anzahl) ist ein bewusster Kurations-Akt, nicht Vault-Drift.

Wenn du irgendwann doch eine Notification willst ("Drift seit letztem Deploy"): TODO-Idee, nicht jetzt.

## Security Headers (Defense-in-Depth)

`src/_headers` wird vom Build nach `dist/_headers` kopiert und von Cloudflare Pages automatisch als HTTP-Headers ausgespielt. Enthaelt CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. CSP erlaubt `style-src 'unsafe-inline'` (gold-pulse.js + url-state.js setzen inline-Styles); script-src ist auf `'self'` beschraenkt.

## Troubleshooting

- **Build wirft `private page rejected`** — eine im `include` gelistete Page hat `private: true` im Frontmatter. Entweder entfernen oder aus `include` rauswerfen.
- **Build wirft `page has no H1`** — Page hat weder `# Titel` noch `title:` im Frontmatter. Page korrigieren oder ausschliessen.
- **Frontend leer/keine Knoten** — pruefen ob `dist/assets/graph.json` existiert + `nodes`-Array nicht leer. Browser-Console auf 404 zu `graph.json` checken.
- **`wrangler pages deploy` wirft `Project not found` (code 8000007)** — das Pages-Projekt existiert in deinem CF-Account noch nicht. Einmal `npx wrangler pages project create wiki-graph-showcase --production-branch=main` ausfuehren, dann deploy nochmal.
