# Aurum Nebula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fünf-Feature-Visual-Upgrade des Kompetenz-Graphen (Fokus-Spotlight, Edge-Flow-Partikel, 3D-Sternenfeld/Nebel, Bloom, Kategorie-Geometrien), zusammengehalten vom Gold-Slider als Master-Atmosphäre-Regler.

**Architecture:** Alle Effekte hängen an der bestehenden `three-stage.js`-Fassade um 3d-force-graph. Neue THREE-abhängige Module (`scene-dressing.js`, `bloom.js`, `node-forms.js`) importieren `"three"` über eine Import Map, die auf ein Vendor-Modul (three r168, exakt die Revision im 3d-force-graph-Bundle) zeigt. Kein Bundler, alles Vanilla-ES-Module. Spotlight/Partikel (Task 1–2) brauchen kein THREE und liefern sofort sichtbaren Wert.

**Tech Stack:** 3d-force-graph (Vendor-Bundle, THREE r168 intern, exponiert `linkDirectionalParticles` + `postProcessingComposer`), three@0.168.0 als neues Vendor-Modul, Playwright-E2E (tsx), Python-stdlib-Build.

**Spec:** `docs/superpowers/specs/2026-07-09-aurum-nebula-design.md`

## Global Constraints

- Frontend = Vanilla JS, ES2020, kein Bundler, kein TypeScript-Compile-Step (Projekt-CLAUDE.md).
- Build = Python 3.11+ stdlib only; `tools/build.py` kopiert `src/{index.html,styles,scripts,vendor}` nach `dist/` — neue Vendor-Dateien fließen automatisch mit.
- E2E-Tests laufen gegen `dist/` → vor jedem `npm run test:e2e` erst `npm run build:all`.
- `dist/` ist git-ignoriert — nie committen.
- Git: chirurgisch stagen (`git add <datei> ...`), nie `git add -A` (globale CLAUDE.md).
- THREE-Versionskopplung: Vendor-three MUSS r168 sein (Revision im 3d-force-graph-Bundle, verifiziert via `grep -o 'const a="168"' src/vendor/3d-force-graph.min.js`). Bei künftigem Bundle-Update gemeinsam heben.
- `prefers-reduced-motion: reduce` → keine Partikel-Animation, Sternenfeld statisch; Bloom darf bleiben.
- Gold-Slider (0–100) ist Master-Regler: alle neuen Effekte bekommen `setGold(0..1)`.
- Astro-Datensatz (`?dataset=astro`) darf nicht brechen: `edge-flow` und `node-forms` sind kompetenz-only; `scene-dressing` und `bloom` gelten für beide.
- In-Browser-QA ist Pflicht für Canvas/Visual-Code (globale CLAUDE.md) — jeder Task hat einen QA-Step, Task 6 die Voll-QA.
- Vor Deploy: `python tools/pre_deploy_sweep.py --dist dist --write-manifest` (Projekt-CLAUDE.md). Der Sweep text-scannt nur `.html/.json/.txt` — die neuen `.js`-Vendor-Dateien sind unkritisch, aber der Sweep muss trotzdem grün sein.

---

## Task-Übersicht

| # | Task | THREE? | Deliverable |
|---|------|--------|-------------|
| 1 | Fokus-Spotlight + BFS-Cache + `color-utils.js` | nein | Hover dimmt Nicht-Nachbarn; O(n²)-BFS-Fix |
| 2 | Edge-Flow-Partikel (`edge-flow.js`) | nein | Partikel fließen, dichter am Zentrum |
| 3 | THREE-Vendor + Import Map + Sternenfeld (`scene-dressing.js`) + Sparkles-Rente | ja | Parallax-Sternenfeld, 2D-Sparkles entfernt |
| 4 | Bloom (`bloom.js`) | ja | UnrealBloomPass am Bundle-Composer |
| 5 | Kategorie-Geometrien (`node-forms.js`) | ja | Formen je Kategorie, Spotlight-kompatibel |
| 6 | Doku, CLAUDE.md-Regel, Voll-QA, Sweep | — | Alles grün, deploy-bereit |

---

### Task 1: Fokus-Spotlight + BFS-Cache + color-utils

**Files:**
- Create: `src/scripts/color-utils.js`
- Create: `tests/e2e/aurum.spec.ts`
- Modify: `src/scripts/three-stage.js` (nodeColor/setCenter/API)
- Modify: `src/scripts/gold-pulse.js` (Link-Dimming, parseRgba/mixRgba → color-utils)
- Modify: `src/scripts/main.js` (Hover → Spotlight, `window.__nebula`-Testhook)
- Modify: `package.json` (aurum.spec.ts in `test:e2e`)

**Interfaces:**
- Produces (spätere Tasks verlassen sich darauf):
  - `stage.setSpotlight(nodeId: string|null): void`
  - `stage.getLinkDim(link): number` — 1 (voll), 0.35 (center-fern), 0.15 (außerhalb Hover-Spotlight)
  - `stage.getCenterId(): string|null` (existiert schon)
  - `color-utils.js`: `parseRgba(s): [r,g,b,a]|null`, `mixRgba(a,b,t): string`, `dimRgba(c,f): string`
  - `window.__nebula = { stage }` in `main.js` (Testhook, wird pro Task erweitert)

- [ ] **Step 1: Failing E2E-Test schreiben**

`tests/e2e/aurum.spec.ts` neu anlegen. Server-Boilerplate identisch zu `tests/e2e/kompetenz.spec.ts` (Zeilen 1–66 dort: `findFreePort`, `waitForServer`, `beforeAll`/`afterAll`, `url()` — komplett übernehmen). Dann:

