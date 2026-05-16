/**
 * Render and animate the detail modal on the right side.
 */

export function createModal(rootEl) {
  const titleEl = rootEl.querySelector("#modal-title");
  const subtitleEl = rootEl.querySelector("#modal-subtitle");
  const essenceEl = rootEl.querySelector("#modal-essence");
  const pillsEl = rootEl.querySelector("#neighbour-pills");
  const closeBtn = rootEl.querySelector("#modal-close");

  let onNeighbourClickHandler = () => {};

  closeBtn.addEventListener("click", () => hide());

  function show(nodeDoc) {
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
