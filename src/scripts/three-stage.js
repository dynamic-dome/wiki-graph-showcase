/**
 * Set up the 3d-force-graph stage. Returns a controller object with:
 *   - setGraphData(data): replace nodes+links
 *   - setCenter(nodeId): mark a node as center, recolor others by BFS distance
 *   - onNodeClick(handler), onNodeHover(handler), onNodeDoubleClick(handler)
 *   - getEdgesForBreath(): array of three.js Line3 objects keyed by source-target ids
 *
 * Reads CSS variables from the current --theme via getComputedStyle.
 */

const DOUBLE_CLICK_MS = 350;

export function createStage(container) {
  // 3d-force-graph is a global UMD when vendored
  const ForceGraph3D = window.ForceGraph3D;
  if (typeof ForceGraph3D !== "function") {
    throw new Error("ForceGraph3D global not found — is 3d-force-graph.min.js loaded?");
  }

  const graph = ForceGraph3D()(container)
    .backgroundColor("rgba(0,0,0,0)")
    .nodeRelSize(5)
    .nodeOpacity(0.95)
    .linkWidth(1)
    .linkOpacity(0.55)
    .cooldownTicks(400)
    .enableNodeDrag(false);

  let centerId = null;
  let adjacency = new Map();
  let lastClickMs = 0;
  let lastClickedId = null;

  function rebuildAdjacency(links) {
    adjacency = new Map();
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
    const c0 = styles.getPropertyValue("--node-center").trim() || "#FFFFFF";
    const c1 = styles.getPropertyValue("--node-ring1").trim() || "#8CF0FF";
    const c2 = styles.getPropertyValue("--node-ring2").trim() || "#F08CC8";
    const hazeColor = "rgba(160, 200, 220, 0.35)";

    if (!centerId) return c1;
    const dist = bfsDistance(centerId);
    const d = dist.get(node.id);
    if (d === 0) return c0;
    if (d === 1) return c1;
    if (d === 2) return c2;
    return hazeColor;
  }

  function nodeSize(node) {
    if (node.id === centerId) return 9;
    if (node.category === "entity") return 7;
    return 5;
  }

  graph.nodeColor(nodeColor).nodeVal(nodeSize);

  const api = {
    setGraphData(data) {
      rebuildAdjacency(data.links || []);
      graph.graphData(data);
    },
    setCenter(nodeId) {
      centerId = nodeId;
      graph.nodeColor(nodeColor);  // force recompute
    },
    centerCamera() {
      const node = graph.graphData().nodes.find(n => n.id === centerId);
      if (node) {
        graph.cameraPosition(
          { x: node.x, y: node.y, z: node.z + 280 },
          node,
          1200
        );
      }
    },
    onNodeClick(handler) {
      graph.onNodeClick((node, event) => {
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
  };

  return api;
}
