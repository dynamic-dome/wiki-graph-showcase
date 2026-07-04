/**
 * Node search/autocomplete driven by a dataset's index.json.
 * Filters by title and id; selecting a result recenters + opens detail.
 *
 * Combobox semantics: the input owns the results listbox and is navigable by
 * ArrowDown/ArrowUp + Enter, with aria-activedescendant tracking the highlight.
 * Escape closes the suggestion list. Pointer selection still works via mousedown.
 */

const MAX_RESULTS = 12;

export function createSearchControl(inputEl, resultsEl, { onSelect }) {
  let entries = []; // [{id, title, category}]
  let activeIdx = -1;

  // Combobox wiring: the input controls the results listbox.
  inputEl.setAttribute("role", "combobox");
  inputEl.setAttribute("aria-autocomplete", "list");
  inputEl.setAttribute("aria-expanded", "false");
  if (resultsEl.id) inputEl.setAttribute("aria-controls", resultsEl.id);

  function setIndex(indexDoc) {
    entries = (indexDoc && indexDoc.nodes) || [];
    clearResults();
  }

  function clearResults() {
    resultsEl.innerHTML = "";
    resultsEl.hidden = true;
    activeIdx = -1;
    inputEl.setAttribute("aria-expanded", "false");
    inputEl.removeAttribute("aria-activedescendant");
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

  function setActive(idx) {
    const items = resultsEl.querySelectorAll(".search-result");
    if (items.length === 0) return;
    activeIdx = (idx + items.length) % items.length;
    items.forEach((li, i) => {
      const on = i === activeIdx;
      li.classList.toggle("active", on);
      li.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        inputEl.setAttribute("aria-activedescendant", li.id);
        li.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function renderResults(query) {
    const hits = match(query);
    resultsEl.innerHTML = "";
    activeIdx = -1;
    inputEl.removeAttribute("aria-activedescendant");
    if (!hits.length) {
      resultsEl.hidden = true;
      inputEl.setAttribute("aria-expanded", "false");
      return;
    }
    hits.forEach((e, i) => {
      const li = document.createElement("li");
      li.className = "search-result";
      li.id = `search-opt-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.dataset.nodeId = e.id;
      const title = document.createElement("span");
      title.className = "search-title";
      title.textContent = e.title || e.id;
      const cat = document.createElement("span");
      cat.className = `search-cat search-cat-${e.category || "other"}`;
      cat.textContent = e.category || "";
      li.appendChild(title);
      li.appendChild(cat);
      li.addEventListener("mousedown", (ev) => {
        // mousedown (not click) so it fires before input blur hides the list
        ev.preventDefault();
        select(e.id);
      });
      resultsEl.appendChild(li);
    });
    resultsEl.hidden = false;
    inputEl.setAttribute("aria-expanded", "true");
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
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (resultsEl.hidden) renderResults(inputEl.value);
      setActive(activeIdx + 1);
    } else if (e.key === "ArrowUp") {
      if (resultsEl.hidden) return;
      e.preventDefault();
      setActive(activeIdx - 1);
    } else if (e.key === "Enter") {
      const items = resultsEl.querySelectorAll(".search-result");
      if (activeIdx >= 0 && items[activeIdx]) {
        select(items[activeIdx].dataset.nodeId);
      } else if (items[0]) {
        select(items[0].dataset.nodeId);
      }
    }
  });
  inputEl.addEventListener("blur", () => {
    // Delay so a result mousedown can win the race.
    setTimeout(clearResults, 120);
  });

  return { setIndex, clearResults };
}
