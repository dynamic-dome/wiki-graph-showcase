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

// Weight -> sphere radius. Hubs (weight=1.0) ~3x bigger than leaves (weight=0).
function sizeFromWeight(weight) {
  return 3 + (weight || 0) * 16;
}

export function createStage(container) {
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

  let centerId = null;
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

  function nodeColor(node) {
    const styles = getComputedStyle(document.documentElement);
    const c0 = (styles.getPropertyValue("--node-center") || "#FFFFFF").trim();
    const cAstro = (styles.getPropertyValue("--node-astro") || "#8CF0FF").trim();
    const cGold = (styles.getPropertyValue("--node-gante") || "#F5C24A").trim();
    const cEntity = (styles.getPropertyValue("--node-entity") || "#FFE0B2").trim();
    const hazeColor = "rgba(160, 200, 220, 0.32)";

    // Center node: pure white halo
    if (centerId === node.id) return c0;

    // Far-away nodes (BFS distance >= 3) fade to haze
    if (centerId) {
      const dist = bfsDistance(centerId);
      const d = dist.get(node.id);
      if (d === undefined || d >= 3) return hazeColor;
    }

    // Clean cluster-coding by kind
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

  // Reduce the default many-body repulsion a touch so clusters can cohere
  if (graph.d3Force("charge")) {
    graph.d3Force("charge").strength(-90);
  }

  const api = {
    setGraphData(data) {
      rebuildAdjacency(data.nodes || [], data.links || []);
      graph.graphData(data);
    },
    setCenter(nodeId) {
      centerId = nodeId;
      graph.nodeColor(nodeColor);  // force recompute
    },
    getCenterId() {
      return centerId;
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
    getThreeRenderer() {
      return graph.renderer ? graph.renderer() : null;
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
