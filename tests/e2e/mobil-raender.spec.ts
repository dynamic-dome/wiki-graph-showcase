import { test, expect, Browser } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startPreview, Preview } from "./helpers/preview";

// Schlanke Raender (IOS-C3, 2026-10-04): auf Handys ist der Graph in der Mitte frei, die Bedienung liegt in
// schmalen Leisten oben und unten. Desktop bleibt wie er war (Baseline, +-1 px).
// Baseline nur bei gewollter Desktop-Aenderung neu schreiben: WIKI_BASELINE=1 npx playwright test tests/e2e/mobil-raender.spec.ts

let preview: Preview;
test.beforeAll(async () => { preview = await startPreview(); });
test.afterAll(() => { preview.stop(); });
const url = (path = "/") => `${preview.baseUrl}${path}`;
const skipIntro = () => { try { sessionStorage.setItem("nebula_intro_seen", "1"); } catch { /* ignore */ } };
const BASELINE = fileURLToPath(new URL("./mobil-raender.baseline.json", import.meta.url));
const PANELS = [".topbar", "#search-box", ".tour-btn", "#legend", "#about", ".control-panel"];
// Nur fuer die Handy-Pruefungen, nicht Teil der Desktop-Baseline
const EXTRA = [".site-links", ".topbar-right", "#search-input", "#legend-toggle", ".about-toggle", ".ctrl-legal"];
type Box = { l: number; t: number; r: number; b: number; w: number; h: number };

async function messen(browser: Browser, width: number, height: number, touch: boolean) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
  await ctx.addInitScript(skipIntro);
  const page = await ctx.newPage();
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(400);
  const m = await page.evaluate(([sel, mehr]) => {
    const box = (e: Element) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
    const boxes: Record<string, any> = {};
    for (const s of sel) { const e = document.querySelector(s); if (e) boxes[s] = box(e); }
    const extra: Record<string, any> = {};
    for (const s of mehr) { const e = document.querySelector(s); if (e) extra[s] = box(e); }
    const intro = document.querySelector(".graph-intro");
    return {
      vw: document.documentElement.clientWidth, vh: innerHeight, boxes, extra,
      inTopbar: document.documentElement.classList.contains("search-in-topbar"),
      intro: intro ? box(intro) : null,
      clip: getComputedStyle(document.querySelector("#label-layer")!).clipPath,
      coarse: matchMedia("(hover: none) and (pointer: coarse)").matches,
    };
  }, [PANELS, EXTRA]);
  const h1 = await page.getByRole("heading", { level: 1, name: "Wissen entdecken" }).count();
  return { ...m, h1, page, ctx };
}

/** inset(a b c d) mit 1 bis 4 Werten -> {top, right, bottom, left} in px */
function inset(clip: string) {
  const inner = /inset\(([^)]*)\)/.exec(clip)?.[1];
  if (!inner) return null;
  const v = inner.trim().split(/\s+/).filter((x) => /px$|^0$/.test(x)).map((x) => parseFloat(x));
  const [t, r = t, b = t, l = r] = v;
  return { top: t, right: r, bottom: b, left: l };
}

const schneidet = (a: Box, b: Box) => a.w > 0 && b.w > 0 && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

