/**
 * In-space node labels via 2D screen projection. The vendor bundle doesn't
 * expose THREE, but it DOES expose graph2ScreenCoords(), so we place DOM label
 * chips at the projected pixel positions each frame — no 600KB three.min.js.
 *
 * Clutter control: only hubs (weight >= threshold), the current focus node and
 * its direct neighbours get a label, capped to maxLabels. Labels behind the
 * camera are culled (dot-product front test) and far labels fade by distance.
 * Reuses stage.getAdjacency()/getNodeById()/getCenterId() — no new data.
 */

export function createLabels(layerEl, stage, opts = {}) {
  if (!layerEl) return { refresh() {}, start() {}, stop() {} };
  const maxLabels = opts.maxLabels ?? 10;
  const hubThreshold = opts.hubThreshold ?? 0.4;
  const fg = stage.getGraphForceInstance();

  let labelNodes = [];
  const chips = new Map(); // nodeId -> element
  let rafId = null;

  function refresh() {
    const data = fg.graphData();
    const centerId = stage.getCenterId();
    const picked = new Map();

    // Landmarks: the strong hubs (well distributed across the graph) plus the
    // current focus node. Deliberately NOT every neighbour of the focus — that
    // stacks labels on top of each other in the dense core.
    for (const n of data.nodes) {
      if ((n.weight || 0) >= hubThreshold) picked.set(n.id, n);
    }
    if (centerId) {
      const c = stage.getNodeById(centerId);
      if (c) picked.set(c.id, c);
    }

    let arr = [...picked.values()];
    if (arr.length > maxLabels) {
      arr.sort((a, b) => {
        const ac = a.id === centerId ? 1 : 0;
        const bc = b.id === centerId ? 1 : 0;
        if (ac !== bc) return bc - ac; // always keep the focus label
        return (b.weight || 0) - (a.weight || 0);
      });
      arr = arr.slice(0, maxLabels);
    }
    labelNodes = arr;

    // Rebuild chips to match the new set.
    layerEl.innerHTML = "";
    chips.clear();
    for (const n of labelNodes) {
      const el = document.createElement("div");
      el.className = "node-label";
      if (centerId === n.id) el.classList.add("is-center");
      el.textContent = n.title || n.id;
      layerEl.appendChild(el);
      chips.set(n.id, el);
    }
  }

  function frame() {
    const cam = typeof stage.getCamera === "function" ? stage.getCamera() : null;
    const controls = typeof fg.controls === "function" ? fg.controls() : null;
    const camPos = cam && cam.position ? cam.position : null;
    const tgt = controls && controls.target ? controls.target : { x: 0, y: 0, z: 0 };

    let fwd = null;
    if (camPos) fwd = { x: tgt.x - camPos.x, y: tgt.y - camPos.y, z: tgt.z - camPos.z };

    for (const n of labelNodes) {
      const el = chips.get(n.id);
      if (!el) continue;
      if (n.x === undefined || n.x === null) { el.style.opacity = "0"; continue; }

      // Cull nodes behind the camera (screen coords are unreliable there).
      if (camPos && fwd) {
        const nv = { x: n.x - camPos.x, y: n.y - camPos.y, z: n.z - camPos.z };
        if (fwd.x * nv.x + fwd.y * nv.y + fwd.z * nv.z <= 0) { el.style.opacity = "0"; continue; }
      }

      const sc = fg.graph2ScreenCoords(n.x, n.y, n.z);
      // Cull well outside the viewport.
      if (sc.x < -80 || sc.y < -40 || sc.x > window.innerWidth + 80 || sc.y > window.innerHeight + 40) {
        el.style.opacity = "0";
        continue;
      }
      el.style.transform = `translate(${sc.x}px, ${sc.y}px) translate(-50%, -150%)`;

      let op = 1;
      if (camPos) {
        const dx = n.x - camPos.x, dy = n.y - camPos.y, dz = n.z - camPos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        op = Math.max(0, Math.min(1, 1.55 - d / 640));
      }
      el.style.opacity = String(el.classList.contains("is-center") ? Math.max(op, 0.85) : op);
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  return { refresh, start, stop };
}
