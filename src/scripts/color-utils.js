/** Shared rgba string helpers (gold-pulse, node-forms). */

export function parseRgba(s) {
  const m = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

export function mixRgba(a, b, t) {
  const ra = parseRgba(a);
  const rb = parseRgba(b);
  if (!ra || !rb) return a;
  const r = Math.round(ra[0] * (1 - t) + rb[0] * t);
  const g = Math.round(ra[1] * (1 - t) + rb[1] * t);
  const bl = Math.round(ra[2] * (1 - t) + rb[2] * t);
  const al = (ra[3] * (1 - t) + rb[3] * t).toFixed(3);
  return `rgba(${r},${g},${bl},${al})`;
}

/** Multiply the alpha of an rgba()/rgb() string by factor (0..1). */
export function dimRgba(c, factor) {
  if (factor >= 1) return c;
  const p = parseRgba(c);
  if (!p) return c;
  return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] * factor).toFixed(3)})`;
}
