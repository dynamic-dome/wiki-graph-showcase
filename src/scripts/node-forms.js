/**
 * Kategorie-Geometrien für den Kompetenz-Graph (nodeThreeObject):
 *   competence = Ikosaeder · synthesis = Torus · entity = Oktaeder
 *   topic = Kugel (mittel) · concept = Kugel (low-poly)
 * Emissive-Material, damit der Bloom-Pass die Formen aufnimmt.
 *
 * Farben/Dimming kommen aus derselben Quelle wie vorher (stage.getNodeRgba →
 * nodeColor-Logik inkl. Spotlight/Haze); refreshVisuals() überträgt sie auf
 * die Material-Registry, weil der nodeColor-Callback für Custom-Objekte
 * nicht mehr greift.
 */
import {
  Color, IcosahedronGeometry, Mesh, MeshLambertMaterial,
  OctahedronGeometry, SphereGeometry, TorusGeometry,
} from "three";
import { sizeFromWeight } from "./three-stage.js";
import { parseRgba } from "./color-utils.js";

const NODE_REL_SIZE = 4; // muss graph.nodeRelSize(4) in three-stage.js entsprechen

function geometryFor(category, r) {
  switch (category) {
    case "competence": return new IcosahedronGeometry(r, 0);
    case "synthesis": return new TorusGeometry(r * 0.75, r * 0.3, 10, 24);
    case "entity": return new OctahedronGeometry(r, 0);
    case "topic": return new SphereGeometry(r, 20, 14);
    default: return new SphereGeometry(r * 0.9, 10, 8); // concept: bewusst low-poly
  }
}

// "rgba(r,g,b,a)" → { color: THREE.Color, alpha } ; Hex-Strings haben alpha 1.
function splitColor(str) {
  const p = parseRgba(str);
  if (p) return { color: new Color(`rgb(${p[0]},${p[1]},${p[2]})`), alpha: p[3] };
  return { color: new Color(str), alpha: 1 };
}

export function createNodeForms(stage) {
  const registry = new Map(); // nodeId -> material

  function applyVisual(node, mat) {
    const { color, alpha } = splitColor(stage.getNodeRgba(node));
    mat.color.copy(color);
    mat.emissive.copy(color);
    const isCenter = stage.getCenterId() === node.id;
    mat.emissiveIntensity = isCenter ? 0.9 : 0.4;
    // Haze-/Spotlight-Dimming kommt als rgba-Alpha aus getNodeRgba.
    mat.opacity = alpha < 1 ? Math.max(alpha, 0.08) : 0.95;
  }

  return {
    objectFor(node) {
      const r = NODE_REL_SIZE * Math.cbrt(sizeFromWeight(node.weight));
      const mat = new MeshLambertMaterial({ transparent: true });
      registry.set(node.id, mat);
      applyVisual(node, mat);
      const mesh = new Mesh(geometryFor(node.category, r), mat);
      mesh.userData.aurumForm = true;
      return mesh;
    },
    refreshVisuals() {
      for (const [id, mat] of registry) {
        const node = stage.getNodeById(id);
        if (node) applyVisual(node, mat);
      }
    },
  };
}
