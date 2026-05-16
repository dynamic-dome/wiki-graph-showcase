/**
 * App entry. Imports modules, fetches data, sets up controllers, wires events.
 */
import { loadGraph, loadNode, nodeIdFromSlug } from "./graph-loader.js";
import { createStage } from "./three-stage.js";
import { createModal } from "./modal.js";
import { createThemeSwitcher } from "./theme-switcher.js";
import { createGoldPulse } from "./gold-pulse.js";
import { readState, writeState } from "./url-state.js";

(async function main() {
  const urlState = readState();
  const themeToggle = document.getElementById("theme-toggle");
  const themeCurrent = document.getElementById("theme-current");
  const themeSwitcher = createThemeSwitcher(themeToggle, themeCurrent);

  // Apply theme: URL > localStorage > graph default > "crab"
  const stored = themeSwitcher.loadStored();
  // We need graph.json to know graph default; load it first, then theme
  const graphData = await loadGraph();
  const initialTheme = urlState.theme || stored || graphData.theme_default || "crab";
  themeSwitcher.set(initialTheme);

  document.getElementById("meta-readout").textContent =
    `${graphData.nodes.length} Knoten · ${graphData.links.length} Kanten`;

  // Stage
  const container = document.getElementById("graph-container");
  const stage = createStage(container);
  stage.setGraphData(graphData);

  // Initial center from URL or default
  const initialCenter = urlState.node || graphData.default_center;
  stage.setCenter(initialCenter);

  // Gold pulse
  const gold = createGoldPulse(
    stage,
    document.getElementById("cmb-layer"),
    document.getElementById("brand-glyph"),
  );
  gold.notifyGraphData(graphData);

  // Slider
  const slider = document.getElementById("gold-slider");
  const goldValue = document.getElementById("gold-value");
  const initialGold = urlState.gold !== null ? urlState.gold : (graphData.default_gold ?? 35);
  slider.value = String(initialGold);
  goldValue.textContent = `${initialGold}%`;
  gold.setGold(initialGold / 100);

  slider.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    goldValue.textContent = `${v}%`;
    gold.setGold(v / 100);
    writeState({ gold: v });
  });

  // Theme change writes URL
  document.addEventListener("themechange", (e) => {
    writeState({ theme: e.detail.theme });
  });

  // Modal
  const modal = createModal(document.getElementById("modal"));
  modal.onNeighbourClick(async (neighbourId) => {
    await openCenter(neighbourId);
  });

  // Click handlers
  const tooltip = document.getElementById("tooltip");
  const statusBar = document.getElementById("status-bar");

  stage.onNodeClick(async ({ type, node }) => {
    if (type === "click") {
      statusBar.textContent = `KLICK · ${node.id}`;
      const doc = await loadNode(node.id);
      modal.show(doc);
    } else if (type === "doubleclick") {
      statusBar.textContent = `NEUES ZENTRUM · ${node.id}`;
      await openCenter(node.id);
    }
  });

  stage.onNodeHover((node) => {
    if (!node) {
      tooltip.classList.remove("visible");
      return;
    }
    tooltip.innerHTML = `<div class="ttitle">${escapeHtml(node.title || node.id)}</div><div class="tmeta">${escapeHtml(node.category || "")}</div>`;
    tooltip.classList.add("visible");
  });

  document.addEventListener("mousemove", (e) => {
    tooltip.style.left = (e.clientX + 14) + "px";
    tooltip.style.top = (e.clientY + 14) + "px";
  });

  async function openCenter(nodeId) {
    stage.setCenter(nodeId);
    writeState({ node: nodeId });
    const doc = await loadNode(nodeId);
    modal.show(doc);
  }

  // Initial modal for the starting center
  if (initialCenter) {
    try {
      const doc = await loadNode(initialCenter);
      modal.show(doc);
    } catch (e) {
      // No node detail for that ID — skip silently
    }
  }
})().catch((err) => {
  console.error("Init failed:", err);
  document.body.innerHTML = `<pre style="color:#f88;padding:24px">${String(err.stack || err)}</pre>`;
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
