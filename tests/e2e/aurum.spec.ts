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
