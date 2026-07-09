import { test, expect } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import { createServer } from "net";

const ENV_BASE_URL = process.env.BASE_URL;
const IS_LOCAL =
  !ENV_BASE_URL ||
  ENV_BASE_URL.startsWith("http://127.0.0.1") ||
  ENV_BASE_URL.startsWith("http://localhost");

let server: ChildProcess | undefined;
let resolvedBaseUrl: string;

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("net.createServer did not return AddressInfo"));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status === 404) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs} ms (last error: ${String(lastErr)})`);
}

test.beforeAll(async () => {
  if (!IS_LOCAL) {
    if (!ENV_BASE_URL) throw new Error("unreachable: IS_LOCAL=false implies ENV_BASE_URL set");
    resolvedBaseUrl = ENV_BASE_URL;
    return;
  }
  const port = await findFreePort();
  resolvedBaseUrl = `http://127.0.0.1:${port}`;
  server = spawn("python", ["-m", "http.server", "--directory", "dist", String(port)], {
    stdio: "ignore",
  });
  await waitForServer(`${resolvedBaseUrl}/`);
});

test.afterAll(() => {
  server?.kill("SIGTERM");
});

function url(path = "/"): string {
  return `${resolvedBaseUrl}${path}`;
}

test("spotlight dims links outside the hovered neighbourhood", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(async () => {
    const stage = (window as any).__nebula.stage;
    const resp = await fetch("/assets/kompetenz/graph.json");
    const g = await resp.json();
    const nodeA: string = g.nodes[0].id;
    const nearLink = g.links.find((l: any) => l.source === nodeA || l.target === nodeA);
    const farLink = g.links.find((l: any) => l.source !== nodeA && l.target !== nodeA);
    stage.setSpotlight(nodeA);
    const dimNear = nearLink ? stage.getLinkDim(nearLink) : 1;
    const dimFar = stage.getLinkDim(farLink);
    stage.setSpotlight(null);
    const dimAfter = stage.getLinkDim(farLink);
    return { dimNear, dimFar, dimAfter };
  });
  expect(res.dimNear).toBe(1);
  expect(res.dimFar).toBeLessThan(0.5);
  expect(res.dimAfter).toBeGreaterThan(res.dimFar); // Spotlight aus → kein Hover-Dimming mehr
});

test("edge-flow particles are denser on centre-adjacent links", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz&gold=60"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(async () => {
    const { stage, edgeFlow } = (window as any).__nebula;
    const resp = await fetch("/assets/kompetenz/graph.json");
    const g = await resp.json();
    const center: string = stage.getCenterId();
    const centerLink = g.links.find((l: any) => l.source === center || l.target === center);
    const farLink = g.links.find((l: any) => l.source !== center && l.target !== center);
    return {
      centerCount: centerLink ? edgeFlow.particleCountFor(centerLink) : -1,
      farCount: edgeFlow.particleCountFor(farLink),
    };
  });
  expect(res.farCount).toBeGreaterThanOrEqual(1);
  expect(res.centerCount).toBeGreaterThan(res.farCount);
});

test("3D scene dressing is active and the 2D sparkles layer is gone", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const active = await page.evaluate(() => (window as any).__nebula.dressing.isActive());
  expect(active).toBe(true);
  await expect(page.locator("#sparkles-layer")).toHaveCount(0);
});

test("reduced motion still renders the graph with dressing", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("bloom is active at default gold and off at gold 0", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz&gold=35"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(() => {
    const { bloom } = (window as any).__nebula;
    const atDefault = bloom.isActive();
    bloom.setGold(0);
    const atZero = bloom.isActive();
    bloom.setGold(0.35);
    return { atDefault, atZero };
  });
  expect(res.atDefault).toBe(true);
  expect(res.atZero).toBe(false);
});

test("kompetenz nodes render as category geometries", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const res = await page.evaluate(() => {
    const { forms, stage } = (window as any).__nebula;
    if (!forms) return null;
    const fg = stage.getGraphForceInstance();
    // Custom-Objekte hängen als Kind-Meshes an den Node-Objekten der Szene.
    let meshCount = 0;
    fg.scene().traverse((o: any) => { if (o.isMesh && o.userData?.aurumForm) meshCount++; });
    return { meshCount };
  });
  expect(res).not.toBeNull();
  expect(res!.meshCount).toBeGreaterThan(50);
});

test("astro keeps default spheres (no custom forms)", async ({ page }) => {
  await page.goto(url("/?dataset=astro"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const hasForms = await page.evaluate(() => Boolean((window as any).__nebula.forms));
  expect(hasForms).toBe(false);
});
