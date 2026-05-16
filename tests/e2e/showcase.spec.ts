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
      if (res.ok || res.status === 404) return; // 404 is fine, server is up
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs} ms (last error: ${String(lastErr)})`);
}

test.beforeAll(async () => {
  if (!IS_LOCAL) {
    // IS_LOCAL false implies ENV_BASE_URL is set and points to a remote host
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

test("loads the showcase page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(url("/"));
  await expect(page).toHaveTitle(/Knowledge Nebula/);

  // Wait for at least one node to be rendered (3d-force-graph injects a canvas)
  await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 15_000 });

  // Should display the node count from graph.json
  const meta = await page.locator("#meta-readout").innerText();
  expect(meta).toMatch(/\d+ Knoten/);

  expect(errors).toEqual([]);
});

test("slider value updates the readout and URL", async ({ page }) => {
  await page.goto(url("/"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });

  const slider = page.locator("#gold-slider");
  await slider.fill("80");
  // Use input event by setting value then dispatching
  await slider.evaluate((el: HTMLInputElement) => {
    el.value = "80";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await expect(page.locator("#gold-value")).toHaveText(/80%/);
  await expect(page).toHaveURL(/gold=80/);
});

test("theme toggle switches data-theme attribute", async ({ page }) => {
  await page.goto(url("/"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });

  const before = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await page.locator("#theme-toggle").click();
  const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(after).not.toBe(before);
  expect(["crab", "dome"]).toContain(after);
});

test("prefers-reduced-motion disables CMB layer at high gold", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(url("/?gold=85"));
  await page.locator("#graph-container canvas").waitFor({ state: "visible", timeout: 15_000 });
  // Wait a tick for app init
  await page.waitForTimeout(500);
  const cmbActive = await page.evaluate(
    () => document.getElementById("cmb-layer")?.classList.contains("active") ?? false,
  );
  expect(cmbActive).toBe(false);
  await ctx.close();
});
