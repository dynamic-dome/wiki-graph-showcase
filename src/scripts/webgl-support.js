/**
 * C2: Feststellen, ob WebGL ueberhaupt verfuegbar ist, bevor die 3D-Szene
 * aufgebaut wird. Der Test-Kontext wird sofort wieder freigegeben (Browser
 * erlauben nur wenige gleichzeitige WebGL-Kontexte).
 */
export function hasWebGL(doc = document) {
  try {
    const canvas = doc.createElement("canvas");
    const ctx = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!ctx) return false;
    const lose = ctx.getExtension && ctx.getExtension("WEBGL_lose_context");
    if (lose && typeof lose.loseContext === "function") lose.loseContext();
    return true;
  } catch (_e) {
    return false;
  }
}