```ts
test("spotlight dims links outside the hovered neighbourhood", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(async () => {
    const stage = (window as any).__nebula.stage;
    const resp = await fetch("/assets/kompetenz/graph.json");
    const g = await resp.json();
    const nodeA: string = g.nodes[0].id;
    const nearLink = g.links.find((l: any) => l.source === nodeA || l.target === nodeA);
    const farLink = g.links.find((l: any) => l.source !== nodeA && l.target !== nodeA);
    stage.setSpotlight(nodeA);
    const dimNear = nearLink ? stage.getLinkDim(nearLink) : 1;
    const dimFar = stage.getLinkDim(farLink);
    stage.setSpotlight(null);
    const dimAfter = stage.getLinkDim(farLink);
    return { dimNear, dimFar, dimAfter };
  });
  expect(res.dimNear).toBe(1);
  expect(res.dimFar).toBeLessThan(0.5);
  expect(res.dimAfter).toBeGreaterThan(res.dimFar); // Spotlight aus → kein Hover-Dimming mehr
});
```

- [ ] **Step 2: Test laufen lassen — muss failen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts
```
Expected: FAIL — `window.__nebula` ist undefined.

- [ ] **Step 3: `src/scripts/color-utils.js` anlegen**

`parseRgba` und `mixRgba` aus `gold-pulse.js` (Zeilen 29–45) hierher verschieben, `dimRgba` neu:

```js
/** Shared rgba string helpers (gold-pulse, node-forms). */

export function parseRgba(s) {
  const m = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

export function mixRgba(a, b, t) {
  const ra = parseRgba(a);
  const rb = parseRgba(b);
  if (!ra || !rb) return a;
  const r = Math.round(ra[0] * (1 - t) + rb[0] * t);
  const g = Math.round(ra[1] * (1 - t) + rb[1] * t);
  const bl = Math.round(ra[2] * (1 - t) + rb[2] * t);
  const al = (ra[3] * (1 - t) + rb[3] * t).toFixed(3);
  return `rgba(${r},${g},${bl},${al})`;
}

/** Multiply the alpha of an rgba()/rgb() string by factor (0..1). */
export function dimRgba(c, factor) {
  if (factor >= 1) return c;
  const p = parseRgba(c);
  if (!p) return c;
  return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] * factor).toFixed(3)})`;
}
```

In `gold-pulse.js`: die lokalen `mixRgba`/`parseRgba`-Definitionen löschen, oben ergänzen:
```js
import { parseRgba, mixRgba, dimRgba } from "./color-utils.js";
```

- [ ] **Step 4: `three-stage.js` — Spotlight-State, BFS-Cache, neue API**

State erweitern (bei den bestehenden `let`-Deklarationen, Zeile ~60):
```js
let centerId = null;
let centerDist = new Map();   // BFS-Distanzen vom Zentrum, gecacht (vorher O(n²): bfsDistance lief pro Knoten im Color-Callback)
let spotlightId = null;       // Hover-Spotlight
```

Helper (neben `bfsDistance`):
```js
function endpointIds(link) {
  const s = typeof link.source === "object" ? link.source.id : link.source;
  const t = typeof link.target === "object" ? link.target.id : link.target;
  return [s, t];
}
```

`nodeColor` umbauen — Spotlight-Zweig davor, Center-Zweig nutzt den Cache:
```js
const SPOT_HAZE = "rgba(150, 180, 205, 0.10)";

function nodeColor(node) {
  const styles = getComputedStyle(document.documentElement);
  const c0 = (styles.getPropertyValue("--node-center") || "#FFFFFF").trim();
  const cAstro = (styles.getPropertyValue("--node-astro") || "#8CF0FF").trim();
  const cGold = (styles.getPropertyValue("--node-gante") || "#F5C24A").trim();
  const cEntity = (styles.getPropertyValue("--node-entity") || "#FFE0B2").trim();
  const hazeColor = "rgba(160, 200, 220, 0.32)";

  // Hover-Spotlight: alles außer Knoten + 1-Hop-Nachbarn wird stark gedimmt.
  if (spotlightId && node.id !== spotlightId) {
    const neigh = adjacency.get(spotlightId);
    if (!neigh || !neigh.has(node.id)) return SPOT_HAZE;
  }

  if (centerId === node.id) return c0;

  if (centerId && centerDist.size) {
    const d = centerDist.get(node.id);
    if (d === undefined || d >= 3) return hazeColor;
  }

  if (colorMode === "kompetenz") {
    return KOMPETENZ_CATEGORY_COLORS[node.category] || cAstro;
  }
  if (node.kind === "entity") return cEntity;
  if (node.kind === "concept-gantefoer") return cGold;
  return cAstro;
}
```

`setCenter` und `setGraphData` füllen den Cache; neue API-Methoden ins `api`-Objekt:
```js
setGraphData(data) {
  rebuildAdjacency(data.nodes || [], data.links || []);
  if (centerId) centerDist = bfsDistance(centerId);
  graph.graphData(data);
},
setCenter(nodeId) {
  centerId = nodeId;
  centerDist = nodeId ? bfsDistance(nodeId) : new Map();
  graph.nodeColor(nodeColor);  // force recompute
},
setSpotlight(nodeId) {
  if (spotlightId === nodeId) return;
  spotlightId = nodeId;
  graph.nodeColor(nodeColor);
},
getLinkDim(link) {
  const [s, t] = endpointIds(link);
  if (spotlightId) {
    return (s === spotlightId || t === spotlightId) ? 1 : 0.15;
  }
  if (centerId && centerDist.size) {
    const far = (d) => d === undefined || d >= 3;
    if (far(centerDist.get(s)) && far(centerDist.get(t))) return 0.35;
  }
  return 1;
},
```

- [ ] **Step 5: `gold-pulse.js` — Link-Dimming anwenden**

Letzte Zeile von `edgeColorAt` (bisher `return mixRgba(baseColor, accent, intensity);`) ersetzen durch:
```js
    return dimRgba(mixRgba(baseColor, accent, intensity), stage.getLinkDim(link));
```
Und im `reducedMotion`-Zweig (bisher `return isBridge ? bridgeColor : baseColor;`):
```js
      return dimRgba(isBridge ? bridgeColor : baseColor, stage.getLinkDim(link));
```

