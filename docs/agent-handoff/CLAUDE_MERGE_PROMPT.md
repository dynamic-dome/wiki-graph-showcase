# CLAUDE_MERGE_PROMPT.md

Nutze diesen Prompt direkt in Claude Code, um das Handoff-Modul sicher in ein bestehendes Repo zu integrieren.

```md
Du arbeitest in einem bestehenden Repository. Ziel ist die sichere Integration eines ergänzenden Claude-Code-Handoff-Moduls, ohne vorhandene Projektregeln zu überschreiben.

Bitte führe folgende Schritte aus:

1. Prüfe, ob im Repo-Root bereits eine `CLAUDE.md` existiert.

2. Falls `CLAUDE.md` existiert:
   - nicht überschreiben
   - Inhalt lesen und kurz zusammenfassen
   - potenzielle Konflikte mit dem neuen Handoff-Modul markieren
   - `docs/agent-handoff/CLAUDE_HANDOFF.md` anlegen oder aktualisieren
   - in `CLAUDE.md` nur einen kurzen Verweis ergänzen
   - keine bestehenden Abschnitte löschen, außer sie sind eindeutig doppelt und du schlägst es vorher als Diff vor

3. Falls keine `CLAUDE.md` existiert:
   - schlanke Root-`CLAUDE.md` anlegen
   - `docs/agent-handoff/CLAUDE_HANDOFF.md` als ausführliches Modul anlegen
   - Root-Datei soll nur Projektstart, Lesereihenfolge und Link auf das Handoff-Modul enthalten

4. Ergänze diese Konfliktregel:
   `projektspezifische CLAUDE.md > CLAUDE_HANDOFF.md > allgemeine Agenten-Konventionen`

5. Liefere am Ende:
   - kurze Zusammenfassung der gefundenen bestehenden Regeln
   - Liste der neu angelegten oder geänderten Dateien
   - Diff-Vorschau
   - offene Fragen
   - Risiko-Einschätzung
   - Go/No-Go für Commit

Wichtig:
- Keine Projektdateien blind überschreiben.
- Keine Secrets lesen oder ausgeben.
- Keine großen Refactors.
- Jede Änderung klein, testbar und rückbaubar halten.
```