/**
 * THREE-Revision-Tripwire. Das gebuendelte 3d-force-graph nutzt intern THREE
 * r168; unsere Vendor-Kopie (src/vendor/three) MUSS dieselbe Revision sein,
 * sonst rendern die Vendor-Objekte (Bloom, Scene-Dressing, Node-Forms) still
 * falsch — kein lauter Fehler, nur subtil kaputte Darstellung.
 *
 * Grenze: das Bundle exponiert seine THREE-Instanz nicht, deshalb laesst sich
 * zur Laufzeit nur die Vendor-Seite pruefen. Ein Update des Bundles auf eine
 * neue THREE-Revision faengt weiterhin nur der statische grep-Check aus
 * CLAUDE.md ab ('const a="168"'). Dieser Tripwire schlaegt an, wenn jemand die
 * Vendor-Kopie tauscht, ohne EXPECTED_THREE_REVISION mitzuziehen.
 */
import { REVISION } from "three";

const EXPECTED_THREE_REVISION = "168";

if (REVISION !== EXPECTED_THREE_REVISION) {
  console.warn(
    `[aurum] Vendor-THREE r${REVISION} weicht von erwarteter r${EXPECTED_THREE_REVISION} ab — ` +
      "muss zur THREE-Revision im 3d-force-graph-Bundle passen (siehe CLAUDE.md).",
  );
}