- [ ] **Step 6: `main.js` — Hover verdrahten + Testhook**

Im bestehenden `stage.onNodeHover`-Handler als erste Zeile:
```js
  stage.onNodeHover((node) => {
    stage.setSpotlight(node ? node.id : null);
    if (!node) {
      tooltip.classList.remove("visible");
      return;
    }
    // ... Rest unverändert
```

Direkt nach `const stage = createStage(container, stageOptions);`:
```js
  // Testhook für Playwright (aurum.spec.ts) — bewusst öffentlich, read-only genutzt.
  window.__nebula = { stage };
```

- [ ] **Step 7: `package.json` — Spec registrieren**

```json
"test:e2e": "npx playwright test tests/e2e/showcase.spec.ts tests/e2e/kompetenz.spec.ts tests/e2e/aurum.spec.ts",
```

- [ ] **Step 8: Tests laufen lassen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts tests/e2e/kompetenz.spec.ts tests/e2e/showcase.spec.ts
```
Expected: alle PASS (aurum neu grün, kompetenz/showcase = Regressionsschutz).

- [ ] **Step 9: In-Browser-QA**

```bash
npm run dev
```
Auf `http://127.0.0.1:8042` (nie `localhost`): Hover über einen Knoten → Rest dimmt sichtbar; Hover weg → Normalzustand; Doppelklick-Zentrum → ferne Knoten/Kanten bleiben wie bisher im Haze. `?dataset=astro` gegenprüfen (Bridges pulsieren weiter).

- [ ] **Step 10: Commit**

```bash
git add src/scripts/color-utils.js src/scripts/three-stage.js src/scripts/gold-pulse.js src/scripts/main.js tests/e2e/aurum.spec.ts package.json
git commit -m "feat(aurum): Fokus-Spotlight + BFS-Distanz-Cache + color-utils

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Edge-Flow-Partikel

**Files:**
- Create: `src/scripts/edge-flow.js`
- Modify: `src/scripts/main.js` (kompetenz-only instanziieren, Slider + openCenter verdrahten)
- Test: `tests/e2e/aurum.spec.ts` (neuer Test)

**Interfaces:**
- Consumes: `stage.getGraphForceInstance()`, `stage.getCenterId()` (Task 1 / Bestand)
- Produces: `createEdgeFlow(stage) → { setGold(v), refresh(), particleCountFor(link) }`; `window.__nebula.edgeFlow`

**Hinweis Fließrichtung:** 3d-force-graph animiert Partikel immer source→target. Die Spec-Formulierung „zum Zentrum hin" wird als QA-Experiment behandelt: erst uniform positiv ausliefern; wenn im QA-Step ein Vorzeichen-Trick (negative Speed) sauber rückwärts läuft, in einem Folge-Commit aktivieren. Kein Blocker.

- [ ] **Step 1: Failing Test in `aurum.spec.ts` ergänzen**

```ts
test("edge-flow particles are denser on centre-adjacent links", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz&gold=60"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(async () => {
    const { stage, edgeFlow } = (window as any).__nebula;
    const resp = await fetch("/assets/kompetenz/graph.json");
    const g = await resp.json();
    const center: string = stage.getCenterId();
    const centerLink = g.links.find((l: any) => l.source === center || l.target === center);
    const farLink = g.links.find((l: any) => l.source !== center && l.target !== center);
    return {
      centerCount: centerLink ? edgeFlow.particleCountFor(centerLink) : -1,
      farCount: edgeFlow.particleCountFor(farLink),
    };
  });
  expect(res.farCount).toBeGreaterThanOrEqual(1);
  expect(res.centerCount).toBeGreaterThan(res.farCount);
});
```

- [ ] **Step 2: Test laufen lassen — muss failen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts
```
Expected: FAIL — `edgeFlow` ist undefined.

- [ ] **Step 3: `src/scripts/edge-flow.js` anlegen**

```js
/**
 * Kompetenz Edge-Flow: Wissens-Partikel fliessen entlang der Kanten,
 * deutlich dichter auf Kanten des aktuellen Zentrums. Dichte skaliert
 * mit dem Gold-Slider; reduced-motion schaltet Partikel komplett ab.
 *
 * Überschreibt die Partikel-Callbacks, die gold-pulse registriert —
 * gewollt: der Kompetenz-Graph hat keine Bridge-Edges, es geht nichts
 * verloren. Astro instanziiert dieses Modul nicht.
 */

export function createEdgeFlow(stage) {
  const state = {
    gold: 0.35,
    reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  const fg = stage.getGraphForceInstance();

  function endpointIds(link) {
    const s = typeof link.source === "object" ? link.source.id : link.source;
    const t = typeof link.target === "object" ? link.target.id : link.target;
    return [s, t];
  }

  function isCenterLink(link) {
    const c = stage.getCenterId();
    if (!c) return false;
    const [s, t] = endpointIds(link);
    return s === c || t === c;
  }

  function particleCountFor(link) {
    if (state.reducedMotion || state.gold < 0.15) return 0;
    return isCenterLink(link) ? 1 + Math.round(3 * state.gold) : 1;
  }

  fg.linkDirectionalParticles(particleCountFor);
  fg.linkDirectionalParticleSpeed(() => 0.0035 + state.gold * 0.005);
  fg.linkDirectionalParticleWidth((link) => (isCenterLink(link) ? 1.6 : 1.0) + state.gold * 1.0);
  fg.linkDirectionalParticleColor((link) => {
    const styles = getComputedStyle(document.documentElement);
    const goldC = (styles.getPropertyValue("--edge-gold-rgba") || "rgba(245, 200, 90, 1)").trim();
    const baseC = (styles.getPropertyValue("--edge-base-rgba") || "rgba(140, 220, 255, 0.5)").trim();
    return isCenterLink(link) ? goldC : baseC;
  });

  function refresh() {
    // Partikel-Anzahl wird von 3d-force-graph nur bei Neuzuweisung des
    // Callbacks neu ausgewertet — nach setGold/setCenter nötig.
    fg.linkDirectionalParticles(particleCountFor);
  }

  return {
    setGold(v) {
      state.gold = Math.max(0, Math.min(1, v));
      refresh();
    },
    refresh,
    particleCountFor,
  };
}
```

