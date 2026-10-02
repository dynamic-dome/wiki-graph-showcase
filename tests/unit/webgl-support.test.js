import test from "node:test";
import assert from "node:assert/strict";
import { hasWebGL } from "../../src/scripts/webgl-support.js";

const docWith = (getContext) => ({ createElement: () => ({ getContext }) });

test("true, wenn webgl2 verfuegbar", () => {
  assert.equal(hasWebGL(docWith((t) => (t === "webgl2" ? { getExtension: () => null } : null))), true);
});

test("true, wenn nur webgl verfuegbar", () => {
  assert.equal(hasWebGL(docWith((t) => (t === "webgl" ? { getExtension: () => null } : null))), true);
});

test("false, wenn kein Kontext erzeugt wird", () => {
  assert.equal(hasWebGL(docWith(() => null)), false);
});

test("false, wenn getContext wirft", () => {
  assert.equal(hasWebGL(docWith(() => { throw new Error("blocked"); })), false);
});

test("gibt den Test-Kontext wieder frei", () => {
  let lost = false;
  const ctx = { getExtension: (name) => (name === "WEBGL_lose_context" ? { loseContext() { lost = true; } } : null) };
  assert.equal(hasWebGL(docWith(() => ctx)), true);
  assert.equal(lost, true);
});
