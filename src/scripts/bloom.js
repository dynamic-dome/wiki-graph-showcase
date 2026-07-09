/**
 * Bloom-Post-Processing: UnrealBloomPass (three r168, Vendor) wird in den
 * Composer gepusht, den das 3d-force-graph-Bundle bereits mitbringt
 * (postProcessingComposer()). Hoher Threshold: nur helle Kerne glühen.
 *
 * Fallback: schlägt irgendetwas fehl (kein Composer, WebGL-Limit),
 * liefert createBloom ein No-op-Objekt — der Graph rendert normal weiter.
 */
import { Vector2 } from "three";
import { UnrealBloomPass } from "../vendor/three/postprocessing/UnrealBloomPass.js";

export function createBloom(stage) {
  const noop = { setGold() {}, isActive: () => false };
  try {
    const fg = stage.getGraphForceInstance();
    if (typeof fg.postProcessingComposer !== "function") return noop;
    const composer = fg.postProcessingComposer();
    if (!composer || typeof composer.addPass !== "function") return noop;

    const pass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      0.5,   // strength — wird von setGold sofort überschrieben
      0.6,   // radius
      0.55,  // threshold: nur helle Knoten/Partikel bloomen, kein Flächen-Matsch
    );
    composer.addPass(pass);

    return {
      setGold(v) {
        const g = Math.max(0, Math.min(1, v));
        pass.enabled = g > 0.01;
        pass.strength = 0.15 + 1.05 * g;  // 35 % Gold ≈ 0.52, 100 % = 1.2 (Spec)
      },
      isActive: () => pass.enabled,
    };
  } catch (err) {
    console.warn("Bloom deaktiviert:", err);
    return noop;
  }
}
