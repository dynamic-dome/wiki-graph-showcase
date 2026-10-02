/**
 * C1: Das klassische 3d-force-graph-Bundle (707 KB, setzt window.ForceGraph3D)
 * wird nicht mehr als parser-blockierendes <script> ausgeliefert, sondern nach
 * dem ersten Paint dynamisch eingefuegt. CSP script-src 'self' erlaubt das
 * (gleicher Ursprung, kein Inline-Code, kein neuer Hash noetig).
 */
export const FORCE_GRAPH_SRC = "assets/vendor/3d-force-graph.min.js";

const BACKGROUND_TAB_FALLBACK_MS = 1500;

/**
 * Loest auf, nachdem der Browser mindestens einmal gemalt hat
 * (zwei Frames + Makrotask). In Hintergrund-Tabs feuert rAF nicht; dort greift
 * nach 1500 ms ein Sicherheitsnetz, damit der Graph trotzdem geladen wird.
 */
export function afterFirstPaint(win = window) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    win.setTimeout(finish, BACKGROUND_TAB_FALLBACK_MS);
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => win.setTimeout(finish, 0));
    });
  });
}

/** Fuegt das Bundle als async-Script ein; liefert die ForceGraph3D-Funktion. */
export function loadForceGraph(doc = document, src = FORCE_GRAPH_SRC) {
  const existing = doc.defaultView && doc.defaultView.ForceGraph3D;
  if (typeof existing === "function") return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      const fg = doc.defaultView.ForceGraph3D;
      if (typeof fg === "function") resolve(fg);
      else reject(new Error("ForceGraph3D global missing after load"));
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    doc.head.appendChild(script);
  });
}
