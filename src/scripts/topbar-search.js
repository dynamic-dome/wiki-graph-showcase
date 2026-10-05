/**
 * Handy quer (IOS-C5, 2026-10-05): Safari laesst im Querformat mit Adress- und Tab-Leiste nur etwa 277 px Hoehe.
 * Passt das Suchfeld in die Luecke der Kopfzeile, rueckt es dorthin und die Zeile darunter wird frei.
 * Dieses Modul misst nur (Luecke und Hoehe der Kopfzeile) und setzt .search-in-topbar sowie
 * --search-l, --search-w und --topbar-h auf <html>. Das Layout selbst steht in styles/overview.css.
 */
export const QUER = "(min-width: 560px) and (max-height: 500px) and (hover: none) and (pointer: coarse)";
const MIN_BREITE = 140; // darunter passt der Platzhalter "Thema suchen…" nicht mehr ganz hinein
const ABSTAND = 12;

/** Platz fuer das Suchfeld zwischen den Seitenlinks (rechte Kante) und der Datensatz-Wahl (linke Kante). */
export function searchSlot(linksRight, rightLeft) {
  const left = Math.ceil(linksRight + ABSTAND);
  const width = Math.floor(rightLeft - ABSTAND - left);
  return { left, width, fits: width >= MIN_BREITE };
}

export function createTopbarSearch(root = document.documentElement) {
  const topbar = document.querySelector(".topbar");
  const links = document.querySelector(".site-links");
  const right = document.querySelector(".topbar-right");
  if (!topbar || !links || !right || !window.matchMedia) return;
  const quer = window.matchMedia(QUER);
  const measure = () => {
    if (!quer.matches) {
      root.classList.remove("search-in-topbar");
      return;
    }
    root.style.setProperty("--topbar-h", `${Math.round(topbar.getBoundingClientRect().bottom)}px`);
    const slot = searchSlot(links.getBoundingClientRect().right, right.getBoundingClientRect().left);
    root.classList.toggle("search-in-topbar", slot.fits);
    if (slot.fits) {
      root.style.setProperty("--search-l", `${slot.left}px`);
      root.style.setProperty("--search-w", `${slot.width}px`);
    }
  };
  measure();
  quer.addEventListener("change", measure);
  window.addEventListener("resize", measure);
  // IOS-C10: Safari setzt die seitlichen Sicherheitsabstaende nach dem Drehen erst nach dem resize-Ereignis.
  // Deshalb misst jede Groessenaenderung der Kopfzeile (ihr Polster) und ihrer beiden Gruppen neu.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(measure);
    for (const el of [topbar, links, right]) ro.observe(el);
  }
  // Die Breiten haengen an den Schriften: nach dem Laden neu messen
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
}
