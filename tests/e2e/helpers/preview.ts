import { spawn, ChildProcess } from "child_process";
import { createServer } from "net";

export interface Preview {
  baseUrl: string;
  stop: () => void;
}

async function freePort(): Promise<number> {
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
        reject(new Error("keine Port-Adresse"));
      }
    });
  });
}

/**
 * Startet die Vorschau MIT _headers (CSP) oder nutzt BASE_URL, wenn sie auf
 * etwas anderes als 127.0.0.1/localhost zeigt (Live-Lauf).
 */
export async function startPreview(): Promise<Preview> {
  const env = process.env.BASE_URL;
  if (env && !env.startsWith("http://127.0.0.1") && !env.startsWith("http://localhost")) {
    return { baseUrl: env.replace(/\/$/, ""), stop: () => {} };
  }
  const port = await freePort();
  const proc: ChildProcess = spawn(
    "python",
    ["-m", "tools.preview_server", "--dist", "dist", "--port", String(port)],
    { stdio: "ignore" },
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/`, { method: "HEAD" });
      if (res.ok) break;
    } catch {
      /* Server startet noch */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { baseUrl, stop: () => { proc.kill(); } };
}
