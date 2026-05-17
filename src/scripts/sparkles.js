/**
 * Gold-Sparkles overlay — drifting golden dust particles drawn on a
 * <canvas> stacked over the 3D stage. Driven by RAF, density-modulated
 * by the gold slider (none below 0.15, ~120 particles at 1.0).
 *
 * Pure 2D canvas — no THREE dependency, no extra vendor cost. Cheap.
 */

const TWO_PI = Math.PI * 2;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeParticle(width, height) {
  return {
    x: rand(0, width),
    y: rand(0, height),
    vx: rand(-0.15, 0.15),
    vy: rand(-0.25, -0.05),
    radius: rand(0.7, 2.3),
    twinkleSpeed: rand(0.0008, 0.002),
    twinklePhase: rand(0, TWO_PI),
    life: rand(0.3, 1),
  };
}

export function createSparkles(canvasEl) {
  const ctx = canvasEl.getContext("2d");
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    gold: 0.35,
    particles: [],
    targetCount: 0,
    width: 0,
    height: 0,
    rafId: null,
    lastTs: 0,
    enabled: !reducedMotion,
  };

  function targetCountForGold(g) {
    if (g < 0.15) return 0;
    return Math.round(20 + g * 110);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    state.width = w;
    state.height = h;
    canvasEl.width = Math.floor(w * dpr);
    canvasEl.height = Math.floor(h * dpr);
    canvasEl.style.width = w + "px";
    canvasEl.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ensureParticleCount() {
    while (state.particles.length < state.targetCount) {
      state.particles.push(makeParticle(state.width, state.height));
    }
    while (state.particles.length > state.targetCount) {
      state.particles.pop();
    }
  }

  function setGold(value) {
    state.gold = Math.max(0, Math.min(1, value));
    state.targetCount = state.enabled ? targetCountForGold(state.gold) : 0;
    ensureParticleCount();
  }

  function frame(ts) {
    state.rafId = requestAnimationFrame(frame);
    const dt = state.lastTs ? Math.min(50, ts - state.lastTs) : 16;
    state.lastTs = ts;

    ctx.clearRect(0, 0, state.width, state.height);

    if (state.particles.length === 0) return;

    const styles = getComputedStyle(document.documentElement);
    const goldHex = (styles.getPropertyValue("--gold") || "#E6BF52").trim();

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.twinklePhase += p.twinkleSpeed * dt;

      // Wrap around vertically; on horizontal exit, respawn at random
      if (p.y < -10) {
        p.y = state.height + rand(0, 30);
        p.x = rand(0, state.width);
      }
      if (p.x < -10 || p.x > state.width + 10) {
        p.x = rand(0, state.width);
        p.y = rand(0, state.height);
      }

      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(p.twinklePhase));
      const alpha = twinkle * (0.4 + state.gold * 0.6);
      const radius = p.radius * (0.85 + 0.35 * twinkle);

      // Soft halo
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4);
      grad.addColorStop(0, goldHex);
      grad.addColorStop(0.4, goldHex + "80");
      grad.addColorStop(1, goldHex + "00");
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 4, 0, TWO_PI);
      ctx.fill();

      // Bright core
      ctx.globalAlpha = alpha;
      ctx.fillStyle = goldHex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, TWO_PI);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function start() {
    if (!state.enabled || state.rafId !== null) return;
    state.rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    ctx.clearRect(0, 0, state.width, state.height);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  setGold(state.gold);
  start();

  return {
    setGold,
    start,
    stop,
    getParticleCount: () => state.particles.length,
  };
}
