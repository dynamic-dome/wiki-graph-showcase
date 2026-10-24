/**
 * Fetch graph.json, the search index, and individual node detail JSONs for a
 * chosen dataset. The astro dataset lives at assets/; other datasets live at
 * assets/<dataset>/. graph.json is loaded once on startup; per-node files are
 * lazy-loaded on demand.
 */

export const DATASETS = {
  astro: {
    label: "Knowledge Nebula",
    base: "assets",
    defaultNode: "wiki/concepts/allgemeine-relativitaetstheorie",
  },
  kompetenz: {
    label: "Kompetenz-Wiki",
    base: "assets/kompetenz",
    defaultNode: "wiki/competences/agentic-workflows-orchestrieren",
  },
};

// SP-35 (2026-07-06): der portfolio-relevante Kompetenz-Graph ist der Default;
// der Astro-Nebel bleibt als Tab und ueber Legacy-Permalinks (url-state.js) erreichbar.
export const DEFAULT_DATASET = "kompetenz";

// Schluessel des von early-graph.js gestarteten Abrufs (#10019). Bewusst als Kopie
// dort, damit early-graph.js ohne Imports startet; tests/unit/early-graph.test.js
// haelt Schluessel und URL synchron.
export const EARLY_GRAPH_KEY = "__earlyGraph";

export function datasetConfig(dataset) {
  return DATASETS[dataset] || DATASETS[DEFAULT_DATASET];
}

/**
 * Uebernimmt den von early-graph.js gestarteten Abruf, genau einmal und nur
 * fuer dieselbe URL (#10019). Liefert null, wenn keiner laeuft, er fehlschlug
 * oder die URL abweicht (z. B. Astro-Datensatz): dann holt loadGraph selbst.
 */
export async function takeEarlyGraph(url, scope = globalThis) {
  const early = scope[EARLY_GRAPH_KEY];
  if (!early || early.url !== url) return null;
  delete scope[EARLY_GRAPH_KEY];
  const res = await early.promise;
  return res && res.ok ? res : null;
}

export async function loadGraph(dataset = DEFAULT_DATASET) {
  const base = datasetConfig(dataset).base;
  const url = `${base}/graph.json`;
  const res = (await takeEarlyGraph(url)) || (await fetch(url));
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.json();
}

export async function loadIndex(dataset = DEFAULT_DATASET) {
  const base = datasetConfig(dataset).base;
  const res = await fetch(`${base}/index.json`);
  if (!res.ok) {
    // Index is optional (astro may not ship one yet) — degrade gracefully.
    return { dataset, nodes: [] };
  }
  return res.json();
}

const _nodeCache = new Map();

export async function loadNode(nodeId, dataset = DEFAULT_DATASET) {
  const cacheKey = `${dataset}::${nodeId}`;
  if (_nodeCache.has(cacheKey)) {
    return _nodeCache.get(cacheKey);
  }
  const base = datasetConfig(dataset).base;
  const slug = nodeId.replace(/\//g, "__");
  const res = await fetch(`${base}/nodes/${encodeURIComponent(slug)}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch node ${nodeId}: ${res.status}`);
  }
  const doc = await res.json();
  _nodeCache.set(cacheKey, doc);
  return doc;
}

export function slugFromNodeId(nodeId) {
  return nodeId.replace(/\//g, "__");
}

export function nodeIdFromSlug(slug) {
  return slug.replace(/__/g, "/");
}
