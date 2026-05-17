# wiki-graph-showcase Audit - 2026-05-17

## Umfang

Audit nach Buchfuehrungs-Fix: Repo-Status, Projektdoku, Build-Pipeline, Public-Safety, Frontend, Tests, Deploy-Oberflaeche.

## Inventar

| Bereich | Stand |
|---|---|
| Source-Dateien | 52 getrackte Dateien vor diesem Fix-Paket |
| Build-Output | `dist/` mit 49 Knoten, 220 Kanten, 64 Cross-Cluster-Bruecken |
| Live-Ziele | `https://wiki.dynamic-dome.com/`, `https://wiki-graph-showcase.pages.dev/` |
| Build | Python stdlib, `tools/build.py` |
| Frontend | Vanilla JS, vendored `3d-force-graph`, Cloudflare Pages |
| Tests | pytest Build/Parser/Extractor/Sweep + Playwright E2E |

## Befunde

### P1 - Dokumentationsdrift

Status: in diesem Durchgang gefixt.

Evidenz: `docs/CAPABILITIES.md` und `docs/PROJECT.md` beschrieben Live-Funktionen noch als geplant bzw. in Entwicklung. Sie dokumentieren jetzt den aktuellen Live-Stand inklusive Gantefoer-Cluster, Security-Headers, Auto-Tour, Deploy-Status und explizit offenem Mobile-Density-Guard.

### P1 - Pre-Deploy-Sweep war manuell

Status: in diesem Durchgang gefixt.

Evidenz: `CLAUDE.md` und `AGENTS.md` verlangten bisher manuelles Grep, bis `tools/pre_deploy_sweep.py` existiert. Das neue Tool prueft Pflichtdateien, rohe Leak-Marker, Meta-Marker in JSON-Strings, Graph-Statistiken und kann optional ein Manifest schreiben.

### P1 - Agent-Runtime-Datei war untracked

Status: in diesem Durchgang gefixt.

Evidenz: `AGENTS.md` existierte vor diesem Durchgang, war aber untracked. Die Datei spiegelt die Projekt-Laufzeitregeln und gehoert versioniert neben `CLAUDE.md`.

### P2 - Mobile-Density-Guard ist noch offen

Status: offen.

Evidenz: Die urspruengliche Spec nennt `max_nodes=40` und FPS-Auto-Step fuer Mobile. Der aktuelle Source-Stand hat Mobile-CSS und Mobile-Smoke-Tests, aber keinen source-seitigen Node-Density-Guard. Bei 49 Knoten blockiert das nicht, vor der naechsten Graph-Erweiterung wird es relevant.

### P2 - Parser-Kopie hat manuelles Sync-Risiko

Status: akzeptiertes Risiko.

Evidenz: `tools/parser.py` ist absichtlich aus DCO kopiert und traegt einen Source-Commit-Header. Das ist gute Isolation, aber bei geaendertem Upstream-Parser-Verhalten sollte bewusst gegen DCO verglichen werden.

### P3 - Historische Plan-Dateien enthalten alten Stand

Status: als Historie akzeptiert.

Evidenz: `docs/superpowers/specs/` und `docs/superpowers/plans/` erwaehnen weiterhin geplante MVP-Faehigkeiten, manuelle Deploy-Schritte und lokale Pfade. Das sind historische Implementierungsartefakte, nicht die aktuelle Betriebsdoku. Aktuelle Wahrheit sind `HOW-TO-USE.md`, `CLAUDE.md`, `AGENTS.md`, `docs/PROJECT.md`, `docs/CAPABILITIES.md` und dieser Audit.

### P3 - Lokaler Vault-Pfad ist absichtliche Source-Konfiguration

Status: akzeptiertes Risiko.

Evidenz: `showcase.config.json` enthaelt `C:/Users/domes/wiki`, weil der Build den lokalen Vault lesen muss. Die Deploy-Sicherheitsgrenze ist: `dist/` wird gescannt und liefert diesen Pfad nicht aus; die Live-Seite serviert nur generiertes JSON.

## Konstruktive Richtung

1. Das Projekt bleibt ein kuratiertes oeffentliches Buchfuehrungsartefakt, kein Auto-Sync-Spiegel des privaten Wikis.
2. Jeder Deploy ist ein Inventarereignis: Build, Sweep, Manifest, Deploy, Live-Smoke.
3. Naechste Features erst nach sauberer Buchfuehrung: Mobile-Density-Guard vor einem dritten Cluster.
4. `wiki.dynamic-dome.com` ist die oeffentliche Beweisflaeche fuer Knowledge-OS-Arbeit; zukuenftige Curriculum-/Workshop-Cluster sollten zurueck auf dynamic-dome.com fuehren.

## Akzeptanzchecks Fuer Diesen Audit-Durchgang

- `npm run build` - bestanden
- `python tools/pre_deploy_sweep.py --dist dist --write-manifest` - bestanden, 49 Knoten / 220 Kanten / 64 Bruecken
- `npm run test:py` - bestanden, 35/35
- `npm run test:e2e` - bestanden, 7/7
- Live-Header- und Graph-Checks gegen `wiki.dynamic-dome.com` - bestanden, HTTP 200 mit CSP/HSTS und Live-Graph 49/220/64
