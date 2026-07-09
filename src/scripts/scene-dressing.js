/**
 * Aurum-Dressing: echtes 3D-Sternenfeld (THREE.Points) + weiche
 * Nebel-Billboards in der Graph-Szene. Ersetzt das 2D-Sparkles-Overlay
 * (Entscheid 2026-07-09): echte Parallaxe statt flachem Canvas.
 *
 * "three" kommt per Import Map aus src/vendor/three/ (r168 — muss zur
 * Revision im 3d-force-graph-Bundle passen). Objekte aus dieser
 * THREE-Instanz werden vom Bundle-Renderer gerendert; das funktioniert,
 * weil beide Instanzen dieselbe Revision haben (Duck-Typing, kein instanceof).
 */
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color,
  Float32BufferAttribute, Group, Points, PointsMaterial,
  Sprite, SpriteMaterial,
} from "three";

const STAR_COUNT = 1500;
const STAR_BASE = new Color("#cfe4ff");
const STAR_GOLD = new Color("#f5c24a");

function makeNebulaTexture(rgb) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb}, 0.28)`);
  grad.addColorStop(0.5, `rgba(${rgb}, 0.10)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

export function createSceneDressing(stage) {
  const fg = stage.getGraphForceInstance();
  const scene = typeof fg.scene === "function" ? fg.scene() : null;
  if (!scene) return { setGold() {}, isActive: () => false };

  const group = new Group();
  group.name = "aurum-dressing";

  // Sternenfeld: Kugelschale (r 700–1600) um die Graph-Wolke.
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 700 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const starMat = new PointsMaterial({
    size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0.75,
    depthWrite: false, blending: AdditiveBlending, color: STAR_BASE.clone(),
  });
  group.add(new Points(geo, starMat));

  // Nebel-Billboards: cyan / gold / violett, weit hinter der Wolke.
  const nebulaSpecs = [
    { rgb: "140, 200, 255", scale: 1300, pos: [-500, 150, -700] },
    { rgb: "245, 194, 74", scale: 1000, pos: [600, -200, -900] },
    { rgb: "180, 120, 235", scale: 900, pos: [100, 380, -1100] },
  ];
  for (const spec of nebulaSpecs) {
    const mat = new SpriteMaterial({
      map: makeNebulaTexture(spec.rgb), transparent: true,
      depthWrite: false, opacity: 0.8,
    });
    const sprite = new Sprite(mat);
    sprite.scale.set(spec.scale, spec.scale, 1);
    sprite.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    group.add(sprite);
  }

  scene.add(group);

  // Kaum wahrnehmbare Dauerrotation — statisch bei reduced motion.
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    (function spin() {
      group.rotation.y += 0.00008;
      requestAnimationFrame(spin);
    })();
  }

  return {
    setGold(v) {
      const t = Math.max(0, Math.min(1, v)) * 0.6;
      starMat.color.copy(STAR_BASE).lerp(STAR_GOLD, t);
    },
    isActive: () => true,
  };
}
