/**
 * Frueher Start des Standard-Graphen (#10019). Ersetzt den frueheren
 * <link rel="preload" as="fetch" crossorigin>: WebKit (Safari, iOS) nutzt diesen
 * Preload nicht fuer fetch() weiter, weil der CORS-Preload einen Origin-Header
 * sendet, das fetch() derselben Herkunft nicht, und beide Anfragen im Cache
 * nicht zusammenpassen. Ergebnis waren zwei Downloads. Chromium braucht dagegen
 * `crossorigin`, ohne das Attribut passt der Anmeldedaten-Modus nicht (Preload
 * verworfen). Beide Engines gleichzeitig bedient nur ein gemeinsames Promise:
 * dieses Modul startet den fetch(), graph-loader.js uebernimmt dieselbe Antwort.
 *
 * Als Modul (deferred, in Dokumentreihenfolge VOR main.js) startet es, sobald das
 * HTML geparst ist, und damit vor dem Ende von main.js' Importbaum (685 KB).
 * Keine Imports, damit nichts darauf warten muss. Der Pfad spiegelt
 * DATASETS[DEFAULT_DATASET].base aus graph-loader.js (Waechter: tests/unit/early-graph.test.js).
 */
export const EARLY_GRAPH_URL = "assets/kompetenz/graph.json";
export const EARLY_GRAPH_KEY = "__earlyGraph";

export function startEarlyGraph(scope = globalThis) {
  if (typeof scope.fetch !== "function") return;
  // Fehler schlucken: loadGraph holt sonst selbst nach und meldet den Status.
  scope[EARLY_GRAPH_KEY] = { url: EARLY_GRAPH_URL, promise: scope.fetch(EARLY_GRAPH_URL).catch(() => null) };
}

// Nur im Browser selbst starten, nicht beim Import in Node-Tests.
if (typeof document !== "undefined") startEarlyGraph();
