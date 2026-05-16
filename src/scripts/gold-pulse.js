/**
 * Drive the gold-mode visual: edge color modulation per RAF tick,
 * density-adaptive breath period, CMB layer activation > 70%.
 *
 * NOTE: 3d-force-graph renders edges as THREE.LineBasicMaterial instances.
 * To modulate edge color we use the linkColor() callback per frame, which
 * is cheap because 3d-force-graph re-evaluates it on every renderloop tick.
 */

const BASE_PERIOD_BY_DENSITY = {
  sparse: 9000,
  medium: 12000,
  dense: 18000,
};

function classifyDensity(edgeCount) {
  if (edgeCount < 12) return "sparse";
  if (edgeCount <= 24) return "medium";
  return "dense";
}

export function createGoldPulse(stage, cmbLayerEl, brandGlyphEl) {
  const state = {
    gold: 0.35,
    edgeCount: 0,
    density: "medium",
    edgePhases: new Map(),  // key "src->tgt" -> phase offset
    reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };

  function setGold(value) {
    state.gold = Math.max(0, Math.min(1, value));
    updateAmbient();
  }

  function notifyGraphData(data) {
    state.edgeCount = data.links.length;
    state.density = classifyDensity(state.edgeCount);
    state.edgePhases.clear();
    for (const link of data.links) {
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      state.edgePhases.set(`${s}->${t}`, Math.random() * 6000);
    }
  }

  function updateAmbient() {
    // CMB strobe layer
    if (state.reducedMotion || state.gold <= 0.7) {
      cmbLayerEl.classList.remove("active");
      cmbLayerEl.style.opacity = "0";
    } else {
      cmbLayerEl.classList.add("active");
      const intensity = ((state.gold - 0.7) / 0.3) * 0.4;
      cmbLayerEl.style.opacity = String(intensity);
    }
    // Brand glyph color shift
    const styles = getComputedStyle(document.documentElement);
    const goldHex = (styles.getPropertyValue("--gold") || "#E6BF52").trim();
    const cyanHex = (styles.getPropertyValue("--brand-glyph-color") || "#98E8FF").trim();
    if (state.gold > 0.5) {
      brandGlyphEl.style.color = goldHex;
      brandGlyphEl.style.textShadow = `0 0 ${10 + state.gold * 10}px ${goldHex}`;
    } else {
      brandGlyphEl.style.color = cyanHex;
      brandGlyphEl.style.textShadow = `0 0 10px ${cyanHex}`;
    }
  }

  function edgeColorAt(link, nowMs) {
    if (state.reducedMotion) {
      const styles = getComputedStyle(document.documentElement);
      return (styles.getPropertyValue("--edge-base-rgba") || "rgba(140, 220, 255, 0.5)").trim();
    }
    const s = typeof link.source === "object" ? link.source.id : link.source;
    const t = typeof link.target === "object" ? link.target.id : link.target;
    const key = `${s}->${t}`;
    const offset = state.edgePhases.get(key) ?? 0;

    const basePeriod = BASE_PERIOD_BY_DENSITY[state.density];
    const tempoFactor = 1 - state.gold * 0.75;
    const period = basePeriod * tempoFactor;
    const phase = ((nowMs + offset) % period) / period; // 0..1

    const styles = getComputedStyle(document.documentElement);
    const baseColor = (styles.getPropertyValue("--edge-base-rgba") || "rgba(140, 220, 255, 0.5)").trim();
    const goldColor = (styles.getPropertyValue("--edge-gold-rgba") || "rgba(230, 191, 82, 1)").trim();

    if (phase < 0.78) return baseColor;
    if (phase < 0.88) {
      // mix base->gold via simple lerp on the alpha
      return goldColor;
    }
    if (phase < 0.95) {
      return goldColor;
    }
    return baseColor;
  }

  // Hook into the stage's link-color callback
  stage.getGraphForceInstance().linkColor((link) => edgeColorAt(link, performance.now()));

  return {
    setGold,
    notifyGraphData,
    getGold: () => state.gold,
  };
}
