/**
 * Kompetenz Edge-Flow: Wissens-Partikel fliessen entlang der Kanten,
 * deutlich dichter auf Kanten des aktuellen Zentrums. Dichte skaliert
 * mit dem Gold-Slider; reduced-motion schaltet Partikel komplett ab.
 *
 * Überschreibt die Partikel-Callbacks, die gold-pulse registriert —
 * gewollt: der Kompetenz-Graph hat keine Bridge-Edges, es geht nichts
 * verloren. Astro instanziiert dieses Modul nicht.
 */

export function createEdgeFlow(stage) {
  const state = {
    gold: 0.35,
    reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  const fg = stage.getGraphForceInstance();

  function endpointIds(link) {
    const s = typeof link.source === "object" ? link.source.id : link.source;
    const t = typeof link.target === "object" ? link.target.id : link.target;
    return [s, t];
  }

  function isCenterLink(link) {
    const c = stage.getCenterId();
    if (!c) return false;
    const [s, t] = endpointIds(link);
    return s === c || t === c;
  }

  function particleCountFor(link) {
    if (state.reducedMotion || state.gold < 0.15) return 0;
    return isCenterLink(link) ? 1 + Math.round(3 * state.gold) : 1;
  }

  fg.linkDirectionalParticles(particleCountFor);
  fg.linkDirectionalParticleSpeed(() => 0.0035 + state.gold * 0.005);
  fg.linkDirectionalParticleWidth((link) => (isCenterLink(link) ? 1.6 : 1.0) + state.gold * 1.0);
  fg.linkDirectionalParticleColor((link) => {
    const styles = getComputedStyle(document.documentElement);
    const goldC = (styles.getPropertyValue("--edge-gold-rgba") || "rgba(245, 200, 90, 1)").trim();
    const baseC = (styles.getPropertyValue("--edge-base-rgba") || "rgba(140, 220, 255, 0.5)").trim();
    return isCenterLink(link) ? goldC : baseC;
  });

  function refresh() {
    // Partikel-Anzahl wird von 3d-force-graph nur bei Neuzuweisung des
    // Callbacks neu ausgewertet — nach setGold/setCenter nötig.
    fg.linkDirectionalParticles(particleCountFor);
  }

  return {
    setGold(v) {
      state.gold = Math.max(0, Math.min(1, v));
      refresh();
    },
    refresh,
    particleCountFor,
  };
}
