import test from "node:test";
import assert from "node:assert/strict";
import { fits } from "../../src/scripts/footer-fit.js";

test("390 px breit: Legende endet bei 228, Ueber beginnt bei 261, passt", () => {
  assert.equal(fits(228, 261), true);
});

test("360 px breit: 3 px Abstand sind zu wenig, das Etikett wird gekuerzt", () => {
  assert.equal(fits(228, 231), false);
});

test("genau der Mindestabstand von 6 px passt noch", () => {
  assert.equal(fits(228, 234), true);
});

test("ueberlappende Knoepfe passen nicht", () => {
  assert.equal(fits(228, 191), false);
});
