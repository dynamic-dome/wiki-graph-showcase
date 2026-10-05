/**
 * Handy, Fussleiste (2026-10-05): "Legende" und "Ueber diese Seite" liegen in anderen Stapelkontexten als die
 * Fussleiste und haengen deshalb nicht im selben Flex-Fluss wie "Rundgang starten". Mit festen Positionen
 * ueberlappten die drei Knoepfe unter 360 px Breite, waehrend des Rundgangs ("Rundgang anhalten" ist breiter)
 * und mit vergroesserter Schrift.
 * Dieses Modul misst nur: --tour-r ist die rechte Kante des Rundgang-Knopfs, .fuss-kurz kuerzt "Ueber diese Seite"
 * auf "Ueber", .fuss-zwei (nur Hochformat) rueckt Legende und "Ueber" eine Zeile hoeher, wenn auch das nicht reicht.
 * Das Layout selbst steht in styles/overview.css.
 */
import { QUER } from "./topbar-search.js";

export const HANDY = "(max-width: 760px), (max-height: 500px) and (hover: none) and (pointer: coarse)";
const LUECKE = 6;

/** Passen Legende (rechte Kante) und "Ueber" (linke Kante) mit Abstand nebeneinander? */
export function fits(legendRight, aboutLeft) {
  return legendRight + LUECKE <= aboutLeft;
}

export function createFooterFit(root = document.documentElement) {
  const tour = document.getElementById("tour-btn");
  const legend = document.getElementById("legend-toggle");
  const about = document.querySelector(".about-toggle");
  if (!tour || !legend || !about || !window.matchMedia) return;
  const handy = window.matchMedia(HANDY);
  const quer = window.matchMedia(QUER);
  const passt = () => fits(legend.getBoundingClientRect().right, about.getBoundingClientRect().left);
  const measure = () => {
    root.classList.remove("fuss-kurz", "fuss-zwei");
    if (!handy.matches) return;
    root.style.setProperty("--tour-r", `${Math.ceil(tour.getBoundingClientRect().right)}px`);
    if (passt()) return;
    root.classList.add("fuss-kurz");
    if (passt() || quer.matches) return;
    root.classList.add("fuss-zwei");
  };
  measure();
  handy.addEventListener("change", measure);
  quer.addEventListener("change", measure);
  window.addEventListener("resize", measure);
  // Der Rundgang-Knopf wird breiter, sobald der Rundgang laeuft, alle Knoepfe mit der Schrift. Das Polster der
  // Fussleiste aendert sich, wenn Safari die seitlichen Sicherheitsabstaende nach dem Drehen nachreicht (IOS-C10).
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(measure);
    for (const el of [tour, legend, tour.parentElement]) ro.observe(el);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
}
