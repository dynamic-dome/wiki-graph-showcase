import test from "node:test";
import assert from "node:assert/strict";
import { searchSlot } from "../../src/scripts/topbar-search.js";

test("Luecke bei 844 px Breite: Suchfeld passt zwischen Seitenlinks und Datensatz-Wahl", () => {
  assert.deepEqual(searchSlot(243, 523), { left: 255, width: 256, fits: true });
});

test("mit seitlichen Sicherheitsabstaenden (Notch) wird die Luecke schmaler, passt aber noch", () => {
  const slot = searchSlot(274, 492);
  assert.equal(slot.fits, true);
  assert.equal(slot.left + slot.width, 480);
});

test("zu schmale Luecke: Suche bleibt unter der Kopfzeile", () => {
  assert.equal(searchSlot(243, 400).fits, false);
});

test("halbe Pixel: links aufrunden, Breite abrunden, nichts ragt in die Nachbarn", () => {
  const slot = searchSlot(243.4, 523.6);
  assert.equal(slot.left, 256);
  assert.ok(slot.left + slot.width <= 523.6 - 12);
});