// Querformat mit Safari-Leisten (IOS-C5, 2026-10-05): mit Adress- und Tab-Leiste bleiben auf dem iPhone etwa 277 px Hoehe
const QUER_MIT_LEISTEN: [number, number][] = [[844, 277], [932, 317], [667, 262]];
const HANDYS: [number, number][] = [[360, 780], [375, 812], [390, 844], [430, 932], [844, 390], [932, 430], [667, 375], ...QUER_MIT_LEISTEN];
for (const [w, h] of HANDYS) {
  test(`Handy ${w}x${h}: Mitte frei, keine Ueberlappung, Einfuehrung unsichtbar, Beschriftung beschnitten`, async ({ browser }) => {
    const m = await messen(browser, w, h, true);
    expect(m.coarse).toBe(true);
    const B = m.boxes as Record<string, Box>;
    // 1. Mittelstreifen frei
    const band = { l: 0, t: Math.round(m.vh * 0.3), r: m.vw, b: Math.round(m.vh * 0.7), w: m.vw, h: 1 };
    for (const s of PANELS) expect(schneidet(B[s], band), `${s} im Mittelstreifen`).toBe(false);
    // 2. keine Ueberlappung, alles im Bild
    const X = m.extra as Record<string, Box>;
    expect(m.inTopbar, "Suche in der Kopfzeile nur im Querformat").toBe(w > h);
    if (m.inTopbar) {
      expect(schneidet(X["#search-input"], X[".site-links"]), "Suche x Seitenlinks").toBe(false);
      expect(schneidet(X["#search-input"], X[".topbar-right"]), "Suche x Datensatz-Wahl").toBe(false);
      expect(X["#search-input"].b).toBeLessThanOrEqual(B[".topbar"].b);
      expect(X["#search-input"].w).toBeGreaterThanOrEqual(140);
    } else {
      expect(B["#search-box"].t).toBeGreaterThanOrEqual(B[".topbar"].b - 1);
    }
    for (const [a, b] of [[".tour-btn", "#legend"], ["#legend", "#about"], [".tour-btn", "#about"]]) {
      expect(schneidet(B[a], B[b]), `${a} x ${b}`).toBe(false);
    }
    for (const s of PANELS) { expect(B[s].l).toBeGreaterThanOrEqual(0); expect(B[s].r).toBeLessThanOrEqual(m.vw + 1); }
    // 3. Einfuehrung unsichtbar, h1 erreichbar
    expect(m.intro!.w).toBeLessThanOrEqual(1);
    expect(m.intro!.h).toBeLessThanOrEqual(1);
    expect(m.h1).toBe(1);
    // 4. Beschriftungsebene auf den freien Bereich beschnitten
    const c = inset(m.clip);
    expect(c, `clip-path: ${m.clip}`).not.toBeNull();
    expect(c!.top).toBeGreaterThanOrEqual(B["#search-box"].b);
    const untenOberkante = Math.min(B[".tour-btn"].t, B["#legend"].t, B["#about"].t, B[".control-panel"].t);
    expect(m.vh - c!.bottom).toBeLessThanOrEqual(untenOberkante);
    await m.ctx.close();
  });
}

test("Handy 390x844: Legende aufklappen bleibt im Bild", async ({ browser }) => {
  const m = await messen(browser, 390, 844, true);
  await m.page.locator("#legend-toggle").tap();
  const body = m.page.locator("#legend-body");
  await expect(body).toBeVisible();
  const r = await body.boundingBox();
  expect(r!.x).toBeGreaterThanOrEqual(0);
  expect(r!.x + r!.width).toBeLessThanOrEqual(391);
  expect(r!.y).toBeGreaterThanOrEqual(0);
  await m.ctx.close();
});