- [ ] **Step 4: `main.js` verdrahten**

Import oben: `import { createEdgeFlow } from "./edge-flow.js";`

Nach dem `createSparkles(...)`-Block (Task 3 entfernt Sparkles später — Reihenfolge hier egal, Hauptsache nach `createGoldPulse`):
```js
  // Edge-Flow nur für Kompetenz: überschreibt die Bridge-Partikel von
  // gold-pulse (Kompetenz hat keine Bridges).
  let edgeFlow = null;
  if (dataset === "kompetenz") {
    edgeFlow = createEdgeFlow(stage);
    edgeFlow.setGold(initialGold / 100);
    window.__nebula.edgeFlow = edgeFlow;
  }
```
**Achtung Reihenfolge:** Der Block muss NACH `const initialGold = ...` (Zeile ~89) stehen. Im Slider-`input`-Listener ergänzen:
```js
    if (edgeFlow) edgeFlow.setGold(v / 100);
```
In `openCenter(nodeId)` nach `stage.setCenter(nodeId);` ergänzen:
```js
    if (edgeFlow) edgeFlow.refresh();
```
Ebenso im Tour-`onStationChange`-Callback nach `stage.setCenter(node.id);`:
```js
            if (edgeFlow) edgeFlow.refresh();
```

- [ ] **Step 5: Tests laufen lassen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts tests/e2e/kompetenz.spec.ts
```
Expected: PASS.

- [ ] **Step 6: In-Browser-QA + Richtungs-Experiment**

`npm run dev` → `http://127.0.0.1:8042`: Partikel fließen auf allen Kanten, sichtbar dichter/goldener am Zentrum; Gold-Slider 0 → keine Partikel, 100 → dicht. Doppelklick auf anderen Knoten → Dichte wandert mit.
Richtungs-Experiment (DevTools-Konsole): `__nebula.stage.getGraphForceInstance().linkDirectionalParticleSpeed((l) => -0.005)` — wenn Partikel sauber rückwärts laufen (kein Flackern/Sprung), Notiz für Folge-Commit „Richtung zum Zentrum"; sonst verwerfen und im Plan-Dokument abhaken.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/edge-flow.js src/scripts/main.js tests/e2e/aurum.spec.ts
git commit -m "feat(aurum): Edge-Flow-Partikel, dichter am Zentrum, Gold-skaliert

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: THREE-Vendor + Import Map + Sternenfeld/Nebel + Sparkles-Rente

**Files:**
- Create: `src/vendor/three/three.module.min.js` (aus npm three@0.168.0)
- Create: `src/vendor/three/postprocessing/Pass.js`, `src/vendor/three/postprocessing/UnrealBloomPass.js`
- Create: `src/vendor/three/shaders/CopyShader.js`, `src/vendor/three/shaders/LuminosityHighPassShader.js`
- Create: `src/vendor/three/LICENSE` (MIT-Lizenz aus dem npm-Paket)
- Create: `src/scripts/scene-dressing.js`
- Delete: `src/scripts/sparkles.js`
- Modify: `src/index.html` (Import Map, `#sparkles-layer` raus)
- Modify: `src/styles/base.css` (`.sparkles-layer`-Block raus, ~Zeile 133)
- Modify: `src/scripts/main.js` (Sparkles raus, Dressing rein)
- Modify: `package.json` (+ devDependency three)
- Test: `tests/e2e/aurum.spec.ts`

**Interfaces:**
- Consumes: `stage.getGraphForceInstance().scene()`
- Produces: `createSceneDressing(stage) → { setGold(v), isActive() }`; `window.__nebula.dressing`; Import-Map-Eintrag `"three"` (Task 4+5 verlassen sich darauf); Vendor-Pfad `assets/vendor/three/postprocessing/UnrealBloomPass.js` (Task 4)

- [ ] **Step 1: Failing Test ergänzen**

```ts
test("3D scene dressing is active and the 2D sparkles layer is gone", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const active = await page.evaluate(() => (window as any).__nebula.dressing.isActive());
  expect(active).toBe(true);
  await expect(page.locator("#sparkles-layer")).toHaveCount(0);
});

test("reduced motion still renders the graph with dressing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Test laufen lassen — muss failen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts
```
Expected: FAIL — `dressing` undefined; `#sparkles-layer` existiert noch.

- [ ] **Step 3: three@0.168.0 holen und Vendor-Dateien kopieren**

```bash
npm install --save-dev --save-exact three@0.168.0
mkdir -p src/vendor/three/postprocessing src/vendor/three/shaders
cp node_modules/three/build/three.module.min.js src/vendor/three/
cp node_modules/three/examples/jsm/postprocessing/Pass.js src/vendor/three/postprocessing/
cp node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js src/vendor/three/postprocessing/
cp node_modules/three/examples/jsm/shaders/CopyShader.js src/vendor/three/shaders/
cp node_modules/three/examples/jsm/shaders/LuminosityHighPassShader.js src/vendor/three/shaders/
cp node_modules/three/LICENSE src/vendor/three/
```

Import-Vollständigkeit verifizieren (alle relativen Imports müssen auf kopierte Dateien zeigen):
```bash
grep -h "^import" src/vendor/three/postprocessing/*.js src/vendor/three/shaders/*.js
```
Expected: nur Imports aus `'three'`, `'./Pass.js'`, `'../shaders/CopyShader.js'`, `'../shaders/LuminosityHighPassShader.js'`. Taucht etwas anderes auf (z. B. `MaskPass`), die fehlende Datei ebenfalls aus `node_modules/three/examples/jsm/...` an die strukturgleiche Stelle kopieren.

