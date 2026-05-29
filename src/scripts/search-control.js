/**
 * Node search/autocomplete driven by a dataset's index.json.
 * Filters by title and id; selecting a result recenters + opens detail.
 * Escape closes the suggestion list.
 */

const MAX_RESULTS = 12;

export function createSearchControl(inputEl, resultsEl, { onSelect }) {
  let entries = []; // [{id, title, category}]

  function setIndex(indexDoc) {
    entries = (indexDoc && indexDoc.nodes) || [];
    clearResults();
  }

  function clearResults() {
    resultsEl.innerHTML = "";
    resultsEl.hidden = true;
  }

  function match(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = [];
    for (const e of entries) {
      const title = (e.title || "").toLowerCase();
      const id = (e.id || "").toLowerCase();
      const ti = title.indexOf(q);
      const ii = id.indexOf(q);
      if (ti === -1 && ii === -1) continue;
      // Prefer title-prefix > title-substring > id-substring.
      const score = ti === 0 ? 0 : ti > 0 ? 1 : 2;
      scored.push({ e, score, pos: ti >= 0 ? ti : ii });
    }
    scored.sort((a, b) => a.score - b.score || a.pos - b.pos ||
      (a.e.title || "").localeCompare(b.e.title || ""));
    return scored.slice(0, MAX_RESULTS).map((s) => s.e);
  }

  function renderResults(query) {
    const hits = match(query);
    resultsEl.innerHTML = "";
    if (!hits.length) {
      resultsEl.hidden = true;
      return;
    }
    for (const e of hits) {
      const li = document.createElement("li");
      li.className = "search-result";
      li.setAttribute("role", "option");
      li.dataset.nodeId = e.id;
      const cat = document.createElement("span");
      cat.className = `search-cat search-cat-${e.category || "other"}`;
      cat.textContent = e.category || "";
      const title = document.createElement("span");
      title.className = "search-title";
      title.textContent = e.title || e.id;
      li.appendChild(title);
      li.appendChild(cat);
      li.addEventListener("mousedown", (ev) => {
        // mousedown (not click) so it fires before input blur hides the list
        ev.preventDefault();
        select(e.id);
      });
      resultsEl.appendChild(li);
    }
    resultsEl.hidden = false;
  }

  function select(nodeId) {
    clearResults();
    inputEl.value = "";
    inputEl.blur();
    onSelect(nodeId);
  }

  inputEl.addEventListener("input", () => renderResults(inputEl.value));
  inputEl.addEventListener("focus", () => {
    if (inputEl.value) renderResults(inputEl.value);
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearResults();
      inputEl.blur();
    } else if (e.key === "Enter") {
      const first = resultsEl.querySelector(".search-result");
      if (first) select(first.dataset.nodeId);
    }
  });
  inputEl.addEventListener("blur", () => {
    // Delay so a result mousedown can win the race.
    setTimeout(clearResults, 120);
  });

  return { setIndex, clearResults };
}