for (const [w, h] of QUER_MIT_LEISTEN) {
  test(`Handy quer ${w}x${h} (Safari-Leisten): mehr als die Haelfte der Hoehe bleibt fuer den Graphen frei`, async ({ browser }) => {
    const m = await messen(browser, w, h, true);
    const B = m.boxes as Record<string, Box>;
    const X = m.extra as Record<string, Box>;
    const oben = Math.max(B[".topbar"].b, X["#search-input"].b);
    const unten = Math.min(B[".tour-btn"].t, X["#legend-toggle"].t, X[".about-toggle"].t, X[".ctrl-legal"].t);
    expect(unten - oben, `frei zwischen y=${oben} und y=${unten}`).toBeGreaterThanOrEqual(Math.round(m.vh * 0.58));
    await m.ctx.close();
  });

  test(`Handy quer ${w}x${h}: Erklaerung reicht von der Kopfzeile bis zum unteren Rand, die Suche liegt nicht darunter`, async ({ browser }) => {
    const m = await messen(browser, w, h, true);
    await m.page.locator("#search-input").fill("Regulierung");
    await m.page.locator("#search-results li").first().tap();
    const modal = m.page.locator("#modal.open");
    await expect(modal).toBeVisible();
    await m.page.waitForTimeout(500); // Einfahren dauert 0,3 s
    const r = (await modal.boundingBox())!;
    const topbar = (m.boxes as Record<string, Box>)[".topbar"];
    expect(r.y).toBeGreaterThanOrEqual(topbar.b - 1);
    expect(r.y + r.height).toBeGreaterThanOrEqual(m.vh - 1);
    expect(r.x + r.width).toBeLessThanOrEqual(m.vw + 1);
    expect(r.x).toBeGreaterThanOrEqual(m.vw * 0.4); // links bleibt der Graph sichtbar
    const s = (await m.page.locator("#search-input").boundingBox())!;
    const ueberlappt = s.x < r.x + r.width && r.x < s.x + s.width && s.y < r.y + r.height && r.y < s.y + s.height;
    expect(ueberlappt, "Suchfeld unter der Erklaerung").toBe(false);
    await m.ctx.close();
  });

  test(`Handy quer ${w}x${h}: Legende und "Ueber diese Seite" klappen unter der Kopfzeile auf und bleiben im Bild`, async ({ browser }) => {
    const m = await messen(browser, w, h, true);
    const topbar = (m.boxes as Record<string, Box>)[".topbar"];
    await m.page.locator("#legend-toggle").tap();
    const legende = (await m.page.locator("#legend-body").boundingBox())!;
    expect(legende.y).toBeGreaterThanOrEqual(topbar.b);
    expect(legende.y + legende.height).toBeLessThanOrEqual(m.vh);
    await m.page.locator("#legend-toggle").tap();
    await m.page.locator(".about-toggle").tap();
    const ueber = (await m.page.locator(".about-body").boundingBox())!;
    expect(ueber.y).toBeGreaterThanOrEqual(topbar.b);
    expect(ueber.y + ueber.height).toBeLessThanOrEqual(m.vh);
    await m.ctx.close();
  });
}

// Fokus-Zeile (IOS-C6): lag nach dem Antippen eines Punktes in jeder Groesse ueber "Rundgang starten"
for (const [w, h, touch] of [[844, 277, true], [844, 390, true], [390, 844, true], [375, 812, true], [1440, 900, false], [1024, 768, false], [800, 844, false]] as [number, number, boolean][]) {
  test(`Fokus-Zeile ${w}x${h}: liegt im Bild und ueber keinem Knopf oder Link`, async ({ browser }) => {
    const m = await messen(browser, w, h, touch);
    const r = await m.page.evaluate(() => {
      const zeile = document.getElementById("status-bar")!;
      zeile.textContent = "Fokus · Agentische Workflows orchestrieren · 29 Verbindungen";
      const box = (e: Element) => e.getBoundingClientRect();
      const s = box(zeile);
      const treffer: string[] = [];
      for (const sel of [".tour-btn", "#legend-toggle", ".about-toggle", ".ctrl-legal a", "#search-input", ".topbar"]) {
        for (const e of document.querySelectorAll(sel)) {
          const b = box(e);
          if (s.left < b.right && b.left < s.right && s.top < b.bottom && b.top < s.bottom) treffer.push(sel);
        }
      }
      return { l: s.left, r: s.right, t: s.top, b: s.bottom, w: s.width, treffer, vw: innerWidth, vh: innerHeight };
    });
    expect(r.w).toBeGreaterThan(40);
    expect(r.l).toBeGreaterThanOrEqual(0);
    expect(r.r).toBeLessThanOrEqual(r.vw + 1);
    expect(r.b).toBeLessThanOrEqual(r.vh);
    expect(r.treffer).toEqual([]);
    await m.ctx.close();
  });
}

// Kurzes Hochformat (Tastatur offen, Splitscreen): bleibt Hochformat-Layout, nicht der Querblock
for (const [w, h] of [[360, 480], [360, 340]] as [number, number][]) {
  test(`Handy ${w}x${h} (wenig Hoehe im Hochformat): Kopfzeile im Bild, Fussleiste ohne Ueberlappung`, async ({ browser }) => {
    const m = await messen(browser, w, h, true);
    const k = await m.page.evaluate(() => {
      const bar = document.querySelector(".topbar")!;
      return { rechts: Math.round(document.querySelector(".topbar-right")!.getBoundingClientRect().right), scroll: bar.scrollWidth, breite: bar.clientWidth };
    });
    expect(k.rechts).toBeLessThanOrEqual(m.vw + 1);
    expect(k.scroll).toBeLessThanOrEqual(k.breite + 1);
    const B = m.boxes as Record<string, Box>;
    for (const [a, b] of [[".tour-btn", "#legend"], ["#legend", "#about"], [".tour-btn", "#about"]]) {
      expect(schneidet(B[a], B[b]), `${a} x ${b}`).toBe(false);
    }
    await m.ctx.close();
  });
}

