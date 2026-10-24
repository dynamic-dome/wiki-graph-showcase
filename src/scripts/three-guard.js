/**
 * THREE-Revision-Tripwire. 3d-force-graph (ESM-Variante) nutzt seit WEB-5 die
 * Vendor-THREE (src/vendor/three) ueber die Import Map, es gibt nur EINE
 * Instanz. Das Bundle enthaelt aber three/examples-Code (Controls,
 * EffectComposer) in der Revision r168; die Vendor-THREE MUSS dazu passen,
 * sonst rendert es still falsch — kein lauter Fehler, nur subtil kaputte
 * Darstellung.
 *
 * Dieser Tripwire schlaegt an, wenn jemand die Vendor-Kopie tauscht, ohne
 * EXPECTED_THREE_REVISION (und das Bundle, tools/vendor-force-graph-esm.mjs)
 * mitzuziehen.
 */
import { REVISION } from "three";

const EXPECTED_THREE_REVISION = "168";

if (REVISION !== EXPECTED_THREE_REVISION) {
  console.warn(
    `[aurum] Vendor-THREE r${REVISION} weicht von erwarteter r${EXPECTED_THREE_REVISION} ab — ` +
      "muss zur THREE-Revision im 3d-force-graph-Bundle passen (siehe CLAUDE.md).",
  );
}
