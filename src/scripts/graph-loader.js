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

export const DEFAULT_DATASET = "astro";

export function datasetConfig(dataset) {
  return DATASETS[dataset] || DATASETS[DEFAULT_DATASET];
}

export async function loadGraph(dataset = DEFAULT_DATASET) {
  const base = datasetConfig(dataset).base;
  const res = await fetch(`${base}/graph.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${base}/graph.json: ${res.status}`);
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
