# Kompetenz-Wiki Export

Wie der zweite Datensatz (`kompetenz`) neben dem Astrophysik-Showcase entsteht
und ausgeliefert wird. Der öffentliche Graph ist statisch und backend-frei —
identisch zum Astro-Mechanismus, nur über eine zweite Config parametrisiert.

## Quelle

- **Vault:** `C:/Users/domes/Desktop/kompetenz-wiki` (eigener Vault, nicht `~/wiki`).
- **Config:** `kompetenz.config.json` im Repo-Root.

## Was rein kommt (Scope)

- **Kern-Tier (vollständig):** `wiki/competences/`, `wiki/synthesis/`, `wiki/topics/`
  (via `include`-Globs).
- **Nachbarn:** `wiki/concepts/` und `wiki/entities/` kommen rein, sobald ein
  Kern-Node sie referenziert — über Frontmatter-Relationen
  (`depends_on`/`applies_to`/`supports`) **oder** Body-Wikilinks. Verwaiste
  concepts/entities bleiben draußen.
- **Status-Gate:** Seiten mit `status` in
  `{superseded, archived, paused, seed, in-progress}` werden ausgeschlossen.
  Fehlt `status`, wird die Seite aufgenommen (lenient) und eine Warnung geloggt.
- **`exclude`:** `**/README.md` (Index-Seiten sind keine Graph-Knoten).

## Was NICHT exportiert wird

- Voller Seiten-Body. Pro Knoten nur `title`, `subtitle` (erster Satz),
  `essence` (erster echter Absatz) — abgeleitet, nie der Roh-Body.
- `raw/`, `.agent-memory/`, `wiki/sources/`, `wiki/queries/`, `wiki/lint/`,
  `wiki/meta/` (nicht in `include`/`neighbour_dirs`).

> kompetenz-wiki ist nicht vertraulich. Der Pre-Deploy-Sweep ist daher ein
> Hygiene-Check (interne Pfade, Secret-Zuweisungen, Markdown-Meta-Artefakte im
> abgeleiteten Text), kein Vertraulichkeits-Gate.

## Output

`dist/assets/kompetenz/`:
- `graph.json` — Knoten (id, title, category, kind, cluster, weight,
  verification_status falls vorhanden) + Links (source, target, **type**).
- `index.json` — schlanker Such-Index (id, title, category).
- `nodes/<slug>.json` — Detail je Knoten (`<slug>` = id mit `/`→`__`).

Der Astro-Datensatz bleibt unter `dist/assets/` (graph.json, nodes/) und wird
nicht berührt.

## Build

```powershell
npm run build:all        # astro + kompetenz nacheinander
# oder einzeln:
python -m tools.build --config showcase.config.json   --out dist/
python -m tools.build --config kompetenz.config.json --out dist/
```

## Safety-Sweep (vor Deploy Pflicht)

```powershell
npm run sweep            # python tools/pre_deploy_sweep.py --dist dist
```

Erwartung: `status: pass`, `findings: 0`. Plus manueller Spotcheck von 5-10
`dist/assets/kompetenz/nodes/*.json`.

## Frontend

Ein sichtbarer Datensatz-Umschalter (Nebula | Kompetenz) oben rechts. URL-State:
`?dataset=kompetenz&node=<id>&theme=<crab|dome>&gold=<0-100>`. Ohne `?dataset`
gilt der Astro-Datensatz (Rückwärtskompatibilität für bestehende Permalinks).

- Knoten-Farbe nach `category` (Kompetenz/Synthese/Thema/Konzept/Entität).
- Ein Cluster, Layout nur über Kräfte (kein Cluster-Anchor wie bei Astro).
- Suche aus `index.json` (Titel + id), Auswahl recentert + öffnet Detail.
- Detail = bestehendes Modal + Badges (Kategorie, verification_status).

## Tests

```powershell
npm run test:py          # pytest (exporter/filter/parser/sweep)
npm run test:e2e         # Playwright: showcase.spec.ts + kompetenz.spec.ts
```

## Deploy

Cloudflare Pages baut aus dem Repo. Nach dem Build müssen BEIDE Datensätze in
`dist/` liegen (`npm run build:all`). Live-Verify mit Cache-Bust:

```powershell
curl.exe "https://wiki.dynamic-dome.com/assets/kompetenz/graph.json?v=NNN" | Select-String '"dataset": "kompetenz"'
```
