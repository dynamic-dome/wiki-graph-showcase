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

test("kompetenz dataset renders a graph", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(url("/?dataset=kompetenz&theme=dome&gold=100"));
  await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 15_000 });

  // Brand name reflects the kompetenz dataset metadata title
  await expect(page.locator("#brand-name")).toHaveText(/Kompetenz-Wiki/);
  const meta = await page.locator("#meta-readout").innerText();
  expect(meta).toMatch(/\d+ Knoten/);

  expect(errors).toEqual([]);
});

test("existing astrophysics URL stays compatible", async ({ page }) => {
  await page.goto(url("/?theme=dome&gold=100&node=wiki%2Fconcepts%2Fallgemeine-relativitaetstheorie"));
  await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 15_000 });
  // No ?dataset means astro: brand keeps the astro metadata title.
  await expect(page.locator("#brand-name")).toHaveText(/Knowledge Nebula/);
});

test("dataset switcher navigates to kompetenz and updates URL", async ({ page }) => {
  await page.goto(url("/"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });

  await expect(page.locator("#dataset-astro")).toHaveClass(/active/);
  await page.locator("#dataset-kompetenz").click();

  await expect(page).toHaveURL(/dataset=kompetenz/);
  await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#dataset-kompetenz")).toHaveClass(/active/);
});

test("kompetenz detail modal shows a node title and category badge", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  // The default-center node opens the modal on load.
  await expect(page.locator("#modal")).toHaveClass(/open/, { timeout: 10_000 });
  await expect(page.locator("#modal-title")).not.toBeEmpty();
  // default center is a competence -> category badge present
  await expect(page.locator("#modal-badges .badge-cat")).toBeVisible();
});

test("search selects a node from the kompetenz index", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });

  const input = page.locator("#search-input");
  await input.click();
  await input.fill("mcp");
  const firstResult = page.locator("#search-results .search-result").first();
  await expect(firstResult).toBeVisible({ timeout: 5_000 });
  const targetId = await firstResult.getAttribute("data-node-id");
  await firstResult.click();

  // Selecting recenters -> node id ends up in the URL.
  if (targetId) {
    await expect(page).toHaveURL(new RegExp(`node=${encodeURIComponent(targetId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
  await expect(page.locator("#modal")).toHaveClass(/open/);
});

test("kompetenz links carry relation types", async ({ page }) => {
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  const stats = await page.evaluate(async () => {
    const resp = await fetch("/assets/kompetenz/graph.json");
    const g = await resp.json();
    const types = new Set(g.links.map((l: any) => l.type));
    return { nodeCount: g.nodes.length, types: [...types] };
  });
  expect(stats.nodeCount).toBeGreaterThan(100);
  expect(stats.types).toEqual(expect.arrayContaining(["supports", "depends_on", "applies_to", "related"]));
});

test("mobile viewport keeps search and switcher usable", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  await page.goto(url("/?dataset=kompetenz"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  // Search box stays inside the viewport (no horizontal overflow).
  const box = await page.locator("#search-box").boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
  }
  await expect(page.locator("#dataset-kompetenz")).toBeVisible();
  await ctx.close();
});
