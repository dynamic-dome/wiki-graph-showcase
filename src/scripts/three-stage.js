/**
 * Set up the 3d-force-graph stage. Returns a controller object with:
 *   - setGraphData(data): replace nodes+links
 *   - setCenter(nodeId): mark a node as center, recolor others by BFS distance
 *   - onNodeClick(handler), onNodeHover(handler), onNodeDoubleClick(handler)
 *   - cameraPosition(...): proxy to the force-graph instance for auto-tour
 *
 * Reads CSS variables from the current --theme via getComputedStyle.
 */

const DOUBLE_CLICK_MS = 350;

// Cluster anchor positions in 3D space — gantefoer cluster sits offset from
// astrophysik so they form two distinct "galaxies" with bridges between them.
const CLUSTER_ANCHORS = {
  astrophysik: { x: -120, y: 0, z: 0 },
  gantefoer: { x: 160, y: 40, z: 0 },
};

// Kompetenz dataset: colour by node.category instead of astro kind.
// One single cluster, forces-only layout (no anchor) per design decision.
export const KOMPETENZ_CATEGORY_COLORS = {
  competence: "#d9b65f",
  synthesis: "#22c7e8",
  topic: "#8fb7ff",
  concept: "#c7d7e6",
  entity: "#d46ff0",
};

// Weight -> sphere radius. Hubs (weight=1.0) ~3x bigger than leaves (weight=0).
function sizeFromWeight(weight) {
  return 3 + (weight || 0) * 16;
}

