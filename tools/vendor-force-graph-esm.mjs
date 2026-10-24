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
//   copy %TEMP%\fg-esm\THIRD_PARTY_NOTICES.txt <repo>\src\vendor\
// esbuild ist devDependency des Repos (in package.json gepinnt); der Build nutzt <repo>/node_modules.
//
// Lizenzen (#9950): Das Bundle enthaelt MIT-, ISC- und BSD-3-Clause-Pakete. esbuild schreibt deren
// LICENSE-Dateien nicht von selbst ins Bundle. Darum erzeugt dieses Skript aus dem esbuild-Metafile
// (= tatsaechlich eingebettete Module) die Datei THIRD_PARTY_NOTICES.txt mit Paketname, Version,
// Lizenz-ID, Herkunft und vollem Lizenztext je Paket. `legalComments: "eof"` behaelt zusaetzlich
// alle @license-/@preserve-Kommentare der Quellen am Dateiende; die Banner-Zeile verweist auf die Datei.
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
const result = await esbuild.build({
  absWorkingDir: work,
  entryPoints: ["entry.js"], bundle: true, format: "esm", minify: true, target: "es2020",
  outfile: "3d-force-graph.esm.min.js", legalComments: "eof", metafile: true, logLevel: "info",
  banner: { js: `// 3d-force-graph ${pkg.version} (ESM, three extern; Vendor-THREE r${three.version.split(".")[1]} per Import Map) - tools/vendor-force-graph-esm.mjs - Lizenzen: THIRD_PARTY_NOTICES.txt` },
  // Nur das nackte "three" bleibt extern; three/examples/jsm/* werden eingebettet.
  plugins: [{ name: "three-exact-external", setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: "three", external: true })); } }],
});

// --- THIRD_PARTY_NOTICES.txt aus dem Metafile ----------------------------------------------
// Paket-Wurzel je eingebettetem Modul: node_modules/<name> bzw. node_modules/@scope/<name>.
const roots = new Set();
const foreign = [];
for (const input of Object.keys(result.metafile.inputs)) {
  const m = input.match(/^(node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (m) roots.add(m[1]);
  else if (input !== "entry.js") foreign.push(input);
}
if (foreign.length) throw new Error("Eingebettete Dateien ausserhalb von node_modules: " + foreign.join(", "));

function licenseText(dir) {
  const name = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!name) throw new Error("Keine LICENSE-Datei in " + dir);
  return fs.readFileSync(path.join(dir, name), "utf8").replace(/\r\n/g, "\n").trim();
}
function repoUrl(p) {
  const r = typeof p.repository === "string" ? p.repository : p.repository && p.repository.url;
  return (r || p.homepage || "").replace(/^git\+/, "").replace(/\.git$/, "");
}

const packages = [...roots].map((dir) => {
  const p = JSON.parse(fs.readFileSync(path.join(work, dir, "package.json"), "utf8"));
  return { name: p.name, version: p.version, license: p.license, url: repoUrl(p), text: licenseText(path.join(work, dir)) };
}).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

const bar = "=".repeat(78);
const parts = [
  "Third-Party-Lizenzen von 3d-force-graph.esm.min.js",
  "",
  `Das Bundle 3d-force-graph.esm.min.js enthaelt die folgenden ${packages.length} Pakete (gebaut aus 3d-force-graph ${pkg.version}).`,
  'Von "three" sind nur Module aus three/examples/jsm eingebettet (Controls, Postprocessing); der Kern',
  "kommt extern per Import Map aus src/vendor/three.",
  "Erzeugt mit tools/vendor-force-graph-esm.mjs aus dem esbuild-Metafile.",
  "",
  ...packages.map((p) => `- ${p.name} ${p.version} (${p.license})`),
];
for (const p of packages) {
  parts.push("", bar, `${p.name} ${p.version}`, `Lizenz: ${p.license}`, ...(p.url ? [`Herkunft: ${p.url}`] : []), bar, "", p.text);
}
fs.writeFileSync(path.join(work, "THIRD_PARTY_NOTICES.txt"), parts.join("\n") + "\n");
console.log(`THIRD_PARTY_NOTICES.txt: ${packages.length} Pakete`);