In JEDE kopierte Datei (außer LICENSE) als erste Zeile einen Kopplungs-Header einfügen:
```js
// VENDORED from three@0.168.0 — MUSS zur THREE-Revision im 3d-force-graph-Bundle passen (aktuell r168).
```

- [ ] **Step 4: Import Map in `src/index.html`**

Direkt VOR `<script src="assets/vendor/3d-force-graph.min.js"></script>` (Zeile ~142):
```html
  <script type="importmap">
  { "imports": { "three": "./assets/vendor/three/three.module.min.js" } }
  </script>
```
Außerdem `<canvas class="sparkles-layer" id="sparkles-layer" aria-hidden="true"></canvas>` (Zeile 90) ersatzlos löschen.

- [ ] **Step 5: `src/scripts/scene-dressing.js` anlegen**

```js
/**
 * Aurum-Dressing: echtes 3D-Sternenfeld (THREE.Points) + weiche
 * Nebel-Billboards in der Graph-Szene. Ersetzt das 2D-Sparkles-Overlay
 * (Entscheid 2026-07-09): echte Parallaxe statt flachem Canvas.
 *
 * "three" kommt per Import Map aus src/vendor/three/ (r168 — muss zur
 * Revision im 3d-force-graph-Bundle passen). Objekte aus dieser
 * THREE-Instanz werden vom Bundle-Renderer gerendert; das funktioniert,
 * weil beide Instanzen dieselbe Revision haben (Duck-Typing, kein instanceof).
 */
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color,
  Float32BufferAttribute, Group, Points, PointsMaterial,
  Sprite, SpriteMaterial,
} from "three";

const STAR_COUNT = 1500;
const STAR_BASE = new Color("#cfe4ff");
const STAR_GOLD = new Color("#f5c24a");

function makeNebulaTexture(rgb) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb}, 0.28)`);
  grad.addColorStop(0.5, `rgba(${rgb}, 0.10)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

export function createSceneDressing(stage) {
  const fg = stage.getGraphForceInstance();
  const scene = typeof fg.scene === "function" ? fg.scene() : null;
  if (!scene) return { setGold() {}, isActive: () => false };

  const group = new Group();
  group.name = "aurum-dressing";

  // Sternenfeld: Kugelschale (r 700–1600) um die Graph-Wolke.
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 700 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const starMat = new PointsMaterial({
    size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0.75,
    depthWrite: false, blending: AdditiveBlending, color: STAR_BASE.clone(),
  });
  group.add(new Points(geo, starMat));

  // Nebel-Billboards: cyan / gold / violett, weit hinter der Wolke.
  const nebulaSpecs = [
    { rgb: "140, 200, 255", scale: 1300, pos: [-500, 150, -700] },
    { rgb: "245, 194, 74", scale: 1000, pos: [600, -200, -900] },
    { rgb: "180, 120, 235", scale: 900, pos: [100, 380, -1100] },
  ];
  for (const spec of nebulaSpecs) {
    const mat = new SpriteMaterial({
      map: makeNebulaTexture(spec.rgb), transparent: true,
      depthWrite: false, opacity: 0.8,
    });
    const sprite = new Sprite(mat);
    sprite.scale.set(spec.scale, spec.scale, 1);
    sprite.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    group.add(sprite);
  }

  scene.add(group);

  // Kaum wahrnehmbare Dauerrotation — statisch bei reduced motion.
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    (function spin() {
      group.rotation.y += 0.00008;
      requestAnimationFrame(spin);
    })();
  }

  return {
    setGold(v) {
      const t = Math.max(0, Math.min(1, v)) * 0.6;
      starMat.color.copy(STAR_BASE).lerp(STAR_GOLD, t);
    },
    isActive: () => true,
  };
}
```

- [ ] **Step 6: `main.js` — Sparkles raus, Dressing rein**

- Import `createSparkles` löschen, Import ergänzen: `import { createSceneDressing } from "./scene-dressing.js";`
- Zeile `const sparkles = createSparkles(document.getElementById("sparkles-layer"));` ersetzen durch:
```js
  const dressing = createSceneDressing(stage);
  window.__nebula.dressing = dressing;
```
- `sparkles.setGold(initialGold / 100);` ersetzen durch `dressing.setGold(initialGold / 100);`
- Im Slider-Listener `sparkles.setGold(v / 100);` ersetzen durch `dressing.setGold(v / 100);`
- Datei `src/scripts/sparkles.js` löschen: `git rm src/scripts/sparkles.js`
- In `src/styles/base.css` den kompletten `.sparkles-layer { ... }`-Block (~Zeile 133) löschen.

- [ ] **Step 7: Tests laufen lassen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts tests/e2e/kompetenz.spec.ts tests/e2e/showcase.spec.ts
```
Expected: PASS. Falls `showcase.spec.ts` auf `#sparkles-layer` referenziert (vorher mit `grep -n sparkles tests/e2e/showcase.spec.ts` prüfen!), die betroffene Assertion an die neue Realität anpassen (Layer existiert nicht mehr).

- [ ] **Step 8: In-Browser-QA**

`npm run dev` → beide Datensätze: Sternenfeld sichtbar hinter der Wolke, Parallaxe beim Draggen/Zoomen deutlich spürbar, Nebel-Flecken dezent. Gold-Slider 100 → Sterne golden getönt. Kein Doppel-Rauschen mehr (Sparkles weg). FPS subjektiv flüssig (DevTools-Performance-Tab bei Zweifel).

- [ ] **Step 9: Commit**

```bash
git add src/vendor/three/ src/scripts/scene-dressing.js src/index.html src/styles/base.css src/scripts/main.js package.json package-lock.json tests/e2e/aurum.spec.ts
git rm src/scripts/sparkles.js
git commit -m "feat(aurum): THREE r168 Vendor + Import Map + 3D-Sternenfeld/Nebel, 2D-Sparkles in Rente

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
(Falls `showcase.spec.ts` angepasst wurde, mit stagen.)

---

### Task 4: Bloom

**Files:**
- Create: `src/scripts/bloom.js`
- Modify: `src/scripts/main.js`
- Test: `tests/e2e/aurum.spec.ts`

**Interfaces:**
- Consumes: `stage.getGraphForceInstance().postProcessingComposer()`; Vendor-Dateien + Import Map aus Task 3
- Produces: `createBloom(stage) → { setGold(v), isActive() }`; `window.__nebula.bloom`

- [ ] **Step 1: Failing Test ergänzen**

```ts
test("bloom is active at default gold and off at gold 0", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz&gold=35"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(() => {
    const { bloom } = (window as any).__nebula;
    const atDefault = bloom.isActive();
    bloom.setGold(0);
    const atZero = bloom.isActive();
    bloom.setGold(0.35);
    return { atDefault, atZero };
  });
  expect(res.atDefault).toBe(true);
  expect(res.atZero).toBe(false);
});
```

- [ ] **Step 2: Test laufen lassen — muss failen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts
```
Expected: FAIL — `bloom` undefined.

