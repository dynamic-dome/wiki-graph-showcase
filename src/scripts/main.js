/**
 * App entry. Imports modules, fetches data, sets up controllers, wires events.
 * Supports two datasets (kompetenz default since SP-35, astro) selected via
 * ?dataset= and a visible top-bar switcher.
 */
import {
  loadGraph, loadIndex, loadNode,
  DATASETS, DEFAULT_DATASET, datasetConfig,
} from "./graph-loader.js";
import { createStage, KOMPETENZ_CATEGORY_COLORS } from "./three-stage.js";
import { createModal } from "./modal.js";
import { createLegend } from "./legend.js";
import { createCameraRig } from "./camera-rig.js";
import { createLabels } from "./labels.js";
import { createFocusLock } from "./focus-lock.js";
import { createThemeSwitcher } from "./theme-switcher.js";
import { createGoldPulse } from "./gold-pulse.js";
import { createEdgeFlow } from "./edge-flow.js";
import { createSceneDressing } from "./scene-dressing.js";
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

  createLegend(document.getElementById("legend"), {
    dataset,
    kompetenzColors: KOMPETENZ_CATEGORY_COLORS,
  });

  document.getElementById("meta-readout").textContent =
    `${graphData.nodes.length} Knoten · ${graphData.links.length} Kanten`;

  // Stage
  const container = document.getElementById("graph-container");
  const stage = createStage(container, stageOptions);
  // Testhook für Playwright (aurum.spec.ts) — bewusst öffentlich, read-only genutzt.
  window.__nebula = { stage };
  stage.setGraphData(graphData);

  const initialCenter = urlState.node || graphData.default_center;
  stage.setCenter(initialCenter);

  const rig = createCameraRig(stage);

  // In-space labels for hubs + the current focus neighbourhood.
  const labels = createLabels(document.getElementById("label-layer"), stage);
  labels.refresh();
  labels.start();

  const focusLock = createFocusLock(document.getElementById("reticle"), stage);

  // Gold pulse
  const gold = createGoldPulse(
    stage,
    document.getElementById("cmb-layer"),
    document.getElementById("brand-glyph"),
  );
  gold.notifyGraphData(graphData);

  const dressing = createSceneDressing(stage);
  window.__nebula.dressing = dressing;

  const statusBar = document.getElementById("status-bar");
  const tour = createAutoTour(stage, statusBar);

  // Slider
  const slider = document.getElementById("gold-slider");
  const goldValue = document.getElementById("gold-value");
  const initialGold = urlState.gold !== null ? urlState.gold : (graphData.default_gold ?? 35);
  slider.value = String(initialGold);
  goldValue.textContent = `${initialGold}%`;
  gold.setGold(initialGold / 100);
  dressing.setGold(initialGold / 100);

  // Edge-Flow nur für Kompetenz: überschreibt die Bridge-Partikel von
  // gold-pulse (Kompetenz hat keine Bridges).
  let edgeFlow = null;
  if (dataset === "kompetenz") {
    edgeFlow = createEdgeFlow(stage);
    edgeFlow.setGold(initialGold / 100);
    window.__nebula.edgeFlow = edgeFlow;
  }

  slider.addEventListener("input", (e) => {
    const v = parseInt(e.target.value, 10);
    goldValue.textContent = `${v}%`;
    gold.setGold(v / 100);
    dressing.setGold(v / 100);
    if (edgeFlow) edgeFlow.setGold(v / 100);
    writeState({ gold: v });
  });

  const tourBtn = document.getElementById("tour-btn");
  if (tourBtn) {
    tourBtn.addEventListener("click", () => {
      tour.startTour({
        stationCount: 6,
        onStationChange: (node) => {
          if (node) {
            stage.setCenter(node.id);
            if (edgeFlow) edgeFlow.refresh();
            labels.refresh();
            focusLock.lockOn(node);
          }
        },
      });
    });
  }

  document.addEventListener("themechange", (e) => {
    writeState({ theme: e.detail.theme });
  });

  // Plate mode: hide all chrome for a clean, shareable capture. Toggle with "P".
  const plateHint = document.getElementById("plate-hint");
  let plateHintTimer = null;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "p" && e.key !== "P") return;
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea")) return; // don't hijack typing
    const on = document.body.classList.toggle("plate-mode");
    if (plateHint) {
      if (plateHintTimer) clearTimeout(plateHintTimer);
      if (on) {
        plateHint.textContent = "Plate-Modus · P beendet";
        plateHint.classList.add("show");
        plateHintTimer = setTimeout(() => plateHint.classList.remove("show"), 2200);
      } else {
        plateHint.classList.remove("show");
      }
    }
  });

  // Modal
  const modal = createModal(document.getElementById("modal"));
  modal.onNeighbourClick(async (neighbourId) => {
    await openCenter(neighbourId);
  });
  // Clicking empty 3D space dismisses the detail panel.
  stage.onBackgroundClick(() => modal.hide());

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

  // Human telemetry instead of raw slugs: "Fokus · Schwarzes Loch · 15 Verbindungen".
  function statusFor(verb, node) {
    const adj = stage.getAdjacency().get(node.id);
    const n = adj ? adj.size : 0;
    const title = node.title || node.id;
    return `${verb} · ${title} · ${n} ${n === 1 ? "Verbindung" : "Verbindungen"}`;
  }

  stage.onNodeClick(async ({ type, node }) => {
    if (type === "click") {
      statusBar.textContent = statusFor("Fokus", node);
      focusLock.lockOn(node);
      const doc = await loadNode(node.id, dataset);
      modal.show(doc);
    } else if (type === "doubleclick") {
      statusBar.textContent = statusFor("Neues Zentrum", node);
      await openCenter(node.id);
    }
  });

  stage.onNodeHover((node) => {
    stage.setSpotlight(node ? node.id : null);
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
    if (edgeFlow) edgeFlow.refresh();
    labels.refresh();
    // Acquisition: lock the reticle and gently dolly the camera onto the new
    // centre (the rig cancels any in-flight move, so this never fights).
    const node = stage.getNodeById(nodeId);
    if (node && node.x !== undefined && node.x !== null) {
      focusLock.lockOn(node);
      rig.flyTo(
        { x: node.x, y: node.y + 24, z: node.z + 300 },
        { x: node.x, y: node.y, z: node.z },
        { ms: 1100 },
      );
    }
    // dataset explizit mitschreiben: ?node ohne ?dataset liest der
    // Legacy-Guard in url-state.js als astro (SP-35).
    writeState({ dataset, node: nodeId });
    try {
      const doc = await loadNode(nodeId, dataset);
      modal.show(doc);
    } catch (e) {
      // Node detail missing — keep the graph centered, skip the modal.
    }
  }

  // Cold-open "First Light": the graph is centered + coloured on the default
  // node (setCenter above); the camera flies in from deep space while the title
  // lockup fades. Only a deep-linked node (?node=...) opens its detail panel,
  // and only once the intro finishes — a bare visit stays on the nebula.
  runIntro(rig, graphData, urlState.node ? initialCenter : null, async (id) => {
    try {
      const doc = await loadNode(id, dataset);
      modal.show(doc);
    } catch (e) {
      // No node detail for that ID — skip silently
    }
  });
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
      // Immer explizit (SP-35): implizite Defaults kollidieren mit dem
      // Legacy-Guard, sobald spaeter ein node-Param dazukommt.
      params.set("dataset", ds);
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

/**
 * Cold-open sequence: deep-space fly-in + title-lockup fade. Opens the deep-
 * linked node's panel (if any) once the intro finishes. Reduced-motion snaps
 * straight to the resolved state with no overlay.
 */
function runIntro(rig, graphData, deepLinkNode, openNode) {
  const overlay = document.getElementById("intro-overlay");
  const tel = document.getElementById("intro-telemetry");
  if (tel) {
    tel.textContent = `${graphData.nodes.length} Objekte · ${graphData.links.length} Verbindungen`;
  }
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Play the ignition once per browser session — a reload or dataset switch
  // shouldn't replay the full sequence for a returning visitor.
  let seen = null;
  try { seen = sessionStorage.getItem("nebula_intro_seen"); } catch (_e) { /* private mode */ }
  const finish = () => { if (deepLinkNode) openNode(deepLinkNode); };

  if (!overlay || reduce || seen) {
    if (overlay) { overlay.classList.add("done"); overlay.style.display = "none"; }
    rig.settle();  // same resting frame as a played intro → consistent, legible framing
    finish();
    return;
  }
  try { sessionStorage.setItem("nebula_intro_seen", "1"); } catch (_e) { /* ignore */ }
  rig.intro({});
  // Abortable + idempotent: an impatient click/keypress (which also supersedes
  // the intro camera via the rig token) skips the rest instead of leaving stale
  // timers to hide the overlay / open the modal later.
  let ended = false;
  const skipEvents = ["pointerdown", "keydown", "wheel", "touchstart"];
  const t1 = setTimeout(() => overlay.classList.add("done"), 2600);
  const t2 = setTimeout(endIntro, 3800);
  function endIntro() {
    if (ended) return;
    ended = true;
    clearTimeout(t1);
    clearTimeout(t2);
    skipEvents.forEach((ev) => window.removeEventListener(ev, endIntro));
    overlay.classList.add("done");
    setTimeout(() => { overlay.style.display = "none"; }, 400);
    finish();
  }
  skipEvents.forEach((ev) => window.addEventListener(ev, endIntro, { passive: true }));
}
