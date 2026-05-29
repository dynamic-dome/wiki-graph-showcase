/**
 * Read + write URL query params for shareable state.
 * Supported: ?dataset=<astro|kompetenz>&node=<id>&theme=<crab|dome>&gold=<0-100>
 *
 * Backward compatible: a URL without ?dataset keeps using the astro dataset,
 * so existing ?node=...&theme=...&gold=... permalinks are unaffected.
 */

const VALID_THEMES = new Set(["crab", "dome"]);
const VALID_DATASETS = new Set(["astro", "kompetenz"]);

export function readState() {
  const params = new URLSearchParams(window.location.search);
  return {
    dataset: VALID_DATASETS.has(params.get("dataset")) ? params.get("dataset") : null,
    node: params.get("node") || null,
    theme: VALID_THEMES.has(params.get("theme")) ? params.get("theme") : null,
    gold: parseGold(params.get("gold")),
  };
}

function parseGold(raw) {
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export function writeState({ dataset, node, theme, gold }) {
  const params = new URLSearchParams(window.location.search);
  if (dataset !== undefined) {
    // Keep astro implicit so legacy permalinks stay clean.
    if (dataset === null || dataset === "astro") params.delete("dataset");
    else params.set("dataset", dataset);
  }
  if (node !== undefined) {
    if (node === null) params.delete("node");
    else params.set("node", node);
  }
  if (theme !== undefined) {
    if (theme === null) params.delete("theme");
    else params.set("theme", theme);
  }
  if (gold !== undefined) {
    if (gold === null) params.delete("gold");
    else params.set("gold", String(gold));
  }
  const newUrl =
    window.location.pathname +
    (params.toString() ? "?" + params.toString() : "") +
    window.location.hash;
  window.history.replaceState(null, "", newUrl);
}
