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

## C4 Touch (Vorschau, 2026-10-02)

Kein Befund: Tap auf Knoten öffnet das Modal (Chromium, Handy-Profil 390×844, Vorschau). Safari/iOS ungeprüft. Keine Code-Änderung.

Fix-Runde 1 (2026-10-02): Der parallele Gesamtlauf zeigte C4 zunächst rot (Tap traf ins Leere). Ursache gemessen: Unter Last dauert das Laden länger als 10 s (`IDLE_MS` in `auto-tour.js`), der Idle-Drift kreist die Kamera, die Knoten wandern zwischen Zielberechnung und Tap um 40 bis 130 px; ein Layout-Ruhe-Gate hilft deshalb nicht (Knoten werden nie ruhig). Behebung nur im Test: Zielberechnung und Tap werden zusammen wiederholt (`toPass`, 30 s); der erste Tap ist Eingabe und stoppt den Drift. Die Aussage bleibt gleich streng (Tap auf Knoten muss `#modal` öffnen). Danach 5 von 5 parallelen Läufen (`showcase`, `kompetenz`, `aurum`, `wp-c`) mit genau den 4 Baseline-Rot, 30 grün. Kein Produktbefund.

## Zwischenstand C1 bis C4 (Vorschau, 2026-10-02)

Stand `d379e24` (C1 bis C4, Sitemap, Vorschau mit CSP), frisch gebaut (`build:all`), Vorschau 127.0.0.1:8051 mit `_headers`. Median aus 2 Läufen: Score 39, FCP 3913 ms, LCP 7224 ms, TBT 1602 ms, CLS 0.000, Konsolenfehler 0. Einzelläufe: Lauf 1 Score 40, FCP 3914, LCP 7226, TBT 1458; Lauf 2 Score 38, FCP 3912, LCP 7222, TBT 1745. `csp_check`: OK (Hash `sha256-2dKkrr9dPqwVsaJrGisoD3YRJ6KcEZZop43ucG6AwDk=`).

Gesamtlauf davor: Sweep `status: pass` (49 Knoten, 221 Links); pytest 83 passed; `test:unit` 16 passed; E2E (`showcase`, `kompetenz`, `aurum`, `wp-c`) 30 grün, 4 rot = die Baseline-Rot (`kompetenz.spec.ts:68`, `showcase.spec.ts:69`, `:86`, `:102`; Vorbestand nach `aca0c8e`, nicht repariert).

Die Stand-Zeilen weichen untereinander ab (Nach C1: TBT 3904 ms, jetzt 1602 ms bei gleichem Skript-Pfad plus C2 bis C4); die Lasten der Messläufe schwanken stark (Baseline 2707 ms). Maßgeblich für das Gate bleibt die Zeile „Nach C1“.

## C1b-Gate (Entscheid Zwischenabnahme)

OFFEN. TBT-Median nach C1 = 3904 ms (> 1000 ms; Kontrollmessung Zwischenstand 1602 ms, ebenfalls > 1000 ms). C1b ist nur mit Dominics Go möglich. Ohne Go bleibt es bei C1, das Zielmaß TBT ≤ 1 s wird dann offen als verfehlt berichtet. Task 10 wird vorbereitet, aber nicht gebaut.

## C1b (Vorschau, 2026-10-02, Seitenzweig `feat/wp-c-c1b-vorberechnete-positionen`, kein Go, nicht live)

Layout-Ausdehnung der heutigen Simulation (Schritt 2, 15 s Lauf, 259 Knoten): maxX 496, maxY 637, maxZ 498, r50 287, r95 743; `scale` = 637.

Vergleich alt (`ce682dd`, Vorschau 8051) gegen neu (Seitenzweig, Vorschau 8052), abwechselnd nacheinander in derselben Lastsituation (alt, neu, alt, neu), Median aus 2 Läufen:

| Stand | Score | FCP ms | LCP ms | TBT ms | CLS | Konsolenfehler |
|---|---|---|---|---|---|---|
| alt (ce682dd) | 38 | 3849 | 7223 | 1794 | 0.000 | 0 |
| neu (C1b) | 44 | 3913 | 7374 | 959 | 0.000 | 0 |

Einzelläufe alt: 39/3913/7223/1542 und 37/3785/7222/2047; neu: 43/3912/7371/1039 und 45/3915/7377/878 (Score/FCP/LCP/TBT). TBT neu knapp unter 1000 ms (Streuung 878 bis 1039), LCP leicht schlechter (graph.json größer). Rohdateien `c1b-alt-*.json`, `c1b-neu-*.json`.
