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

// The curated node text carries **bold** markdown. It used to be written via
// textContent, so visitors saw literal asterisks. Escape FIRST (order is
// load-bearing for XSS safety on build-time data), THEN convert **..** only.
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function renderInline(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function createModal(rootEl) {
  const badgesEl = rootEl.querySelector("#modal-badges");
  const titleEl = rootEl.querySelector("#modal-title");
  const subtitleEl = rootEl.querySelector("#modal-subtitle");
  const essenceEl = rootEl.querySelector("#modal-essence");
  const pillsEl = rootEl.querySelector("#neighbour-pills");
  const closeBtn = rootEl.querySelector("#modal-close");

  let onNeighbourClickHandler = () => {};
  let lastTrigger = null;
  let isOpen = false;

  // Make the title a programmatic focus target (not a tab stop) so opening the
  // dialog lands the reader on its heading.
  titleEl.setAttribute("tabindex", "-1");

  // Start closed + inert: the off-screen panel's controls stay out of the tab
  // order and hidden from assistive tech (fixes the old aria-hidden-with-
  // focusable-content violation).
  rootEl.inert = true;
  rootEl.removeAttribute("aria-hidden");

  closeBtn.addEventListener("click", () => hide());

  // Escape closes; Tab is trapped inside the dialog while open.
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") { hide(); return; }
    if (e.key === "Tab") trapFocus(e);
  });

  // Pointer outside the panel closes it. The graph canvas is excluded so the
  // node-click that opens the panel (same gesture) can't instantly re-close it,
  // and orbit-dragging the scene never dismisses the panel.
  document.addEventListener("pointerdown", (e) => {
    if (!isOpen) return;
    if (rootEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest("#graph-container")) return;
    hide();
  });

  function focusables() {
    return Array.from(
      rootEl.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.disabled && el.offsetParent !== null);
  }
  function trapFocus(e) {
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // Focus may sit on the heading (tabindex="-1", not in the list) right after
    // open — pull it into the dialog instead of letting Shift+Tab escape.
    if (!items.includes(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault(); first.focus();
    }
  }

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
    // Capture the trigger before the re-render nukes the focused pill; keep the
    // original on neighbour-hopping so focus returns to where the trip started.
    if (!isOpen) lastTrigger = document.activeElement;
    renderBadges(nodeDoc);
    titleEl.textContent = nodeDoc.title || nodeDoc.id;
    subtitleEl.innerHTML = renderInline(nodeDoc.subtitle);
    essenceEl.innerHTML = renderInline(nodeDoc.essence);
    pillsEl.innerHTML = "";
    for (const neighbour of nodeDoc.neighbours || []) {
      const btn = document.createElement("button");
      btn.textContent = neighbour.split("/").pop().replace(/-/g, " ");
      btn.dataset.nodeId = neighbour;
      btn.addEventListener("click", () => onNeighbourClickHandler(neighbour));
      pillsEl.appendChild(btn);
    }
    rootEl.inert = false;
    rootEl.classList.add("open");
    isOpen = true;
    // The re-render destroyed whatever had focus — land on the heading so the
    // dialog name is announced and the reader starts at the top.
    titleEl.focus();
  }

  function hide() {
    if (!isOpen) return;
    rootEl.classList.remove("open");
    rootEl.inert = true;
    isOpen = false;
    // Return focus to whatever opened the panel, when it still exists.
    if (lastTrigger && document.contains(lastTrigger) && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function onNeighbourClick(handler) {
    onNeighbourClickHandler = handler;
  }

  return { show, hide, onNeighbourClick };
}