test("Handy 390x844: jeder Tab-Stopp ist sichtbar (auch in der versteckten Einfuehrung)", async ({ browser }) => {
  const m = await messen(browser, 390, 844, true);
  const unsichtbar = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await m.page.keyboard.press("Tab");
    const r = await m.page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      for (let e: Element | null = a; e && e !== document.body; e = e.parentElement) {
        const b = e.getBoundingClientRect();
        if (b.width <= 1 || b.height <= 1) return `${a.tagName}.${a.className} in ${e.tagName}.${e.className} ${Math.round(b.width)}x${Math.round(b.height)}`;
      }
      return null;
    });
    if (r) unsichtbar.add(r);
  }
  expect([...unsichtbar]).toEqual([]);
  await m.ctx.close();
});

// Legende und "Ueber" liegen in anderen Stapelkontexten unter der Fussleiste: deren Hintergrund darf sie nicht abdunkeln
for (const [w, h] of [[390, 844], [844, 390]] as [number, number][]) {
  test(`Handy ${w}x${h}: nichts mit Hintergrund liegt ueber Legende und "Ueber diese Seite"`, async ({ browser }) => {
    const m = await messen(browser, w, h, true);
    // elementsFromPoint ueberspringt pointer-events:none, die Fussleiste soll aber mitgezaehlt werden
    await m.page.addStyleTag({ content: ".control-panel { pointer-events: auto !important; }" });
    const befunde = await m.page.evaluate(() => {
      const out = new Set<string>();
      for (const sel of ["#legend-toggle", ".about-toggle"]) {
        const t = document.querySelector(sel)!;
        const r = t.getBoundingClientRect();
        const y = r.top + r.height / 2;
        for (const x of [r.left + 4, r.left + r.width / 2, r.right - 4]) {
          for (const e of document.elementsFromPoint(x, y)) {
            if (e === t || t.contains(e)) break;
            const s = getComputedStyle(e);
            const f = (s.backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
            if (s.backgroundImage !== "none" || (f.length === 4 ? f[3] > 0 : f.length === 3)) out.add(`${sel} unter ${e.tagName}.${e.className}`);
          }
        }
      }
      return [...out];
    });
    expect(befunde).toEqual([]);
    await m.ctx.close();
  });
}

const DESKTOPS: [number, number][] = [[1440, 900], [1024, 768], [800, 844]];
test("Desktop: Boxen wie vor der Aenderung, keine Beschneidung, Einfuehrung sichtbar", async ({ browser }) => {
  const jetzt: Record<string, any> = {};
  for (const [w, h] of DESKTOPS) {
    const m = await messen(browser, w, h, false);
    expect(m.coarse).toBe(false);
    expect(m.clip).toBe("none");
    expect(m.intro!.h).toBeGreaterThan(10);
    jetzt[`${w}x${h}`] = m.boxes;
    await m.ctx.close();
  }
  if (process.env.WIKI_BASELINE === "1") writeFileSync(BASELINE, JSON.stringify(jetzt, null, 2) + "\n");
  expect(existsSync(BASELINE), "Baseline fehlt: vor der Aenderung mit WIKI_BASELINE=1 schreiben").toBe(true);
  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  const diffs: string[] = [];
  for (const k of Object.keys(base)) for (const s of Object.keys(base[k])) for (const f of ["l", "t", "r", "b"]) {
    if (Math.abs(base[k][s][f] - jetzt[k][s][f]) > 1) diffs.push(`${k} ${s}.${f}: ${base[k][s][f]} -> ${jetzt[k][s][f]}`);
  }
  expect(diffs).toEqual([]);
});
