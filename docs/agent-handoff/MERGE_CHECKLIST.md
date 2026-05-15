# MERGE_CHECKLIST.md

## Vor dem Merge

- [ ] Existiert bereits eine `CLAUDE.md`?
- [ ] Wurde die bestehende `CLAUDE.md` gelesen?
- [ ] Sind projektspezifische Regeln erhalten geblieben?
- [ ] Wurde das Handoff-Modul unter `docs/agent-handoff/CLAUDE_HANDOFF.md` abgelegt?
- [ ] Wurde nur ein kurzer Link in der Root-`CLAUDE.md` ergänzt?
- [ ] Ist die Konfliktregel dokumentiert?
- [ ] Gibt es keine doppelte oder widersprüchliche Definition von Rollen, Tools oder DoD?
- [ ] Wurden keine Secrets, Tokens oder privaten Pfade in die Doku übernommen?

## Nach dem Merge

- [ ] `git diff` geprüft
- [ ] Markdown-Links geprüft
- [ ] README oder docs-Index optional verlinkt
- [ ] Claude Code mit `CLAUDE_MERGE_PROMPT.md` getestet
- [ ] Offene Konflikte dokumentiert
- [ ] Commit klein und nachvollziehbar gehalten

## Minimaler Patch für bestehende `CLAUDE.md`

```md
## Handoff / Reviews / Audits

Für strukturierte Code-Übergaben, Audits, Patch-Reviews, Regressionstests und Rollback-Pläne siehe:

- `docs/agent-handoff/CLAUDE_HANDOFF.md`

Diese Datei ergänzt die projektspezifischen Regeln in `CLAUDE.md`, ersetzt sie aber nicht.
Bei Konflikten gilt: projektspezifische `CLAUDE.md` > `CLAUDE_HANDOFF.md` > allgemeine Agenten-Konventionen.
```