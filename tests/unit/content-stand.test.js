import test from "node:test";
import assert from "node:assert/strict";
import { formatMonth, formatBuildDate, formatStand } from "../../src/scripts/content-stand.js";

test("Monat auf Deutsch, mit Umlaut im März", () => {
  assert.equal(formatMonth("2026-05"), "Mai 2026");
  assert.equal(formatMonth("2026-03"), "März 2026");
  assert.equal(formatMonth("2026-12"), "Dezember 2026");
});

test("ungültiger Monat ergibt null", () => {
  for (const bad of [undefined, null, "", "2026-13", "2026-00", "Mai", "2026-5"]) {
    assert.equal(formatMonth(bad), null, String(bad));
  }
});

test("Build-Datum als TT.MM.JJJJ aus dem ISO-Zeitstempel", () => {
  assert.equal(formatBuildDate("2026-10-25T01:16:21.892035+00:00"), "25.10.2026");
  assert.equal(formatBuildDate("kaputt"), null);
});

test("Stand-Satz mit Monat und Build-Datum", () => {
  assert.equal(
    formatStand({ content_median_month: "2026-05" }, "2026-10-25T01:16:21+00:00"),
    "Inhaltsstand: Mai 2026 (mittleres Seitendatum), gebaut am 25.10.2026.",
  );
});

test("ohne Build-Datum endet der Satz nach der Klammer", () => {
  assert.equal(
    formatStand({ content_median_month: "2026-05" }, undefined),
    "Inhaltsstand: Mai 2026 (mittleres Seitendatum).",
  );
});

test("ohne Median-Monat (Datensatz ohne updated) bleibt die Zeile weg", () => {
  assert.equal(formatStand({ title: "x" }, "2026-10-25T00:00:00Z"), null);
  assert.equal(formatStand(undefined, "2026-10-25T00:00:00Z"), null);
});