- [ ] **Step 3: `src/scripts/bloom.js` anlegen**

```js
/**
 * Bloom-Post-Processing: UnrealBloomPass (three r168, Vendor) wird in den
 * Composer gepusht, den das 3d-force-graph-Bundle bereits mitbringt
 * (postProcessingComposer()). Hoher Threshold: nur helle Kerne glühen.
 *
 * Fallback: schlägt irgendetwas fehl (kein Composer, WebGL-Limit),
 * liefert createBloom ein No-op-Objekt — der Graph rendert normal weiter.
 */
import { Vector2 } from "three";
import { UnrealBloomPass } from "../vendor/three/postprocessing/UnrealBloomPass.js";

export function createBloom(stage) {
  const noop = { setGold() {}, isActive: () => false };
  try {
    const fg = stage.getGraphForceInstance();
    if (typeof fg.postProcessingComposer !== "function") return noop;
    const composer = fg.postProcessingComposer();
    if (!composer || typeof composer.addPass !== "function") return noop;

    const pass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      0.5,   // strength — wird von setGold sofort überschrieben
      0.6,   // radius
      0.55,  // threshold: nur helle Knoten/Partikel bloomen, kein Flächen-Matsch
    );
    composer.addPass(pass);

    return {
      setGold(v) {
        const g = Math.max(0, Math.min(1, v));
        pass.enabled = g > 0.01;
        pass.strength = 0.15 + 1.05 * g;  // 35 % Gold ≈ 0.52, 100 % = 1.2 (Spec)
      },
      isActive: () => pass.enabled,
    };
  } catch (err) {
    console.warn("Bloom deaktiviert:", err);
    return noop;
  }
}
```

- [ ] **Step 4: `main.js` verdrahten**

Import: `import { createBloom } from "./bloom.js";`

Nach dem Dressing-Block:
```js
  const bloom = createBloom(stage);
  window.__nebula.bloom = bloom;
```
Nach `dressing.setGold(initialGold / 100);`:
```js
  bloom.setGold(initialGold / 100);
```
Im Slider-Listener:
```js
    bloom.setGold(v / 100);
```

- [ ] **Step 5: Tests laufen lassen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts tests/e2e/kompetenz.spec.ts
```
Expected: PASS. Der bestehende `pageerror`-Check in kompetenz.spec.ts fängt Composer/Pass-Kompatibilitätsfehler.

- [ ] **Step 6: In-Browser-QA**

`npm run dev`: Gold 35 % → dezenter Glow auf hellen Knoten/Zentrum; Gold 100 % → sattes Glühen, aber Hintergrund-Nebel NICHT ausgewaschen (sonst threshold auf 0.65–0.75 anheben und radius auf 0.4 senken — direkt in bloom.js nachjustieren und erneut bauen); Gold 0 → kein Bloom. DOM-Overlays (Labels, Reticle, Modal) sind unbetroffen (eigene Layer). Beide Themes prüfen. FPS beobachten: bei sichtbarem Einbruch auf einem normalen Laptop `pass.resolution` halbieren (`new Vector2(window.innerWidth / 2, window.innerHeight / 2)`).

- [ ] **Step 7: Commit**

```bash
git add src/scripts/bloom.js src/scripts/main.js tests/e2e/aurum.spec.ts
git commit -m "feat(aurum): UnrealBloomPass am Bundle-Composer, Gold-gesteuert

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Kategorie-Geometrien

**Files:**
- Create: `src/scripts/node-forms.js`
- Modify: `src/scripts/three-stage.js` (`sizeFromWeight` exportieren, `getNodeRgba` + `attachNodeForms` API, refresh-Hooks)
- Modify: `src/scripts/main.js` (kompetenz-only anhängen)
- Test: `tests/e2e/aurum.spec.ts`

**Interfaces:**
- Consumes: `stage.getNodeRgba(node)` (neu), `stage.getCenterId()`, `stage.getNodeById(id)`, `sizeFromWeight` (neu exportiert), `parseRgba` aus `color-utils.js`, `"three"` aus Task 3
- Produces: `createNodeForms(stage) → { objectFor(node), refreshVisuals() }`; `stage.attachNodeForms(forms)`; `window.__nebula.forms`

- [ ] **Step 1: Failing Test ergänzen**

```ts
test("kompetenz nodes render as category geometries", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(() => {
    const { forms, stage } = (window as any).__nebula;
    if (!forms) return null;
    const fg = stage.getGraphForceInstance();
    // Custom-Objekte hängen als Kind-Meshes an den Node-Objekten der Szene.
    let meshCount = 0;
    fg.scene().traverse((o: any) => { if (o.isMesh && o.userData?.aurumForm) meshCount++; });
    return { meshCount };
  });
  expect(res).not.toBeNull();
  expect(res!.meshCount).toBeGreaterThan(50);
});

test("astro keeps default spheres (no custom forms)", async ({ page }) => {
  await page.goto(url("/?dataset=astro"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const hasForms = await page.evaluate(() => Boolean((window as any).__nebula.forms));
  expect(hasForms).toBe(false);
});
```

