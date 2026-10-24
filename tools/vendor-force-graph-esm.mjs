// Baut src/vendor/3d-force-graph.esm.min.js neu (WEB-5, #9603).
//
// Warum: Das UMD-Bundle von 3d-force-graph bringt eine eigene THREE-Kopie mit. Neben der
// Vendor-THREE (src/vendor/three, per Import Map) gab es so zwei Instanzen
// ("Multiple instances of Three.js being imported", +~500 KB Download). Diese ESM-Variante
// importiert `three` extern und nutzt damit die Vendor-Instanz.
//
// Aufruf (Arbeitsordner ausserhalb des Repos, z. B. %TEMP%\fg-esm):
//   mkdir %TEMP%\fg-esm && cd %TEMP%\fg-esm && echo {"private":true} > package.json
//   npm install --ignore-scripts --before=2024-09-26T00:00:00Z 3d-force-graph@1.73.4 three@0.168.0
//   node <repo>/tools/vendor-force-graph-esm.mjs %TEMP%\fg-esm
//   copy %TEMP%\fg-esm\3d-force-graph.esm.min.js <repo>\src\vendor\
// Bei einem Versions-Update: three@ UND src/vendor/three gemeinsam heben (siehe CLAUDE.md), dann
// EXPECTED_THREE_REVISION in src/scripts/three-guard.js mitziehen.
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const work = path.resolve(process.argv[2] || ".");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esbuild = await import(pathToFileURL(path.join(repo, "node_modules/esbuild/lib/main.js")).href);
const pkg = JSON.parse(fs.readFileSync(path.join(work, "node_modules/3d-force-graph/package.json"), "utf8"));
const three = JSON.parse(fs.readFileSync(path.join(work, "node_modules/three/package.json"), "utf8"));
fs.writeFileSync(path.join(work, "entry.js"), 'export { default } from "3d-force-graph";\n');
await esbuild.build({
  absWorkingDir: work,
  entryPoints: ["entry.js"], bundle: true, format: "esm", minify: true, target: "es2020",
  outfile: "3d-force-graph.esm.min.js", legalComments: "none", logLevel: "info",
  banner: { js: `// 3d-force-graph ${pkg.version} (ESM, three extern; Vendor-THREE r${three.version.split(".")[1]} per Import Map) - tools/vendor-force-graph-esm.mjs` },
  // Nur das nackte "three" bleibt extern; three/examples/jsm/* werden eingebettet.
  plugins: [{ name: "three-exact-external", setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: "three", external: true })); } }],
});
