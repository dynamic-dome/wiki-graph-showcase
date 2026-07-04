/**
 * Collapsible colour-key legend. Reads the SAME CSS custom properties that
 * three-stage.js uses for node colours, so the key can never drift from the
 * actual graph. Astro reads --node-* vars; the kompetenz dataset uses the
 * category palette passed in (single source of truth: three-stage.js).
 * Rebuilds on theme change so swatches follow crab/dome.
 */

const ASTRO_ENTRIES = [
  { varName: "--node-center", label: "Fokus-Objekt" },
  { varName: "--node-astro", label: "Astrophysik" },
  { varName: "--node-gante", label: "Gantefoer" },
  { varName: "--node-entity", label: "Akteur / Entitaet" },
];

const KOMPETENZ_LABELS = {
  competence: "Kompetenz",
  synthesis: "Synthese",
  topic: "Thema",
  concept: "Konzept",
  entity: "Akteur / Entitaet",
};

export function createLegend(rootEl, opts = {}) {
  if (!rootEl) return { setOpen() {}, rebuild() {} };
  const dataset = opts.dataset || "astro";
  const kompetenzColors = opts.kompetenzColors || {};
  const toggle = rootEl.querySelector(".legend-toggle");
  const body = rootEl.querySelector(".legend-body");
  let open = false;

  function swatchRow(color, label) {
    const row = document.createElement("div");
    row.className = "legend-row";
    const sw = document.createElement("span");
    sw.className = "legend-swatch";
    sw.style.background = color;
    const lb = document.createElement("span");
    lb.className = "legend-label";
    lb.textContent = label;
    row.appendChild(sw);
    row.appendChild(lb);
    return row;
  }

  function build() {
    const styles = getComputedStyle(document.documentElement);
    body.innerHTML = "";
    if (dataset === "kompetenz") {
      for (const [key, label] of Object.entries(KOMPETENZ_LABELS)) {
        body.appendChild(swatchRow(kompetenzColors[key] || "#8fb7ff", label));
      }
    } else {
      for (const e of ASTRO_ENTRIES) {
        const color = (styles.getPropertyValue(e.varName) || "#8CF0FF").trim();
        body.appendChild(swatchRow(color, e.label));
      }
    }
    const note = document.createElement("p");
    note.className = "legend-note";
    note.textContent =
      "Blassere Knoten liegen weiter vom Fokus. Der Gold-Mode-Regler steuert Puls und Bruecken-Leuchten.";
    body.appendChild(note);
  }

  function setOpen(v) {
    open = v;
    body.hidden = !v;
    toggle.setAttribute("aria-expanded", v ? "true" : "false");
    rootEl.classList.toggle("open", v);
  }

  toggle.addEventListener("click", () => setOpen(!open));
  document.addEventListener("themechange", build);

  build();
  setOpen(false);

  return { setOpen, rebuild: build };
}
