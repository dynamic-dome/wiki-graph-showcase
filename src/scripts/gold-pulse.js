/**
 * Drive the gold-mode visual: edge color modulation per RAF tick,
 * density-adaptive breath period, CMB layer activation > 70%,
 * brand-glyph color shift, cross-cluster bridge edges glow extra.
 *
 * NOTE: 3d-force-graph renders edges as THREE.LineBasicMaterial instances.
 * We modulate edge color via the linkColor() callback, which is re-evaluated
 * on every render-loop tick.
 */

import { mixRgba, dimRgba } from "./color-utils.js";

const BASE_PERIOD_BY_DENSITY = {
  sparse: 9000,
  medium: 12000,
  dense: 17000,
};

function classifyDensity(edgeCount) {
  if (edgeCount < 12) return "sparse";
  if (edgeCount <= 40) return "medium";
  return "dense";
}

function linkKey(link) {
  const s = typeof link.source === "object" ? link.source.id : link.source;
  const t = typeof link.target === "object" ? link.target.id : link.target;
  return `${s}->${t}`;
}

export function createGoldPulse(stage, cmbLayerEl, brandGlyphEl) {
  const state = {
    gold: 0.35,
    edgeCount: 0,
    density: "medium",
    edgePhases: new Map(),   // key "src->tgt" -> phase offset
    bridgeKeys: new Set(),    // edges that cross clusters — stronger pulse
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
    state.bridgeKeys.clear();
    for (const link of data.links) {
      const key = linkKey(link);
      state.edgePhases.set(key, Math.random() * 6000);
      if (stage.isCrossClusterLink(link)) {
        state.bridgeKeys.add(key);
      }
    }
  }

  function updateAmbient() {
    if (state.reducedMotion || state.gold <= 0.7) {
      cmbLayerEl.classList.remove("active");
      cmbLayerEl.style.opacity = "0";
    } else {
      cmbLayerEl.classList.add("active");
      const intensity = ((state.gold - 0.7) / 0.3) * 0.5;
      cmbLayerEl.style.opacity = String(intensity);
    }
    const styles = getComputedStyle(document.documentElement);
    const goldHex = (styles.getPropertyValue("--gold") || "#E6BF52").trim();
    const cyanHex = (styles.getPropertyValue("--brand-glyph-color") || "#98E8FF").trim();
    if (state.gold > 0.5) {
      brandGlyphEl.style.color = goldHex;
      brandGlyphEl.style.textShadow = `0 0 ${10 + state.gold * 14}px ${goldHex}`;
    } else {
      brandGlyphEl.style.color = cyanHex;
      brandGlyphEl.style.textShadow = `0 0 10px ${cyanHex}`;
    }
  }

  function edgeColorAt(link, nowMs) {
    const key = linkKey(link);
    const isBridge = state.bridgeKeys.has(key);

    const styles = getComputedStyle(document.documentElement);
    const baseColor = (styles.getPropertyValue("--edge-base-rgba") || "rgba(140, 220, 255, 0.5)").trim();
    const goldColor = (styles.getPropertyValue("--edge-gold-rgba") || "rgba(245, 200, 90, 1)").trim();
    const bridgeColor = (styles.getPropertyValue("--edge-bridge-rgba") || "rgba(255, 200, 100, 0.85)").trim();

    if (state.reducedMotion) {
      // Bridges still highlighted, just not animated.
      return dimRgba(isBridge ? bridgeColor : baseColor, stage.getLinkDim(link));
    }

    const offset = state.edgePhases.get(key) ?? 0;
    const basePeriod = BASE_PERIOD_BY_DENSITY[state.density];
    const tempoFactor = 1 - state.gold * 0.7;
    const period = basePeriod * Math.max(0.25, tempoFactor);
    const phase = ((nowMs + offset) % period) / period; // 0..1

    // Sinusoidal pulse, biased so most of the time the edge sits in baseline.
    const pulse = Math.max(0, Math.sin(phase * Math.PI * 2));
    // Bridges pulse even at low gold, and brighter.
    const bridgeBoost = isBridge ? 0.55 : 0.0;
    const intensity = Math.min(1, pulse * (0.25 + state.gold * 0.85) + bridgeBoost * pulse);

    const accent = isBridge ? bridgeColor : goldColor;
    return dimRgba(mixRgba(baseColor, accent, intensity), stage.getLinkDim(link));
  }

  function edgeWidthAt(link) {
    const key = linkKey(link);
    const base = state.bridgeKeys.has(key) ? 1.5 : 0.8;
    // gold mode thickens bridges further
    return base + state.gold * (state.bridgeKeys.has(key) ? 1.4 : 0.2);
  }

  // Hook into the stage's link callbacks
  const fg = stage.getGraphForceInstance();
  fg.linkColor((link) => edgeColorAt(link, performance.now()));
  fg.linkWidth((link) => edgeWidthAt(link));
  // Light directional particles travel along bridge edges when gold is high
  fg.linkDirectionalParticles((link) =>
    state.bridgeKeys.has(linkKey(link)) && state.gold > 0.4 ? 2 : 0
  );
  fg.linkDirectionalParticleSpeed(() => 0.004 + state.gold * 0.006);
  fg.linkDirectionalParticleWidth(() => 1.5 + state.gold * 1.5);
  fg.linkDirectionalParticleColor(() => {
    const styles = getComputedStyle(document.documentElement);
    return (styles.getPropertyValue("--edge-bridge-rgba") || "rgba(255, 200, 100, 0.85)").trim();
  });

  return {
    setGold,
    notifyGraphData,
    getGold: () => state.gold,
    getBridgeCount: () => state.bridgeKeys.size,
  };
}
