import test from "node:test";
import assert from "node:assert/strict";
import { filterEntries, FALLBACK_TEXTS } from "../../src/scripts/fallback-list.js";

const entries = [
  { id: "wiki/topics/zeta", title: "Zeta Thema", category: "topic" },
  { id: "wiki/competences/mcp-server-bauen", title: "MCP-Server bauen", category: "competence" },
  { id: "wiki/concepts/alpha", title: "Äpfel und Alpha", category: "concept" },
  { id: "wiki/entities/ohne-titel" },
];

test("ohne Suchtext: alle Eintraege, nach Titel (de) sortiert, Eintrag ohne Titel nach Id", () => {
  const out = filterEntries(entries, "");
  assert.equal(out.length, 4);
  assert.equal(out[0].id, "wiki/concepts/alpha");
});

test("Filter trifft Titel und Id, ohne Beachtung der Gross-/Kleinschreibung", () => {
  assert.deepEqual(filterEntries(entries, "MCP").map((e) => e.id), ["wiki/competences/mcp-server-bauen"]);
  assert.deepEqual(filterEntries(entries, "ohne-titel").map((e) => e.id), ["wiki/entities/ohne-titel"]);
});

test("kein Treffer liefert leere Liste; Eingabe wird getrimmt", () => {
  assert.deepEqual(filterEntries(entries, "  xyz  "), []);
  assert.equal(filterEntries(entries, "  zeta ").length, 1);
});

test("undefined/null als Eintragsliste und Suchtext bricht nicht", () => {
  assert.deepEqual(filterEntries([], undefined), []);
});

test("Texte sind Rohfassung und als Funktion bzw. String vorhanden", () => {
  assert.equal(typeof FALLBACK_TEXTS.count(3), "string");
  assert.equal(typeof FALLBACK_TEXTS.none, "string");
  assert.equal(typeof FALLBACK_TEXTS.unavailable, "string");
});
