/**
 * C2: Durchsuchbare Liste der Seiten (aus assets/<dataset>/index.json), wenn
 * die 3D-Ansicht nicht startet. Ein Klick auf einen Eintrag oeffnet das
 * vorhandene Modal (siehe main.js).
 */
import { CATEGORY_LABELS } from "./modal.js";

// ROHFASSUNG: Texte der Liste, Redaktion durch Dominic vor dem Merge.
export const FALLBACK_TEXTS = {
  count: (n) => `${n} Seiten`,
  none: "Keine Treffer.",
  unavailable: "Die Liste ist gerade nicht verfügbar.",
};

export function filterEntries(entries, query) {
  const q = String(query || "").trim().toLowerCase();
  const sorted = [...(entries || [])].sort((a, b) =>
    (a.title || a.id || "").localeCompare(b.title || b.id || "", "de"));
  if (!q) return sorted;
  return sorted.filter((e) =>
    (e.title || "").toLowerCase().includes(q) || (e.id || "").toLowerCase().includes(q));
}

export function createFallbackList(rootEl, { onSelect }) {
  const filterEl = rootEl.querySelector("#fallback-filter");
  const listEl = rootEl.querySelector("#fallback-list");
  const statusEl = rootEl.querySelector("#fallback-status");
  let entries = [];

  function render() {
    const hits = filterEntries(entries, filterEl.value);
    listEl.innerHTML = "";
    for (const entry of hits) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.nodeId = entry.id;
      const title = document.createElement("span");
      title.className = "fallback-title";
      title.textContent = entry.title || entry.id;
      const cat = document.createElement("span");
      cat.className = "fallback-cat";
      cat.textContent = CATEGORY_LABELS[entry.category] || "";
      btn.append(title, cat);
      btn.addEventListener("click", () => onSelect(entry.id));
      li.appendChild(btn);
      listEl.appendChild(li);
    }
    statusEl.textContent = hits.length ? FALLBACK_TEXTS.count(hits.length) : FALLBACK_TEXTS.none;
  }

  filterEl.addEventListener("input", render);

  return {
    setEntries(list) {
      entries = list || [];
      render();
    },
    showError(message) {
      listEl.innerHTML = "";
      statusEl.textContent = message;
    },
  };
}
