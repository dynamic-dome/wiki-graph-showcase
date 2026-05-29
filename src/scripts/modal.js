/**
 * Render and animate the detail modal on the right side.
 */

// German display labels for kompetenz node categories.
const CATEGORY_LABELS = {
  competence: "Kompetenz",
  synthesis: "Synthese",
  topic: "Thema",
  concept: "Konzept",
  entity: "Akteur / Entitaet",
};

// German labels for verification_status badge.
const VSTATUS_LABELS = {
  verified: "verifiziert",
  partially_verified: "teilweise verifiziert",
  unverified: "unverifiziert",
  superseded: "ueberholt",
};

export function createModal(rootEl) {
  const badgesEl = rootEl.querySelector("#modal-badges");
  const titleEl = rootEl.querySelector("#modal-title");
  const subtitleEl = rootEl.querySelector("#modal-subtitle");
  const essenceEl = rootEl.querySelector("#modal-essence");
  const pillsEl = rootEl.querySelector("#neighbour-pills");
  const closeBtn = rootEl.querySelector("#modal-close");

  let onNeighbourClickHandler = () => {};

  closeBtn.addEventListener("click", () => hide());

  function renderBadges(nodeDoc) {
    if (!badgesEl) return;
    badgesEl.innerHTML = "";
    const catLabel = CATEGORY_LABELS[nodeDoc.category];
    if (catLabel) {
      const b = document.createElement("span");
      b.className = `badge badge-cat badge-${nodeDoc.category}`;
      b.textContent = catLabel;
      badgesEl.appendChild(b);
    }
    const vs = nodeDoc.verification_status;
    if (vs && VSTATUS_LABELS[vs]) {
      const b = document.createElement("span");
      b.className = `badge badge-vstatus badge-vstatus-${vs}`;
      b.textContent = VSTATUS_LABELS[vs];
      badgesEl.appendChild(b);
    }
  }

  function show(nodeDoc) {
    renderBadges(nodeDoc);
    titleEl.textContent = nodeDoc.title || nodeDoc.id;
    subtitleEl.textContent = nodeDoc.subtitle || "";
    essenceEl.textContent = nodeDoc.essence || "";
    pillsEl.innerHTML = "";
    for (const neighbour of nodeDoc.neighbours || []) {
      const btn = document.createElement("button");
      btn.textContent = neighbour.split("/").pop().replace(/-/g, " ");
      btn.dataset.nodeId = neighbour;
      btn.addEventListener("click", () => onNeighbourClickHandler(neighbour));
      pillsEl.appendChild(btn);
    }
    rootEl.classList.add("open");
    rootEl.setAttribute("aria-hidden", "false");
  }

  function hide() {
    rootEl.classList.remove("open");
    rootEl.setAttribute("aria-hidden", "true");
  }

  function onNeighbourClick(handler) {
    onNeighbourClickHandler = handler;
  }

  return { show, hide, onNeighbourClick };
}