export function createStage(container, options = {}) {
  // colorMode: "astro" (kind-based, default) or "kompetenz" (category-based).
  // clustered: whether the cluster-anchor force is active (astro=true).
  const colorMode = options.colorMode || "astro";
  const clustered = options.clustered !== undefined ? options.clustered : true;

  const ForceGraph3D = window.ForceGraph3D;
  if (typeof ForceGraph3D !== "function") {
    throw new Error("ForceGraph3D global not found — is 3d-force-graph.min.js loaded?");
  }

  const graph = ForceGraph3D()(container)
    .backgroundColor("rgba(0,0,0,0)")
    .nodeRelSize(4)
    .nodeOpacity(0.95)
    .linkWidth(1)
    .linkOpacity(0.5)
    .cooldownTicks(500)
    .enableNodeDrag(false);

  // Hide the library's built-in "left-click: rotate…" nav hint — it reads as
  // dev chrome and overlaps the control panel. (Guarded: older bundles may
  // not expose it.)
  if (typeof graph.showNavInfo === "function") graph.showNavInfo(false);

  let centerId = null;
  let centerDist = new Map();   // BFS-Distanzen vom Zentrum, gecacht (vorher O(n²): bfsDistance lief pro Knoten im Color-Callback)
  let spotlightId = null;       // Hover-Spotlight
  let adjacency = new Map();
  let nodesById = new Map();
  let lastClickMs = 0;
  let lastClickedId = null;

  function rebuildAdjacency(nodes, links) {
    adjacency = new Map();
    nodesById = new Map();
    for (const node of nodes) nodesById.set(node.id, node);
    for (const link of links) {
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      if (!adjacency.has(s)) adjacency.set(s, new Set());
      if (!adjacency.has(t)) adjacency.set(t, new Set());
      adjacency.get(s).add(t);
      adjacency.get(t).add(s);
    }
  }

  function bfsDistance(rootId) {
    const dist = new Map([[rootId, 0]]);
    const queue = [rootId];
    while (queue.length) {
      const node = queue.shift();
      const d = dist.get(node);
      const neighbours = adjacency.get(node) || new Set();
      for (const n of neighbours) {
        if (!dist.has(n)) {
          dist.set(n, d + 1);
          queue.push(n);
        }
      }
    }
    return dist;
  }

  function endpointIds(link) {
    const s = typeof link.source === "object" ? link.source.id : link.source;
    const t = typeof link.target === "object" ? link.target.id : link.target;
    return [s, t];
  }

  const SPOT_HAZE = "rgba(150, 180, 205, 0.10)";

  function nodeColor(node) {
    const styles = getComputedStyle(document.documentElement);
    const c0 = (styles.getPropertyValue("--node-center") || "#FFFFFF").trim();
    const cAstro = (styles.getPropertyValue("--node-astro") || "#8CF0FF").trim();
    const cGold = (styles.getPropertyValue("--node-gante") || "#F5C24A").trim();
    const cEntity = (styles.getPropertyValue("--node-entity") || "#FFE0B2").trim();
    const hazeColor = "rgba(160, 200, 220, 0.32)";

    // Hover-Spotlight: alles außer Knoten + 1-Hop-Nachbarn wird stark gedimmt.
    if (spotlightId && node.id !== spotlightId) {
      const neigh = adjacency.get(spotlightId);
      if (!neigh || !neigh.has(node.id)) return SPOT_HAZE;
    }

    if (centerId === node.id) return c0;

    if (centerId && centerDist.size) {
      const d = centerDist.get(node.id);
      if (d === undefined || d >= 3) return hazeColor;
    }

    if (colorMode === "kompetenz") {
      return KOMPETENZ_CATEGORY_COLORS[node.category] || cAstro;
    }
    if (node.kind === "entity") return cEntity;
    if (node.kind === "concept-gantefoer") return cGold;
    return cAstro;
  }

  function nodeVal(node) {
    return sizeFromWeight(node.weight);
  }

  graph
    .nodeColor(nodeColor)
    .nodeVal(nodeVal);

  // Cluster-anchor force: pulls every node gently toward its cluster center.
  // Strength is small so the force-graph layout still resolves edges nicely,
  // but enough that the two clusters separate visibly in 3D.
  // Only active for clustered datasets (astro). The kompetenz dataset is a
  // single forces-only cloud, so the anchor force is omitted entirely there.
  if (clustered) {
    graph.d3Force("clusterAnchor", (alpha) => {
      const STRENGTH = 0.06;
      const data = graph.graphData();
      for (const node of data.nodes) {
        const anchor = CLUSTER_ANCHORS[node.cluster] || CLUSTER_ANCHORS.astrophysik;
        if (node.x === undefined) continue;
        node.vx = (node.vx || 0) + (anchor.x - node.x) * STRENGTH * alpha;
        node.vy = (node.vy || 0) + (anchor.y - node.y) * STRENGTH * alpha;
        node.vz = (node.vz || 0) + (anchor.z - node.z) * STRENGTH * alpha;
      }
    });
  }

  // Reduce the default many-body repulsion a touch so clusters can cohere
  if (graph.d3Force("charge")) {
    graph.d3Force("charge").strength(-90);
  }

  const api = {
    setGraphData(data) {
      rebuildAdjacency(data.nodes || [], data.links || []);
      if (centerId) centerDist = bfsDistance(centerId);
      graph.graphData(data);
    },
    setCenter(nodeId) {
      centerId = nodeId;
      centerDist = nodeId ? bfsDistance(nodeId) : new Map();
      graph.nodeColor(nodeColor);  // force recompute
    },
    getCenterId() {
      return centerId;
    },
    setSpotlight(nodeId) {
      if (spotlightId === nodeId) return;
      spotlightId = nodeId;
      graph.nodeColor(nodeColor);
    },
    getLinkDim(link) {
      const [s, t] = endpointIds(link);
      if (spotlightId) {
        return (s === spotlightId || t === spotlightId) ? 1 : 0.15;
      }
      if (centerId && centerDist.size) {
        const far = (d) => d === undefined || d >= 3;
        if (far(centerDist.get(s)) && far(centerDist.get(t))) return 0.35;
      }
      return 1;
    },
    centerCamera() {
      const node = graph.graphData().nodes.find(n => n.id === centerId);
      if (node) {
        graph.cameraPosition(
          { x: node.x, y: node.y, z: node.z + 260 },
          node,
          1200
        );
      }
    },
    cameraPosition(pos, lookAt, ms) {
      return graph.cameraPosition(pos, lookAt, ms);
    },
    getNodeById(id) {
      return nodesById.get(id);
    },
    getAdjacency() {
      return adjacency;
    },
    onNodeClick(handler) {
      graph.onNodeClick((node, _event) => {
        const now = Date.now();
        if (lastClickedId === node.id && now - lastClickMs < DOUBLE_CLICK_MS) {
          handler({ type: "doubleclick", node });
          lastClickMs = 0;
          lastClickedId = null;
        } else {
          handler({ type: "click", node });
          lastClickMs = now;
          lastClickedId = node.id;
        }
      });
    },
    onNodeHover(handler) {
      graph.onNodeHover((node, _prev) => handler(node));
    },
    onBackgroundClick(handler) {
      if (typeof graph.onBackgroundClick === "function") {
        graph.onBackgroundClick(handler);
      }
    },
    getThreeRenderer() {
      return graph.renderer ? graph.renderer() : null;
    },
    getCamera() {
      return typeof graph.camera === "function" ? graph.camera() : null;
    },
    getGraphForceInstance() {
      return graph;
    },
    isCrossClusterLink(link) {
      const s = typeof link.source === "object" ? link.source : nodesById.get(link.source);
      const t = typeof link.target === "object" ? link.target : nodesById.get(link.target);
      return s && t && s.cluster !== t.cluster;
    },
  };

  return api;
}
