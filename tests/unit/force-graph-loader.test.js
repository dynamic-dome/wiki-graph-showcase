import test from "node:test";
import assert from "node:assert/strict";
import { afterFirstPaint, loadForceGraph, loadThreeModules, THREE_MODULES, FORCE_GRAPH_SRC } from "../../src/scripts/force-graph-loader.js";

function fakeWin() {
  const rafQueue = [];
  const timers = [];
  return {
    rafQueue,
    timers,
    requestAnimationFrame: (cb) => { rafQueue.push(cb); },
    setTimeout: (cb, ms) => { timers.push({ cb, ms }); return timers.length; },
    clearTimeout: () => {},
  };
}

test("afterFirstPaint loest erst nach zwei Frames und einem Makrotask auf", async () => {
  const win = fakeWin();
  let done = false;
  const p = afterFirstPaint(win).then(() => { done = true; });
  assert.equal(done, false);
  win.rafQueue.shift()();            // Frame 1
  win.rafQueue.shift()();            // Frame 2
  assert.equal(done, false);
  win.timers.find((t) => t.ms === 0).cb(); // Makrotask
  await p;
  assert.equal(done, true);
});

test("afterFirstPaint loest im Hintergrund-Tab ueber das Sicherheitsnetz auf", async () => {
  const win = fakeWin();
  const p = afterFirstPaint(win);
  win.timers.find((t) => t.ms === 1500).cb(); // rAF feuert nie
  await p;
});

test("FORCE_GRAPH_SRC zeigt auf die ESM-Variante (ohne eigene THREE-Kopie)", () => {
  assert.match(FORCE_GRAPH_SRC, /3d-force-graph\.esm\.min\.js$/);
});

test("loadForceGraph importiert das Modul und liefert den Default-Export", async () => {
  let requested;
  const ForceGraph3D = function ForceGraph3D() {};
  const fg = await loadForceGraph(async (src) => { requested = src; return { default: ForceGraph3D }; });
  assert.equal(fg, ForceGraph3D);
  assert.equal(requested, FORCE_GRAPH_SRC);
});

test("loadForceGraph lehnt bei Importfehler ab", async () => {
  await assert.rejects(
    loadForceGraph(async () => { throw new TypeError("boom"); }),
    /Failed to load .*boom/,
  );
});

test("loadForceGraph lehnt ab, wenn der Default-Export fehlt", async () => {
  await assert.rejects(loadForceGraph(async () => ({})), /default export missing/);
  await assert.rejects(loadForceGraph(async () => ({ default: 42 })), /default export missing/);
});

test("loadThreeModules holt guard, node-forms, scene-dressing und bloom und liefert die Fabriken (#9949)", async () => {
  const geladen = [];
  const importer = async (name) => {
    geladen.push(name);
    return { createNodeForms: "nf", createSceneDressing: "sd", createBloom: "bl" };
  };
  const m = await loadThreeModules(importer);
  assert.deepEqual(geladen.sort(), Object.values(THREE_MODULES).sort());
  assert.equal(m.createNodeForms, "nf");
  assert.equal(m.createSceneDressing, "sd");
  assert.equal(m.createBloom, "bl");
});

test("loadThreeModules meldet einen fehlgeschlagenen Import mit Klartext", async () => {
  const importer = async (name) => { if (name.includes("bloom")) throw new Error("404"); return {}; };
  await assert.rejects(() => loadThreeModules(importer), /Failed to load THREE modules: 404/);
});

test("main.js importiert nichts mehr statisch, das THREE zieht (LCP, #9949)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../src/scripts/main.js", import.meta.url), "utf8");
  for (const m of ["three-guard", "node-forms", "scene-dressing", "bloom"]) {
    assert.doesNotMatch(src, new RegExp(`^import[^\n]*${m}`, "m"), `${m} darf nicht statisch importiert werden`);
  }
});
