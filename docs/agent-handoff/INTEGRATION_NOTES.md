# INTEGRATION_NOTES.md

## Integrationslogik

Dieses Paket ist für Repositories gedacht, in denen bereits Agenten-Dokumentation existiert oder künftig entstehen kann.

Die zentrale Entscheidung lautet:

```text
Root-CLAUDE.md = projektspezifische Steuerung
docs/agent-handoff/CLAUDE_HANDOFF.md = wiederverwendbares Handoff-Modul
```

## Warum nicht alles in eine Datei?

Eine einzelne `CLAUDE.md` wird bei wachsenden Projekten schnell unübersichtlich. Außerdem entsteht bei mehreren Repos das Risiko, dass allgemeine Regeln projektspezifische Hinweise überschreiben.

Die Modulstruktur trennt:

- Projektregeln
- Handoff-Prozess
- Review- und Audit-Standards
- Checklisten
- Prompts

## Empfohlene Variante für deine Repos

Für große Projekte wie `dynamic-central-orchestrator`:

```text
/CLAUDE.md
/docs/agent-handoff/CLAUDE_HANDOFF.md
/docs/architecture/
/docs/runbooks/
/docs/frontend/
/docs/deployment/
```

Für kleinere Repos oder Vaults:

```text
/CLAUDE.md
/docs/agent-handoff/CLAUDE_HANDOFF.md
```

Für reine Dokumentations- oder Obsidian-Wikis:

```text
/CLAUDE.md
/meta/agent-handoff/CLAUDE_HANDOFF.md
```

## Commit-Empfehlung

```bash
git checkout -b docs/claude-handoff-merge
git add CLAUDE.md docs/agent-handoff/
git commit -m "docs: add Claude handoff merge module"
```

## Rollback

```bash
git restore CLAUDE.md
rm -rf docs/agent-handoff
```

Falls `docs/agent-handoff` bereits vorher existierte, nicht pauschal löschen. Dann nur die neu hinzugefügten Dateien per `git diff --name-only` prüfen und gezielt entfernen.