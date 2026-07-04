/**
 * Focus-lock reticle: a brief "target acquired" flourish drawn at a node's
 * projected screen position when it is selected/recentred. Pure DOM/CSS over
 * the graph2ScreenCoords() projection — no THREE, no camera ownership.
 * The outer element carries the JS-set position; the inner ring carries the
 * converge-and-fade animation so the two never fight.
 */

export function createFocusLock(reticleEl, stage) {
  if (!reticleEl) return { lockOn() {} };
  const fg = stage.getGraphForceInstance();
  let hideTimer = null;

  function lockOn(node) {
    if (!node || node.x === undefined || node.x === null) return;
    const sc = fg.graph2ScreenCoords(node.x, node.y, node.z);
    if (!sc) return;
    reticleEl.style.transform = `translate(${sc.x}px, ${sc.y}px)`;
    // Restart the CSS animation by toggling the class across a reflow.
    reticleEl.classList.remove("lock");
    void reticleEl.offsetWidth;
    reticleEl.classList.add("lock");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => reticleEl.classList.remove("lock"), 900);
  }

  return { lockOn };
}
