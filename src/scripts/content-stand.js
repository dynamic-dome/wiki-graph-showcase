/**
 * Inhaltsstand für das Über-Panel (K6, #10035): Median-Monat der Seitendaten plus Build-Datum.
 * Beide Werte kommen aus graph.json (metadata.content_median_month, built_at); kein weiterer Abruf.
 */
const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** "2026-05" -> "Mai 2026"; ungültige Eingabe -> null. */
export function formatMonth(iso) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const name = MONATE[Number(m[2]) - 1];
  return name ? `${name} ${m[1]}` : null;
}

/** "2026-10-25T01:16:21+00:00" -> "25.10.2026" (UTC-Datum des Builds); ungültig -> null. */
export function formatBuildDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

/** Satz für das Über-Panel oder null, wenn der Datensatz keinen Median-Monat trägt. */
export function formatStand(metadata, builtAt) {
  const month = formatMonth(metadata && metadata.content_median_month);
  if (!month) return null;
  const built = formatBuildDate(builtAt);
  return `Inhaltsstand: ${month} (mittleres Seitendatum)` +
    (built ? `, gebaut am ${built}.` : ".");
}
