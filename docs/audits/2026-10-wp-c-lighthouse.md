# WP C (wiki.dynamic-dome.com): Lighthouse-Messprotokoll

Lighthouse 13.4, mobil, nur Performance, Median aus 2 Läufen. Rohdateien liegen lokal unter `C:/Users/domes/AppData/Local/Temp/wiki-lh/` und sind nicht versioniert.

| Stand | Datum | Ort | Score | FCP ms | LCP ms | TBT ms | CLS | Konsolenfehler |
|---|---|---|---|---|---|---|---|---|
| Baseline (main, vor WP C) | 2026-10-02 | Vorschau 127.0.0.1:8051 (mit _headers) | 29 | 7239 | 10830 | 2707 | 0.001 | 0 |

Einzelläufe: Lauf 1 Score 29, FCP 7207, LCP 10806, TBT 2835; Lauf 2 Score 29, FCP 7270, LCP 10854, TBT 2578.

## Daten-Drift gegen Live (2026-10-02)

- Astro-Graph: live 49/221, lokal 49/221, Knotenmengen gleich.
- Kompetenz-Graph: live 263/1377, lokal 259/1331. Nur live: `wiki/concepts/finops-fuer-ki`, `wiki/entities/claude-opus-4-7`, `wiki/synthesis/consumer-pricing-realitaet-2026`, `wiki/topics/ai-pricing-2026`. Gewollt (E-05, keine Kostenangaben öffentlich; Freigabe Dominic 02.10.).
- `index.html` live = lokal (sha256-Präfix ede7800d516d): `aca0c8e` ist live.

## C1b-Gate

OFFEN (TBT-Median 2707 ms > 1000 ms). C1b nur mit Dominics Go.

## Nach C1 (Vorschau, 2026-10-02)

Median aus 2 Läufen: Score 35, FCP 3780 ms, LCP 7221 ms, TBT 3904 ms, CLS 0.001, Konsolenfehler 0. Einzelläufe: Lauf 1 Score 35, FCP 3761, LCP 7215, TBT 3771; Lauf 2 Score 35, FCP 3798, LCP 7226, TBT 4036. `csp_check`: OK.

C1b-Gate: OFFEN (TBT-Median 3904 ms > 1000 ms). C1b nur mit Dominics Go.

## Ohne WebGL (Vorschau, 2026-10-02)

Chromium-Flags `--disable-webgl --disable-3d-apis`, 1 Lauf: Score 67, FCP 3790 ms, LCP 7380 ms, TBT 0 ms, CLS 0.003, Konsolenfehler 0 (Pfad schreibt nur `console.warn`). Kontext-Test im Playwright-Skript: `getContext("webgl2")` = false, Liste sichtbar (259 Seiten, Kompetenz). Sichtprüfung 390x844 und 1440x900: Liste und Hinweistext lesbar, Topbar frei.
