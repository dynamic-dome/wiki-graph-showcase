# CLAUDE_HANDOFF.md — Ergänzendes Handoff-Modul für Claude Code

> Diese Datei ergänzt eine bestehende `CLAUDE.md`. Sie ersetzt keine projektspezifischen Regeln.

## Zweck

Dieses Dokument standardisiert Code-Handoffs, Audits, Patch-Reviews, Regressionstests und Rollback-Pläne. Es soll Claude Code helfen, risikoarm, evidenzbasiert und projektkompatibel zu arbeiten.

## Geltungsbereich

Diese Datei gilt für:

- strukturierte Repo-Audits
- Patch- und PR-Reviews
- Regressionstest-Planung
- Rollback- und Deployment-Checks
- Health-, Webhook- und Observability-Prüfungen
- kleine, reversible Verbesserungen an Dokumentation, Tests und Tooling

Nicht gedacht für:

- blindes Überschreiben bestehender Projektregeln
- große Refactors ohne vorherige Evidenz
- Architekturentscheidungen ohne ADR oder Review
- Änderungen an Secrets, Deployment oder Datenmodell ohne Rollback-Pfad

## Konfliktregel

Bei Widersprüchen gilt diese Reihenfolge:

```text
1. explizite Anweisung des aktuellen Tickets oder Users
2. projektspezifische `CLAUDE.md`
3. dieses Handoff-Dokument
4. allgemeine Agenten-Konventionen
```

## Arbeitsweise für Claude Code

Claude Code soll zuerst lesen:

```text
CLAUDE.md
README.md
docs/
package.json / pyproject.toml / requirements.txt / Dockerfile / compose files
```

Danach soll Claude ein kurzes Systemverständnis erstellen:

- Hauptzweck des Repos
- zentrale Flows
- relevante Services oder Apps
- kritische Risiken
- offene Fragen
- Dateien, die nicht ohne Review geändert werden sollten

## Erwartete Ausgabeformate

### Audit

Jeder Audit soll enthalten:

- Top-Risiken, priorisiert
- Evidenz mit Datei und Zeile
- Wirkung
- Wahrscheinlichkeit
- kleine Gegenmaßnahme
- Test- oder Review-Vorschlag

### Patch-Review

Jeder Patch-Review soll enthalten:

- Bezug zum Ticket
- Verhalten vor und nach dem Patch
- Nebenwirkungen
- Breaking-Change-Risiko
- Testlücken
- Rollback-Vorschlag
- Go/No-Go

### Regressionstest

Jeder Regressionstest-Vorschlag soll enthalten:

- konkretes Risiko
- Testtyp
- benötigte Doubles oder Fixtures
- erwartete Assertion
- CI-Relevanz

## Akzeptanzkriterien

Eine Änderung gilt nur als fertig, wenn:

- bestehende Projektregeln beachtet wurden
- keine vorhandene `CLAUDE.md` überschrieben wurde
- Tests oder zumindest Testplan ergänzt wurden
- Build-, Lint- oder Typecheck-Auswirkungen bekannt sind
- Rollback-Pfad beschrieben ist
- Security und Secrets geprüft wurden
- relevante Dokumentation aktualisiert wurde

## Anti-Patterns

Claude Code soll vermeiden:

- frei erfundene APIs oder Dateipfade
- große Refactors ohne Auftrag
- ungetestete Änderungen an Auth, Webhook, Deployment oder Datenmodell
- Vermischung von Projektregeln und allgemeinen Agentenregeln
- Löschen bestehender Hinweise in `CLAUDE.md`
- „Ich habe verstanden“-Antworten ohne konkrete nächste Aktion