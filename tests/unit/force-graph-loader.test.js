import test from "node:test";
import assert from "node:assert/strict";
import { afterFirstPaint, loadForceGraph, FORCE_GRAPH_SRC } from "../../src/scripts/force-graph-loader.js";

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

function fakeDoc({ onAppend }) {
  const view = {};
  const head = {
    appendChild(el) { onAppend(el, view); },
  };
  return { defaultView: view, head, createElement: () => ({}) };
}

test("loadForceGraph fuegt ein async-Script ein und liefert ForceGraph3D", async () => {
  let inserted;
  const doc = fakeDoc({
    onAppend(el, view) {
      inserted = el;
      view.ForceGraph3D = function ForceGraph3D() {};
      el.onload();
    },
  });
  const fg = await loadForceGraph(doc);
  assert.equal(typeof fg, "function");
  assert.equal(inserted.src, FORCE_GRAPH_SRC);
  assert.equal(inserted.async, true);
});

test("loadForceGraph lehnt bei Ladefehler ab", async () => {
  const doc = fakeDoc({ onAppend(el) { el.onerror(); } });
  await assert.rejects(loadForceGraph(doc), /Failed to load/);
});

test("loadForceGraph lehnt ab, wenn das Global nach dem Laden fehlt", async () => {
  const doc = fakeDoc({ onAppend(el) { el.onload(); } });
  await assert.rejects(loadForceGraph(doc), /ForceGraph3D global missing/);
});

test("loadForceGraph nutzt ein vorhandenes Global ohne neues Script", async () => {
  let appended = false;
  const doc = fakeDoc({ onAppend() { appended = true; } });
  doc.defaultView.ForceGraph3D = function ForceGraph3D() {};
  await loadForceGraph(doc);
  assert.equal(appended, false);
});