- [ ] **Step 2: Test laufen lassen — muss failen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts
```
Expected: FAIL — `forms` undefined bzw. `meshCount` 0.

- [ ] **Step 3: `three-stage.js` erweitern**

`sizeFromWeight` exportieren (Zeile ~31: `function` → `export function`).

State-Ergänzung: `let formsRef = null;`

Ins `api`-Objekt:
```js
getNodeRgba(node) {
  return nodeColor(node);
},
attachNodeForms(forms) {
  formsRef = forms;
  graph.nodeThreeObject((node) => forms.objectFor(node));
},
```

In `setCenter` und `setSpotlight` jeweils als letzte Zeile:
```js
  if (formsRef) formsRef.refreshVisuals();
```

- [ ] **Step 4: `src/scripts/node-forms.js` anlegen**

```js
/**
 * Kategorie-Geometrien für den Kompetenz-Graph (nodeThreeObject):
 *   competence = Ikosaeder · synthesis = Torus · entity = Oktaeder
 *   topic = Kugel (mittel) · concept = Kugel (low-poly)
 * Emissive-Material, damit der Bloom-Pass die Formen aufnimmt.
 *
 * Farben/Dimming kommen aus derselben Quelle wie vorher (stage.getNodeRgba →
 * nodeColor-Logik inkl. Spotlight/Haze); refreshVisuals() überträgt sie auf
 * die Material-Registry, weil der nodeColor-Callback für Custom-Objekte
 * nicht mehr greift.
 */
import {
  Color, IcosahedronGeometry, Mesh, MeshLambertMaterial,
  OctahedronGeometry, SphereGeometry, TorusGeometry,
} from "three";
import { sizeFromWeight } from "./three-stage.js";
import { parseRgba } from "./color-utils.js";

const NODE_REL_SIZE = 4; // muss graph.nodeRelSize(4) in three-stage.js entsprechen

function geometryFor(category, r) {
  switch (category) {
    case "competence": return new IcosahedronGeometry(r, 0);
    case "synthesis": return new TorusGeometry(r * 0.75, r * 0.3, 10, 24);
    case "entity": return new OctahedronGeometry(r, 0);
    case "topic": return new SphereGeometry(r, 20, 14);
    default: return new SphereGeometry(r * 0.9, 10, 8); // concept: bewusst low-poly
  }
}

// "rgba(r,g,b,a)" → { color: THREE.Color, alpha } ; Hex-Strings haben alpha 1.
function splitColor(str) {
  const p = parseRgba(str);
  if (p) return { color: new Color(`rgb(${p[0]},${p[1]},${p[2]})`), alpha: p[3] };
  return { color: new Color(str), alpha: 1 };
}

export function createNodeForms(stage) {
  const registry = new Map(); // nodeId -> material

  function applyVisual(node, mat) {
    const { color, alpha } = splitColor(stage.getNodeRgba(node));
    mat.color.copy(color);
    mat.emissive.copy(color);
    const isCenter = stage.getCenterId() === node.id;
    mat.emissiveIntensity = isCenter ? 0.9 : 0.4;
    // Haze-/Spotlight-Dimming kommt als rgba-Alpha aus getNodeRgba.
    mat.opacity = alpha < 1 ? Math.max(alpha, 0.08) : 0.95;
  }

  return {
    objectFor(node) {
      const r = NODE_REL_SIZE * Math.cbrt(sizeFromWeight(node.weight));
      const mat = new MeshLambertMaterial({ transparent: true });
      registry.set(node.id, mat);
      applyVisual(node, mat);
      const mesh = new Mesh(geometryFor(node.category, r), mat);
      mesh.userData.aurumForm = true;
      return mesh;
    },
    refreshVisuals() {
      for (const [id, mat] of registry) {
        const node = stage.getNodeById(id);
        if (node) applyVisual(node, mat);
      }
    },
  };
}
```

**Hinweis Radius-Formel:** 3d-force-graph rendert Default-Kugeln mit `radius = nodeRelSize * cbrt(nodeVal)`; `nodeVal` ist hier `sizeFromWeight(weight)`. Die Formel oben repliziert das, damit Custom-Formen dieselbe Größenstaffelung haben. Im QA-Step gegen den Astro-Datensatz (Default-Kugeln) auf ähnliche Größenordnung vergleichen.

- [ ] **Step 5: `main.js` verdrahten**

Import: `import { createNodeForms } from "./node-forms.js";`

Direkt nach `window.__nebula = { stage };` und VOR `stage.setGraphData(graphData);`:
```js
  // Kategorie-Formen nur für Kompetenz; Astro behält Default-Kugeln.
  if (dataset === "kompetenz") {
    const forms = createNodeForms(stage);
    stage.attachNodeForms(forms);
    window.__nebula.forms = forms;
  }
```

- [ ] **Step 6: Tests laufen lassen**

```bash
npm run build:all && npx playwright test tests/e2e/aurum.spec.ts tests/e2e/kompetenz.spec.ts tests/e2e/showcase.spec.ts
```
Expected: PASS — inkl. der bestehenden Modal-/Search-Tests (Klick-Picking auf Custom-Meshes wird durch den Search-Test indirekt, durch QA direkt geprüft).

- [ ] **Step 7: In-Browser-QA (Pflicht — Picking!)**

`npm run dev`:
1. Klick direkt auf mehrere Knoten (große + kleine) → Tooltip + Modal öffnen (Raycast gegen Custom-Meshes).
2. Hover-Spotlight dimmt Formen (Opacity sichtbar runter) — nicht nur Kanten.
3. Doppelklick → neues Zentrum leuchtet weiß-emissiv.
4. Formen unterscheidbar: Ikosaeder/Torus/Oktaeder erkennbar bei normalem Zoom; Tori nicht störend groß.
5. Bloom nimmt die Emissive-Formen mit (Gold 100 kurz prüfen).
6. `?dataset=astro`: weiterhin Kugeln, keine Fehler.

- [ ] **Step 8: Commit**

```bash
git add src/scripts/node-forms.js src/scripts/three-stage.js src/scripts/main.js tests/e2e/aurum.spec.ts
git commit -m "feat(aurum): Kategorie-Geometrien via nodeThreeObject, Spotlight-kompatibel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Doku, CLAUDE.md-Regel, Voll-QA, Sweep

