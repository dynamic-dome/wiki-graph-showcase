/**
 * Fetch graph.json and individual node detail JSONs.
 * graph.json is loaded once on startup; per-node files are lazy-loaded on demand.
 */

const ASSETS = "assets";

export async function loadGraph() {
  const res = await fetch(`${ASSETS}/graph.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch graph.json: ${res.status}`);
  }
  return res.json();
}

const _nodeCache = new Map();

export async function loadNode(nodeId) {
  if (_nodeCache.has(nodeId)) {
    return _nodeCache.get(nodeId);
  }
  const slug = nodeId.replace(/\//g, "__");
  const res = await fetch(`${ASSETS}/nodes/${encodeURIComponent(slug)}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch node ${nodeId}: ${res.status}`);
  }
  const doc = await res.json();
  _nodeCache.set(nodeId, doc);
  return doc;
}

export function slugFromNodeId(nodeId) {
  return nodeId.replace(/\//g, "__");
}

export function nodeIdFromSlug(slug) {
  return slug.replace(/__/g, "/");
}
