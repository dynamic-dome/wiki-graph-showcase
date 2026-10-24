import { test, expect, chromium, webkit, BrowserType } from "@playwright/test";
import { existsSync } from "fs";
import { startPreview, Preview } from "./helpers/preview";

// #10019: graph.json darf pro Seitenaufruf nur einmal geladen werden, in Chromium UND WebKit.
// Der fruehere <link rel=preload as=fetch crossorigin> erzeugte in WebKit 26.4 zwei Anfragen
// (xhr + fetch): WebKits CORS-Preload sendet einen Origin-Header, das fetch() derselben Herkunft nicht.

let preview: Preview;
test.beforeAll(async () => { preview = await startPreview(); });
test.afterAll(() => { preview.stop(); });

const engines: [string, BrowserType][] = [["chromium", chromium], ["webkit", webkit]];

for (const [name, engine] of engines) {
  test(`${name}: graph.json wird genau einmal geladen, ohne Preload-Warnung`, async () => {
    test.skip(!existsSync(engine.executablePath()), `${name} ist nicht installiert (npx playwright install ${name})`);
    const browser = await engine.launch();
    try {
      const page = await (await browser.newContext()).newPage();
      const requests: string[] = [];
      const warnings: string[] = [];
      page.on("request", (r) => { if (r.url().includes("/kompetenz/graph.json")) requests.push(r.resourceType()); });
      page.on("console", (m) => { if (/preload/i.test(m.text())) warnings.push(m.text()); });
      await page.goto(`${preview.baseUrl}/`, { waitUntil: "load" });
      await expect(page.locator("#graph-container canvas")).toBeVisible({ timeout: 20_000 });
      expect(requests).toHaveLength(1);
      expect(warnings).toEqual([]);
    } finally {
      await browser.close();
    }
  });
}