**Files:**
- Modify: `CLAUDE.md` (THREE-Regel ersetzen)
- Modify: `docs/CHANGELOG.md` (Aurum-Nebula-Eintrag)
- Modify: `docs/ARCHITECTURE.md` (neue Module + Import Map, kurzer Absatz)
- Test: kompletter Suite-Lauf + Sweep + Voll-QA

**Interfaces:**
- Consumes: alles aus Task 1–5.
- Produces: deploy-bereiter Stand.

- [ ] **Step 1: `CLAUDE.md` — Regel aktualisieren**

Den Bullet „**3d-force-graph-Bundle exponiert THREE NICHT.** …" ersetzen durch:
```markdown
- **THREE ist als Vendor-Modul eingebunden** (`src/vendor/three/`, r168 — MUSS zur THREE-Revision im 3d-force-graph-Bundle passen, Check: `grep -o 'const a="168"' src/vendor/3d-force-graph.min.js`). Import via Import Map (`"three"` in index.html). Bei einem Update des 3d-force-graph-Bundles beide gemeinsam heben. Custom-Geometries (`node-forms.js`), Szenen-Dressing und Bloom hängen daran.
```

- [ ] **Step 2: `docs/CHANGELOG.md` — Eintrag oben anfügen**

```markdown
## 2026-07-09 — Aurum Nebula (Visual-Upgrade Kompetenz-Graph)

- Fokus-Spotlight: Hover dimmt alles außer 1-Hop-Nachbarschaft; BFS-Distanzen jetzt gecacht (vorher O(n²) im Color-Callback).
- Edge-Flow-Partikel entlang aller Kanten, dichter am Zentrum (kompetenz-only).
- THREE r168 als Vendor + Import Map; echtes 3D-Sternenfeld + Nebel-Billboards (Parallaxe), 2D-Sparkles-Overlay entfernt.
- Bloom (UnrealBloomPass) am Bundle-Composer, Threshold-begrenzt.
- Kategorie-Geometrien: competence=Ikosaeder, synthesis=Torus, entity=Oktaeder, topic/concept=Kugeln (kompetenz-only).
- Gold-Slider ist Master-Regler für Bloom-Stärke, Partikel-Dichte und Sternen-Tönung.
```

- [ ] **Step 3: `docs/ARCHITECTURE.md` — Modul-Absatz ergänzen**

Im Frontend-Abschnitt (bestehende Modul-Liste) ergänzen:
```markdown
Aurum-Nebula-Module (2026-07): `color-utils.js` (rgba-Helper), `edge-flow.js`
(Kanten-Partikel, kompetenz-only), `scene-dressing.js` (3D-Sternenfeld/Nebel),
`bloom.js` (UnrealBloomPass am Bundle-Composer), `node-forms.js`
(Kategorie-Geometrien, kompetenz-only). THREE r168 liegt als Vendor-Modul in
`src/vendor/three/` und wird per Import Map aufgelöst; die Revision ist an das
3d-force-graph-Bundle gekoppelt. `sparkles.js` wurde entfernt (ersetzt durch
scene-dressing).
```

- [ ] **Step 4: Komplette Suite + Sweep**

```bash
npm run build:all
npm run test:py
npm run test:e2e
python tools/pre_deploy_sweep.py --dist dist --write-manifest
```
Expected: pytest PASS, alle drei E2E-Specs PASS, Sweep exit 0.

- [ ] **Step 5: Voll-QA im Browser (Pflichtprotokoll)**

`npm run dev` → `http://127.0.0.1:8042`, Matrix abarbeiten:

| Check | kompetenz | astro |
|---|---|---|
| Cold-Open-Intro ohne Fehler | ☐ | ☐ |
| Hover-Spotlight + Tooltip | ☐ | ☐ (kein forms, Spotlight trotzdem) |
| Klick → Modal, Doppelklick → Zentrum | ☐ | ☐ |
| Gold 0 / 35 / 100 (Bloom, Partikel, Sterne) | ☐ | ☐ |
| Theme crab + dome | ☐ | ☐ |
| Plate-Modus (P) | ☐ | — |
| Auto-Tour 2 Stationen | ☐ | — |
| Mobile-Viewport (DevTools 390×780) | ☐ | — |
| reduced-motion (DevTools-Emulation): keine Partikel, Sterne statisch | ☐ | — |
| FPS subjektiv flüssig bei Gold 100 | ☐ | ☐ |

Auffälligkeiten → fixen, betroffene Task-Tests erneut laufen lassen.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/CHANGELOG.md docs/ARCHITECTURE.md
git commit -m "docs(aurum): CLAUDE.md-THREE-Regel + Changelog + Architektur-Notiz

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Abschluss-Check**

```bash
git log --oneline -8 && git status --short
```
Expected: 6 Aurum-Commits, working tree clean. Deploy erfolgt separat (nicht Teil dieses Plans); vor Deploy gilt die Sweep-Pflicht aus CLAUDE.md.

---

## Bewusst NICHT im Plan

- Kein Deploy (separater Schritt, User-Entscheid).
- Keine Kategorie-Anker-Forces, kein Typed-Link-Styling, keine Story-Tour 2.0 (Spec: verworfen/vertagt).
- Keine Partikel-Richtungsumkehr als Pflicht — nur QA-Experiment in Task 2.
- Kein dynamisches Lazy-Loading der THREE-Module (YAGNI; statischer Import reicht, ~700 KB ungezippt / deutlich weniger über Brotli bei Cloudflare).
