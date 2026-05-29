/**
 * App entry. Imports modules, fetches data, sets up controllers, wires events.
 * Supports two datasets (astro default, kompetenz) selected via ?dataset= and
 * a visible top-bar switcher.
 */
import {
  loadGraph, loadIndex, loadNode,
  DATASETS, DEFAULT_DATASET, datasetConfig,
} from "./graph-loader.js";
import { createStage } from "./three-stage.js";
import { createModal } from "./modal.js";
import { createThemeSwitcher } from "./theme-switcher.js";
import { createGoldPulse } from "./gold-pulse.js";
import { createSparkles } from "./sparkles.js";
import { createAutoTour } from "./auto-tour.js";
import { createSearchControl } from "./search-control.js";
import { readState, writeState } from "./url-state.js";

(async function main() {
  const urlState = readState();
  const dataset = urlState.dataset || DEFAULT_DATASET;

  // Per-dataset stage behaviour.
  const stageOptions = dataset === "kompetenz"
    ? { colorMode: "kompetenz", clustered: false }
    : { colorMode: "astro", clustered: true };

  const themeToggle = document.getElementById("theme-toggle");
  const themeCurrent = document.getElementById("theme-current");
  const themeSwitcher = createThemeSwitcher(themeToggle, themeCurrent);
  const stored = themeSwitcher.loadStored();

  const graphData = await loadGraph(dataset);
  const initialTheme = urlState.theme || stored || graphData.theme_default || "crab";
  themeSwitcher.set(initialTheme);

  // Brand + dataset switcher UI
  const brandName = document.getElementById("brand-name");
  if (brandName && graphData.metadata && graphData.metadata.title) {
    brandName.textContent = graphData.metadata.title;
  }
  wireDatasetSwitch(dataset);

  document.getElementById("meta-readout").textContent =
    `${graphData.nodes.length} Knoten · ${graphData.links.length} Kanten`;

  // Stage
  const container = document.getElementById("graph-container");
  const stage = createStage(container, stageOptions);
  stage.setGraphData(graphData);

  const initialCenter = urlState.node || graphData.default_center;
  stage.setCenter(initialCenter);

  // Gold pulse
  const gold = createGoldPulse(
    stage,
    document.getElementById("cmb-layer"),
    document.getElementById("brand-glyph"),
  );
  gold.notifyGraphData(graphData);

  const sparkles = createSparkles(document.getElementById("sparkles-layer"));

  const statusBar = document.getElementById("status-bar");
  const tour = createAutoTour(stage, statusBar);

  // Slider
  const slider = document.getElementById("gold-slider");
  const goldValue = document.getElementById("gold-value");
  const initialGold = urlState.gold !== null ? urlState.gold : (graphData.default_gold ?? 35);
  slider.value = String(initialGold);
  goldValue.textContent = `${initialGold}%`;
  gold.setGold(initialGold / 100);
  sparkles.setGold(initialGold / 100);

  slider.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    goldValue.textContent = `${v}%`;
    gold.setGold(v / 100);
    sparkles.setGold(v / 100);
    writeState({ gold: v });
  });

  const tourBtn = document.getElementById("tour-btn");
  if (tourBtn) {
    tourBtn.addEventListener("click", () => {
      tour.startTour({
        stationCount: 6,
        onStationChange: (node) => {
          if (node) stage.setCenter(node.id);
        },
      });
    });
  }

  document.addEventListener("themechange", (e) => {
    writeState({ theme: e.detail.theme });
  });

  // Modal
  const modal = createModal(document.getElementById("modal"));
  modal.onNeighbourClick(async (neighbourId) => {
    await openCenter(neighbourId);
  });

  // Search (index.json driven) — loaded lazily, never blocks the graph render.
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  if (searchInput && searchResults) {
    const search = createSearchControl(searchInput, searchResults, {
      onSelect: (nodeId) => openCenter(nodeId),
    });
    loadIndex(dataset)
      .then((idx) => search.setIndex(idx))
      .catch(() => { /* search degrades silently if index missing */ });
  }

  // Click handlers
  const tooltip = document.getElementById("tooltip");

  stage.onNodeClick(async ({ type, node }) => {
    if (type === "click") {
      statusBar.textContent = `KLICK · ${node.id}`;
      const doc = await loadNode(node.id, dataset);
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
    try {
      const doc = await loadNode(nodeId, dataset);
      modal.show(doc);
    } catch (e) {
      // Node detail missing — keep the graph centered, skip the modal.
    }
  }

  // Initial modal for the starting center
  if (initialCenter) {
    try {
      const doc = await loadNode(initialCenter, dataset);
      modal.show(doc);
    } catch (e) {
      // No node detail for that ID — skip silently
    }
  }
})().catch((err) => {
  console.error("Init failed:", err);
  document.body.innerHTML = `<pre style="color:#f88;padding:24px">${String(err.stack || err)}</pre>`;
});

/**
 * Wire the dataset switch buttons. Switching navigates with a fresh
 * ?dataset= param (and the dataset's default node) — a full reload keeps
 * stage/colour/cluster setup simple and avoids stale graph state.
 */
function wireDatasetSwitch(activeDataset) {
  const sw = document.getElementById("dataset-switch");
  if (!sw) return;
  for (const btn of sw.querySelectorAll(".dataset-btn")) {
    const ds = btn.dataset.dataset;
    const isActive = ds === activeDataset;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.addEventListener("click", () => {
      if (ds === activeDataset) return;
      const params = new URLSearchParams(window.location.search);
      if (ds === DEFAULT_DATASET) params.delete("dataset");
      else params.set("dataset", ds);
      // Drop node so the target dataset opens on its own default center.
      params.delete("node");
      const qs = params.toString();
      window.location.search = qs ? `?${qs}` : "";
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
