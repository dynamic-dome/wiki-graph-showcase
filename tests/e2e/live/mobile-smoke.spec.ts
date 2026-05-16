// Mobile smoke: iPhone-12 viewport + 4G throttling against live URL.
// Plan Step 1 acceptance: page loads < 4 s on 4G, canvas renders, no pageerror.
// Uses chromium directly (CDP throttling is chromium-only).
import { test, expect, chromium, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://wiki-graph-showcase.pages.dev";

// Slow-4G-ish: 4 Mbit/s down, 1 Mbit/s up, 200 ms RTT
const NETWORK_4G = {
  downloadThroughput: (4 * 1024 * 1024) / 8,
  uploadThroughput: (1 * 1024 * 1024) / 8,
  latency: 200,
};

test("MOBILE: live URL loads < 4 s on throttled 4G (iPhone 12)", async () => {
  const iPhone12 = devices["iPhone 12"];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: iPhone12.viewport,
    userAgent: iPhone12.userAgent,
    deviceScaleFactor: iPhone12.deviceScaleFactor,
    hasTouch: iPhone12.hasTouch,
    isMobile: iPhone12.isMobile,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // Apply network throttling via CDP
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    ...NETWORK_4G,
  });

  const start = Date.now();
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Knowledge Nebula/);
  const elapsed = Date.now() - start;

  console.log(`[mobile-smoke] DOMContentLoaded in ${elapsed} ms`);
  expect(elapsed).toBeLessThan(4000);

  // Canvas must render within reasonable time after DOM-ready
  await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 20_000 });

  // Meta readout shows node count
  const meta = await page.locator("#meta-readout").innerText();
  expect(meta).toMatch(/\d+ Knoten/);

  expect(errors).toEqual([]);

  await context.close();
  await browser.close();
});
