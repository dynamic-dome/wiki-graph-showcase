import test from "node:test";
import assert from "node:assert/strict";
import {
  DATASETS, DEFAULT_DATASET, EARLY_GRAPH_KEY, loadGraph, takeEarlyGraph,
} from "../../src/scripts/graph-loader.js";
import {
  EARLY_GRAPH_KEY as EARLY_KEY_IN_SCRIPT, EARLY_GRAPH_URL, startEarlyGraph,
} from "../../src/scripts/early-graph.js";

const okResponse = (body, label = "x") => ({ ok: true, status: 200, label, json: async () => body });

test("early-graph.js und graph-loader.js halten Schluessel und Standard-URL synchron (#10019)", () => {
  assert.equal(EARLY_KEY_IN_SCRIPT, EARLY_GRAPH_KEY);
  assert.equal(EARLY_GRAPH_URL, `${DATASETS[DEFAULT_DATASET].base}/graph.json`);
});

test("startEarlyGraph startet genau einen fetch und legt URL plus Promise ab", async () => {
  const calls = [];
  const scope = { fetch: (url) => { calls.push(url); return Promise.resolve(okResponse({ nodes: [] })); } };
  startEarlyGraph(scope);
  assert.deepEqual(calls, [EARLY_GRAPH_URL]);
  assert.equal(scope[EARLY_GRAPH_KEY].url, EARLY_GRAPH_URL);
  assert.equal((await scope[EARLY_GRAPH_KEY].promise).ok, true);
});

test("startEarlyGraph ohne fetch tut nichts und wirft nicht", () => {
  const scope = {};
  startEarlyGraph(scope);
  assert.equal(scope[EARLY_GRAPH_KEY], undefined);
});

test("takeEarlyGraph liefert die fruehe Antwort genau einmal", async () => {
  const early = okResponse({ nodes: [1] });
  const scope = { [EARLY_GRAPH_KEY]: { url: EARLY_GRAPH_URL, promise: Promise.resolve(early) } };
  assert.equal(await takeEarlyGraph(EARLY_GRAPH_URL, scope), early);
  assert.equal(await takeEarlyGraph(EARLY_GRAPH_URL, scope), null);
});

test("takeEarlyGraph ignoriert eine fremde URL und laesst den Abruf stehen", async () => {
  const early = okResponse({});
  const scope = { [EARLY_GRAPH_KEY]: { url: EARLY_GRAPH_URL, promise: Promise.resolve(early) } };
  assert.equal(await takeEarlyGraph("assets/graph.json", scope), null);
  assert.ok(scope[EARLY_GRAPH_KEY]);
});

test("takeEarlyGraph meldet null bei Netzfehler (null-Promise) und bei Status != ok", async () => {
  const failed = { [EARLY_GRAPH_KEY]: { url: EARLY_GRAPH_URL, promise: Promise.resolve(null) } };
  assert.equal(await takeEarlyGraph(EARLY_GRAPH_URL, failed), null);
  const notOk = { [EARLY_GRAPH_KEY]: { url: EARLY_GRAPH_URL, promise: Promise.resolve({ ok: false, status: 503 }) } };
  assert.equal(await takeEarlyGraph(EARLY_GRAPH_URL, notOk), null);
});

test("loadGraph nutzt die fruehe Antwort ohne zweiten fetch", async () => {
  const realFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches += 1; return okResponse({ from: "page" }); };
  globalThis[EARLY_GRAPH_KEY] = { url: EARLY_GRAPH_URL, promise: Promise.resolve(okResponse({ from: "early" })) };
  try {
    assert.deepEqual(await loadGraph("kompetenz"), { from: "early" });
    assert.equal(fetches, 0);
    // Die fruehe Antwort ist verbraucht: der naechste Aufruf holt selbst.
    assert.deepEqual(await loadGraph("kompetenz"), { from: "page" });
    assert.equal(fetches, 1);
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis[EARLY_GRAPH_KEY];
  }
});

test("loadGraph faellt bei fehlgeschlagenem fruehem Abruf auf einen eigenen fetch zurueck, der Fehlerstatus bleibt sichtbar", async () => {
  const realFetch = globalThis.fetch;
  globalThis[EARLY_GRAPH_KEY] = { url: EARLY_GRAPH_URL, promise: Promise.resolve(null) };
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  try {
    await assert.rejects(() => loadGraph("kompetenz"), /graph\.json: 500/);
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis[EARLY_GRAPH_KEY];
  }
});

test("loadGraph fuer den Astro-Datensatz laesst den fruehen Kompetenz-Abruf unberuehrt", async () => {
  const realFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => { requested.push(url); return okResponse({ from: "astro" }); };
  globalThis[EARLY_GRAPH_KEY] = { url: EARLY_GRAPH_URL, promise: Promise.resolve(okResponse({ from: "early" })) };
  try {
    assert.deepEqual(await loadGraph("astro"), { from: "astro" });
    assert.deepEqual(requested, ["assets/graph.json"]);
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis[EARLY_GRAPH_KEY];
  }
});
