/**
 * Auto-Tour controller.
 * - Idle drift: after IDLE_MS without user input, the camera slowly orbits
 *   the current center node.
 * - Explicit tour: cycles through the top-N hubs by weight, settling on
 *   each for STATION_MS before easing to the next.
 *
 * User input (any pointer/keyboard/wheel event) cancels both modes
 * immediately. Tour can be re-armed via startTour() and idle drift
 * resumes automatically after IDLE_MS.
 */

const IDLE_MS = 10000;            // pause before idle-drift starts
const STATION_MS = 4500;          // dwell on each tour station
const TRANSITION_MS = 1800;       // ease to next station
const DRIFT_RADIUS = 260;
const DRIFT_PERIOD_MS = 24000;

function pickTopHubs(nodes, n) {
  return [...nodes]
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, n);
}

export function createAutoTour(stage, statusBarEl) {
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    enabled: !reducedMotion,
    idleTimer: null,
    driftRafId: null,
    tourTimer: null,
    onTour: false,
    tourStations: [],
    tourIdx: 0,
    onStationChange: null,
  };

  function clearTimers() {
    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
    if (state.tourTimer) {
      clearTimeout(state.tourTimer);
      state.tourTimer = null;
    }
    if (state.driftRafId !== null) {
      cancelAnimationFrame(state.driftRafId);
      state.driftRafId = null;
    }
  }

  function startIdleDrift() {
    if (!state.enabled || state.onTour) return;
    const fg = stage.getGraphForceInstance();
    const centerId = stage.getCenterId();
    const node = centerId ? stage.getNodeById(centerId) : null;
    const focus = node || { x: 0, y: 0, z: 0 };

    const startTs = performance.now();
    function tick(now) {
      const t = ((now - startTs) % DRIFT_PERIOD_MS) / DRIFT_PERIOD_MS;
      const angle = t * Math.PI * 2;
      fg.cameraPosition({
        x: focus.x + Math.cos(angle) * DRIFT_RADIUS,
        y: focus.y + Math.sin(angle * 0.6) * DRIFT_RADIUS * 0.35,
        z: focus.z + Math.sin(angle) * DRIFT_RADIUS,
      }, focus, 0);
      state.driftRafId = requestAnimationFrame(tick);
    }
    state.driftRafId = requestAnimationFrame(tick);
    if (statusBarEl) statusBarEl.textContent = "AUTO-DRIFT · Bewegen um zu stoppen";
  }

  function scheduleIdleDrift() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(startIdleDrift, IDLE_MS);
  }

  function stopAll(silent) {
    clearTimers();
    state.onTour = false;
    if (!silent && statusBarEl) statusBarEl.textContent = "";
  }

  function nextStation() {
    if (!state.onTour || state.tourStations.length === 0) return;
    const station = state.tourStations[state.tourIdx % state.tourStations.length];
    const fg = stage.getGraphForceInstance();
    if (station && station.x !== undefined) {
      fg.cameraPosition({
        x: station.x + 60,
        y: station.y + 40,
        z: station.z + 220,
      }, station, TRANSITION_MS);
    }
    if (state.onStationChange) state.onStationChange(station);
    if (statusBarEl && station) {
      statusBarEl.textContent = `TOUR · ${state.tourIdx + 1}/${state.tourStations.length} · ${station.title || station.id}`;
    }
    state.tourIdx++;
    state.tourTimer = setTimeout(nextStation, STATION_MS);
  }

  function startTour(opts) {
    stopAll(true);
    const fg = stage.getGraphForceInstance();
    const allNodes = fg.graphData().nodes;
    if (allNodes.length === 0) return;
    state.tourStations = pickTopHubs(allNodes, opts?.stationCount ?? 6);
    state.tourIdx = 0;
    state.onTour = true;
    state.onStationChange = opts?.onStationChange ?? null;
    nextStation();
  }

  // Any user input cancels current motion + restarts idle countdown.
  // Wheel/keydown/touch always count; pointerdown is ignored when it
  // originated on the tour button itself (so startTour() isn't killed
  // by its own click).
  function onUserInput(event) {
    if (event && event.type === "pointerdown") {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      for (const el of path) {
        if (el && el.id === "tour-btn") return;
      }
    }
    if (state.onTour || state.driftRafId !== null) {
      stopAll();
    }
    scheduleIdleDrift();
  }

  if (state.enabled) {
    ["pointerdown", "wheel", "keydown", "touchstart"].forEach(ev => {
      window.addEventListener(ev, onUserInput, { passive: true });
    });
    scheduleIdleDrift();
  }

  return {
    startTour,
    stopAll: () => stopAll(),
    isOnTour: () => state.onTour,
  };
}
