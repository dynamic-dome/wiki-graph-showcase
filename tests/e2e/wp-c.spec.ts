import { test, expect, Page } from "@playwright/test";
import { startPreview, Preview } from "./helpers/preview";

let preview: Preview;
test.beforeAll(async () => { preview = await startPreview(); });
test.afterAll(() => { preview.stop(); });

const url = (path = "/") => `${preview.baseUrl}${path}`;
const DEEP_NODE = "wiki/competences/agentic-workflows-orchestrieren";

/** Sammelt Seitenfehler und CSP-Verstoesse (die lokale Vorschau spielt die CSP aus). */
function trackProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    const text = m.text();
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(text)) problems.push(`csp: ${text}`);
  });
  return problems;
}

/** Intro-Overlay ueberspringen, damit die Kamera schnell ruht. */
const skipIntro = () => { try { sessionStorage.setItem("nebula_intro_seen", "1"); } catch { /* ignore */ } };

async function delayForceGraph(page: Page, ms: number) {
  await page.route("**/assets/vendor/3d-force-graph.min.js", async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test.describe("C1: Bibliothek nach dem ersten Paint", () => {
  test("Einleitung steht vor der 3D-Bibliothek, Graph erscheint danach", async ({ page }) => {
    const problems = trackProblems(page);
    await delayForceGraph(page, 1500);
    await page.goto(url("/?dataset=kompetenz"), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".graph-intro h1")).toBeVisible();
    expect(await page.evaluate(() => typeof (window as any).ForceGraph3D)).toBe("undefined");
    await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 20_000 });
    expect(problems).toEqual([]);
  });

  test("Deep-Link bei verzoegerter Bibliothek oeffnet das Modal", async ({ page }) => {
    await delayForceGraph(page, 1500);
    await page.goto(url(`/?dataset=kompetenz&node=${encodeURIComponent(DEEP_NODE)}`), { waitUntil: "domcontentloaded" });
    await expect(page.locator("#modal")).toHaveClass(/open/, { timeout: 20_000 });
    await expect(page.locator("#modal-title")).not.toBeEmpty();
  });

  test("Suche vor Bibliothek: vorab getippter Text liefert nach dem Laden Treffer", async ({ page }) => {
    await delayForceGraph(page, 2500);
    await page.goto(url("/?dataset=kompetenz"), { waitUntil: "domcontentloaded" });
    await page.locator("#search-input").fill("mcp");
    await expect(page.locator("#search-results .search-result").first()).toBeVisible({ timeout: 20_000 });
  });
});

/** WebGL fuer diesen Kontext abschalten (deterministisch, unabhaengig von Chromium-Flags). */
async function withoutWebGL(page: Page) {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (type: string, ...rest: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return (orig as any).call(this, type, ...rest);
    };
  });
}

test.describe("C2: Liste statt Stacktrace", () => {
  test("ohne WebGL erscheint die Liste, Filter und Modal funktionieren, kein Stacktrace", async ({ page }) => {
    const problems = trackProblems(page);
    await withoutWebGL(page);
    await page.goto(url("/?dataset=kompetenz"));
    await expect(page.locator("#webgl-fallback")).toBeVisible();
    const all = await page.locator("#fallback-list button").count();
    expect(all).toBeGreaterThan(100);
    await expect(page.locator("body pre")).toHaveCount(0);
    await expect(page.locator("#graph-container canvas")).toHaveCount(0);

    await page.locator("#fallback-filter").fill("mcp");
    const filtered = await page.locator("#fallback-list button").count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);

    await page.locator("#fallback-list button").first().click();
    await expect(page.locator("#modal")).toHaveClass(/open/);
    await expect(page.locator("#modal-title")).not.toBeEmpty();
    expect(problems).toEqual([]);
  });

  test("Bibliothek nicht ladbar: Liste statt Stacktrace, console.error bleibt", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.route("**/assets/vendor/3d-force-graph.min.js", (route) => route.abort());
    await page.goto(url("/?dataset=kompetenz"));
    await expect(page.locator("#webgl-fallback")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#fallback-list button").first()).toBeVisible();
    await expect(page.locator("body pre")).toHaveCount(0);
    expect(errors.some((t) => t.includes("Init failed"))).toBe(true);
  });

  test("Index fehlt: ruhige Meldung statt Fehler", async ({ page }) => {
    const problems = trackProblems(page);
    await withoutWebGL(page);
    await page.route("**/assets/kompetenz/index.json", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto(url("/?dataset=kompetenz"));
    await expect(page.locator("#fallback-status")).not.toBeEmpty();
    await expect(page.locator("#fallback-list button")).toHaveCount(0);
    await expect(page.locator("body pre")).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("Datensatzwechsel funktioniert auch ohne WebGL", async ({ page }) => {
    await withoutWebGL(page);
    await page.goto(url("/?dataset=kompetenz"));
    await expect(page.locator("#fallback-list button").first()).toBeVisible();
    const kompetenz = await page.locator("#fallback-list button").count();
    await page.locator("#dataset-astro").click();
    await expect(page).toHaveURL(/dataset=astro/);
    await expect(page.locator("#fallback-list button").first()).toBeVisible();
    const astro = await page.locator("#fallback-list button").count();
    expect(astro).toBeGreaterThan(10);
    expect(astro).toBeLessThan(kompetenz);
  });
});
