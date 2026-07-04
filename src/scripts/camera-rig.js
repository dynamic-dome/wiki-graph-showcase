/**
 * One camera state machine over the 3d-force-graph cameraPosition() proxy.
 * Owns a single rAF tween at a time — starting a new move (or stop()) cancels
 * the in-flight one via a monotonic token, so the intro fly-in, focus-lock
 * dolly and any future move never fight for the camera.
 *
 * Uses ONLY the already-exposed API (cameraPosition(), controls().target) —
 * no THREE global, no extra vendor file. Honors prefers-reduced-motion by
 * snapping to the end frame.
 */

import { easeInOutCubic, easeOutQuart } from "./ease.js";

export function createCameraRig(stage) {
  const fg = stage.getGraphForceInstance();
  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let token = 0;

  function currentEye() {
    const p = fg.cameraPosition() || { x: 0, y: 0, z: 300 };
    return { x: p.x || 0, y: p.y || 0, z: p.z || 300 };
  }
  function currentLook() {
    const c = typeof fg.controls === "function" ? fg.controls() : null;
    const t = c && c.target ? c.target : { x: 0, y: 0, z: 0 };
    return { x: t.x || 0, y: t.y || 0, z: t.z || 0 };
  }

  function stop() {
    token++;
  }

  function animate(fromEye, toEye, fromLook, toLook, ms, ease, onDone) {
    stop();
    const myToken = token;
    const start = performance.now();
    function tick(now) {
      if (myToken !== token) return; // superseded or stopped
      const t = Math.min(1, (now - start) / ms);
      const e = ease(t);
      const eye = {
        x: fromEye.x + (toEye.x - fromEye.x) * e,
        y: fromEye.y + (toEye.y - fromEye.y) * e,
        z: fromEye.z + (toEye.z - fromEye.z) * e,
      };
      const look = {
        x: fromLook.x + (toLook.x - fromLook.x) * e,
        y: fromLook.y + (toLook.y - fromLook.y) * e,
        z: fromLook.z + (toLook.z - fromLook.z) * e,
      };
      fg.cameraPosition(eye, look, 0);
      if (t < 1) requestAnimationFrame(tick);
      else if (onDone) onDone();
    }
    requestAnimationFrame(tick);
  }

  /** Cinematic dolly toward a node (focus-lock, tour stations, recenter). */
  function flyTo(eye, look, opts = {}) {
    const ms = opts.ms ?? 1300;
    const ease = opts.ease || easeInOutCubic;
    if (reduce) {
      fg.cameraPosition(eye, look, 0);
      if (opts.onDone) opts.onDone();
      return;
    }
    animate(currentEye(), eye, currentLook(), look, ms, ease, opts.onDone);
  }

  /** Deep-space cold-open: snap far, then ease in toward the nebula centroid. */
  function intro(opts = {}) {
    const look = { x: 0, y: 0, z: 0 };
    const endEye = { x: 0, y: 0, z: opts.endZ ?? 330 };
    const ms = opts.ms ?? 3400;
    if (reduce) {
      fg.cameraPosition(endEye, look, 0);
      if (opts.onDone) opts.onDone();
      return;
    }
    const startEye = { x: -150, y: 55, z: opts.startZ ?? 2600 };
    fg.cameraPosition(startEye, look, 0); // snap far immediately
    animate(startEye, endEye, look, look, ms, easeOutQuart, opts.onDone);
  }

  /** Snap straight to the resting frame (returning visitor / reduced motion),
   *  so framing — and thus label legibility — is identical to a played intro. */
  function settle(opts = {}) {
    stop();
    fg.cameraPosition({ x: 0, y: 0, z: opts.endZ ?? 330 }, { x: 0, y: 0, z: 0 }, 0);
  }

  return { intro, flyTo, settle, stop, currentEye, currentLook };
}
