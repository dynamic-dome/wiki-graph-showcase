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
