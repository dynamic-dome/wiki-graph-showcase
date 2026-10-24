/**
 * C1: 3d-force-graph (ESM-Variante, ~206 KB) wird nicht mit dem Start-Skript
 * geladen, sondern nach dem ersten Paint per dynamischem import() nachgeholt.
 * CSP script-src 'self' erlaubt das (gleicher Ursprung, kein Inline-Code, kein
 * neuer Hash noetig).
 *
 * WEB-5 (#9603): Die ESM-Variante importiert `three` ueber die Import Map und
 * teilt sich damit die EINE Vendor-Instanz (src/vendor/three) mit Bloom,
 * Scene-Dressing und Node-Forms. Das frueher geladene UMD-Bundle
 * (3d-force-graph.min.js, 707 KB) brachte eine zweite, eigene THREE-Kopie mit
 * ("Multiple instances of Three.js being imported").
 */
export const FORCE_GRAPH_SRC = "../vendor/3d-force-graph.esm.min.js";

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

// Relativ zu DIESEM Modul aufgeloest (assets/scripts/ -> assets/vendor/).
const defaultImporter = (src) => import(src);

/**
 * Importiert das ESM-Modul; liefert die ForceGraph3D-Funktion (Default-Export).
 * `importer` ist nur fuer Tests austauschbar.
 */
export async function loadForceGraph(importer = defaultImporter, src = FORCE_GRAPH_SRC) {
  let mod;
  try {
    mod = await importer(src);
  } catch (err) {
    throw new Error(`Failed to load ${src}: ${err && err.message ? err.message : err}`);
  }
  const fg = mod && mod.default;
  if (typeof fg !== "function") {
    throw new Error("ForceGraph3D default export missing after load");
  }
  return fg;
}

/**
 * #9949: Module, die `three` statisch importieren, werden nicht mehr von main.js importiert, sondern hier nach dem
 * ersten Paint per import() nachgeholt (alle gleicher Ursprung, CSP-neutral). `three-guard.js` prueft nur die
 * Revision (Seiteneffekt). `importer` ist nur fuer Tests austauschbar und bekommt den Modulnamen.
 */
export const THREE_MODULES = {
  guard: "./three-guard.js",
  nodeForms: "./node-forms.js",
  sceneDressing: "./scene-dressing.js",
  bloom: "./bloom.js",
};

export async function loadThreeModules(importer = defaultImporter) {
  let guard, nodeForms, sceneDressing, bloom;
  try {
    [guard, nodeForms, sceneDressing, bloom] = await Promise.all([
      importer(THREE_MODULES.guard),
      importer(THREE_MODULES.nodeForms),
      importer(THREE_MODULES.sceneDressing),
      importer(THREE_MODULES.bloom),
    ]);
  } catch (err) {
    throw new Error(`Failed to load THREE modules: ${err && err.message ? err.message : err}`);
  }
  void guard; // nur der Seiteneffekt zaehlt (Revisions-Tripwire)
  return {
    createNodeForms: nodeForms.createNodeForms,
    createSceneDressing: sceneDressing.createSceneDressing,
    createBloom: bloom.createBloom,
  };
}
