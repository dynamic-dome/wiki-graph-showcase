# Aurum Nebula — Pimp-Runde für das Kompetenz-Graph-Visual

**Datum:** 2026-07-09
**Status:** Design abgesegnet (User), bereit für Implementierungsplan
**Datensatz-Fokus:** Kompetenz-Graph (Default). Astro-Datensatz darf nicht kaputtgehen, bekommt aber keine neuen Features garantiert.

## Kontext & Entscheidung

Die bisherige Projekt-Regel „kein three.min.js als Vendor-Dep" ist für diese Runde
explizit vom User aufgehoben worden („alles ist erlaubt"). Das gebündelte
3d-force-graph (`src/vendor/3d-force-graph.min.js`, THREE **r168** intern) exponiert
bereits `linkDirectionalParticles` und `postProcessingComposer()` — beides wird genutzt.

## Leitprinzip

**Der Gold-Slider wird Master-Regler für die gesamte Atmosphäre.** Bloom-Stärke,
Edge-Partikel-Dichte und Sternenfeld-Tönung skalieren mit dem Slider-Wert.
Default (35 %) = subtil-edel, 100 % = spektakulär. Kein Effekt bekommt einen
eigenen Regler; die Kohärenz des Looks hat Vorrang vor Einzeleffekt-Maximierung.

## Features

### A. Fokus-Spotlight (Neighborhood-Dimming)
- Hover über einen Knoten: alle Knoten/Kanten außer Knoten + 1-Hop-Nachbarn
  dimmen auf Haze (Alpha-reduzierte Farbe). Hover-Ende stellt den Normalzustand wieder her.
- Auswahl/Zentrum (`setCenter`): dasselbe Dimming persistent, kombiniert mit der
  bestehenden BFS-Distanz-Färbung.
- Umsetzung in `three-stage.js` über die vorhandenen `nodeColor`/`linkColor`-Callbacks
  (kein THREE nötig).
- **Targeted Improvement:** `bfsDistance(centerId)` wird derzeit pro Knoten im
  Color-Callback neu berechnet (O(n²) je Refresh). Die Distanz-Map wird künftig
  einmal pro `setCenter` berechnet und gecacht.

### B. Edge-Flow-Partikel
- `linkDirectionalParticles` (built-in im Bundle): sparsam auf allen Kanten
  (1 Partikel), dichter (3–4) auf Kanten, die am Fokus-/Zentrum-Knoten hängen.
- Fließrichtung: zum Zentrum hin.
- Partikel-Dichte/Breite skaliert mit Gold-Slider.
- `prefers-reduced-motion`: Partikel komplett aus.

### C. Bloom (Post-Processing)
- Neues Modul `src/scripts/bloom.js`: konstruiert einen `UnrealBloomPass` (three r168)
  und pusht ihn in den vorhandenen `graph.postProcessingComposer()`.
- Hoher Luminanz-Threshold: nur helle Knoten, Zentrum und Partikel glühen —
  kein flächiger Glow-Matsch.
- Stärke: ~0.5 bei Gold 35 % linear bis ~1.2 bei 100 %; bei Gold 0 % Bloom aus.
- Fallback: schlägt die Initialisierung fehl (fehlender Composer, WebGL-Probleme),
  wird Bloom still übersprungen — der Graph rendert normal weiter.

### D. Kategorie-Geometrien
- Neues Modul `src/scripts/node-forms.js`, angebunden via `nodeThreeObject()`.
- Low-poly, dezent: `competence` = Ikosaeder, `synthesis` = Torus,
  `topic` = Kugel (mittleres Detail), `concept` = Kugel (niedriges Detail),
  `entity` = Oktaeder.
- Material: `MeshLambertMaterial`/emissive, damit Bloom die Formen aufnimmt.
  Farben identisch zu `KOMPETENZ_CATEGORY_COLORS`; Größe-nach-Weight bleibt erhalten.
- Zentrum-Knoten: weißer Emissive-Boost (ersetzt den bisherigen „weißen Halo"-Farbtrick).
- Spotlight-Dimming (Feature A) muss auch mit Custom-Objects funktionieren
  (Material-Opacity/Emissive statt nur nodeColor-Callback).
- Nur für den Kompetenz-Datensatz aktiv; Astro behält Default-Kugeln.

### E. 3D-Sternenfeld + Nebel
- Neues Modul `src/scripts/scene-dressing.js`: fügt der `graph.scene()` hinzu:
  - ~1500 Sterne als `THREE.Points` (BufferGeometry, additive Blending, size attenuation),
  - 2–3 große, weiche Nebel-Billboards (Sprite mit radialem Canvas-Gradient).
- Echte Parallaxe beim Kameraflug — Tiefe statt flachem Overlay.
- Gold-Slider töntet Sterne/Nebel von Blau-Weiß Richtung Gold.
- **Das 2D-Sparkles-Overlay (`sparkles.js` + `#sparkles-layer`) geht in Rente** —
  Modul, DOM-Layer und Aufrufe werden entfernt (Entscheidung User, 2026-07-09).
- `prefers-reduced-motion`: Sternenfeld statisch (keine Drift/Twinkle-Animation).

## Technik-Fundament

- **Vendor-Erweiterung:** `three.module.min.js` (r168, exakt passend zum Bundle)
  plus die Bloom-Kette aus three/examples (EffectComposer wird NICHT gebraucht —
  der Composer kommt aus dem Bundle; benötigt werden `UnrealBloomPass` und dessen
  interne Abhängigkeiten in r168-Fassung).
- **Import Map** in `index.html` mappt `"three"` auf das Vendor-Modul —
  kein Bundler, bleibt Vanilla ES2020 (Projekt-Konvention).
- Versions-Kopplung dokumentieren: Header-Kommentar in den Vendor-Files
  („muss zur THREE-Revision im 3d-force-graph-Bundle passen, aktuell r168")
  und Hinweis in `CLAUDE.md` (alte „kein THREE"-Regel ersetzen).

## Fehlerbehandlung

- Bloom-Init-Fehler → still überspringen (Console-Warn, kein User-facing Error).
- `nodeThreeObject`-Picking muss verifiziert werden (Klick/Hover auf Custom-Meshes).
- Astro-Datensatz: Regression ausgeschlossen — colorMode-Weiche wie bisher.

## Tests & QA

- **Playwright:** bestehende Specs müssen grün bleiben; neue Checks:
  Seite lädt ohne Console-Errors (inkl. Import-Map-Auflösung), Klick auf Knoten
  mit Custom-Geometry öffnet weiterhin das Modal, Gold-Slider-Extremwerte (0/100)
  werfen keine Fehler, `?dataset=astro` rendert weiter.
- **In-Browser-QA (Pflicht, Canvas/Visual-Code):** Sichtprüfung beider Themes,
  beide Datensätze, Gold 0/35/100, reduced-motion-Emulation, Plate-Modus (P).
- **Pre-Deploy-Sweep:** neue Vendor-Files dürfen den Sweep nicht brechen;
  `tools/pre_deploy_sweep.py` vor Deploy laufen lassen (Projekt-Regel).

## Implementierungs-Reihenfolge

Jeder Schritt einzeln erlebbar und einzeln abbrechbar:

1. Spotlight + BFS-Cache (kein THREE)
2. Edge-Flow-Partikel (kein THREE)
3. THREE-Fundament (Vendor + Import Map) + Sternenfeld/Nebel + Sparkles-Rente
4. Bloom
5. Kategorie-Geometrien

## Nicht in dieser Runde (bewusst verworfen)

- Kategorie-Anker-Forces („Themen-Regionen") — User-Entscheid: organische Wolke bleibt.
- Typed-Link-Styling, Story-Tour 2.0 — nicht ausgewählt, ggf. spätere Runde.
