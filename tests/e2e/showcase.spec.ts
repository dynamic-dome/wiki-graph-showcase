import { test, expect } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import { setTimeout as wait } from "timers/promises";

let server: ChildProcess;

test.beforeAll(async () => {
  // Serve dist/ on :8000
  server = spawn("python", ["-m", "http.server", "--directory", "dist", "8000"], {
    stdio: "ignore",
  });
  // Give the server a moment to bind
  await wait(800);
});

test.afterAll(() => {
  server.kill("SIGTERM");
});

test("loads the showcase page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("http://127.0.0.1:8000/");
  await expect(page).toHaveTitle(/Knowledge Nebula/);

  // Wait for at least one node to be rendered (3d-force-graph injects a canvas)
  await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 10_000 });

  // Should display the node count from graph.json
  const meta = await page.locator("#meta-readout").innerText();
  expect(meta).toMatch(/\d+ Knoten/);

  expect(errors).toEqual([]);
});

test("slider value updates the readout and URL", async ({ page }) => {
  await page.goto("http://127.0.0.1:8000/");
  await page.locator("#graph-container canvas").waitFor({ state: "visible" });

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
  await page.goto("http://127.0.0.1:8000/");
  await page.locator("#graph-container canvas").waitFor({ state: "visible" });

  const before = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await page.locator("#theme-toggle").click();
  const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(after).not.toBe(before);
  expect(["crab", "dome"]).toContain(after);
});

test("prefers-reduced-motion disables CMB layer at high gold", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8000/?gold=85");
  await page.locator("#graph-container canvas").waitFor({ state: "visible" });
  // Wait a tick for app init
  await page.waitForTimeout(500);
  const cmbActive = await page.evaluate(
    () => document.getElementById("cmb-layer")?.classList.contains("active") ?? false,
  );
  expect(cmbActive).toBe(false);
  await ctx.close();
});
